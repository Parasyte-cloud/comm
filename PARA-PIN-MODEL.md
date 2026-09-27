# The PArA Pin model

Two identifiers, two different jobs. Worth stating explicitly because "pin"
(bookmark a message) and "PIN" (numeric passcode) collide in conversation
even though they're unrelated in the code.

| | Handle | PIN |
|---|---|---|
| Example | `@amara.okafor` | `4821093` |
| Visibility | Public, shown everywhere | Private, never displayed after setup |
| Purpose | "Who is this", identity, addressing, @-mentions | "Prove it's you, right now", step-up auth |
| Changes | Rarely (like a username) | Whenever the account holder wants |
| Where it lives today | `profiles.handle` in Postgres, real and unique per account | `profiles.pin_hash` in Postgres, set via the Identity panel, never sent to any client |

## Where the PIN is used today

- **Unlocking a locked message.** Composer's lock toggle flags a message
  `locked: true`. Anyone who opens it sees a blurred "tap to unlock" bubble;
  entering the account's PIN reveals the text.

## Where it's designed to extend to (not built yet)

Because the guard (`src/lib/pin.ts`, `usePinGuard`) is account-wide rather
than tied to a single message, the same instance can gate anything else
that wants a lightweight "confirm it's you" step without a full re-login:

- Approving a call join request from an unfamiliar participant
- Authorizing a wallet/payment action in RA-workspace (relevant to
  `RA-workspace-admin-payments`, `RA-workspace-marketing-wallet` if this
  model gets shared across those repos)
- Revealing anything else marked sensitive in a future "vault" feature

To reuse it elsewhere: mount one `usePinGuard(accountPin)` near the root of
whatever app needs it, and pass `verify` / `isLocked` / `secondsLeft` down
to each surface that needs a PIN prompt. Don't create a new guard per
surface, the whole point is that five wrong guesses anywhere locks
*everything* gated by that PIN, the same way a phone's passcode lockout
covers the whole device, not just the app you were trying to open.

## The lockout rule

`src/lib/pin.ts`:
- `PIN_LENGTH = 7`
- `MAX_ATTEMPTS = 5` wrong guesses
- `LOCKOUT_MS = 30_000`, 30 second cooldown, then attempts reset

This exists because a 7-digit PIN has "only" 10,000,000 combinations, trivial
to brute-force with no rate limit. The lockout counter is enforced
**client-side** right now (a UX safeguard, resets if you close the tab), but
the check it's guarding, `verify_own_pin`, is a real server-side function, a
modified client can skip its own countdown but still only gets to keep
guessing at whatever rate the network allows, it can't skip the hash
comparison itself or read someone else's PIN.

## What's real now

1. **Hashing.** `set_own_pin(new_pin)` hashes with `crypt()` / `gen_salt('bf')`
   (bcrypt via pgcrypto) and stores only the hash. No client, including the
   one that just set it, ever gets the plaintext PIN back.
2. **Server-side verification.** `verify_own_pin(candidate)` runs as a
   Postgres function under RLS, checking only the caller's own row
   (`auth.uid()`), there's no way to check or influence anyone else's PIN
   through it.

## What's still missing before this is fully production-grade

1. **Server-side lockout.** The attempt counter and cooldown still live in
   this browser tab's React state (`usePinGuard` in `src/lib/pin.ts`), not on
   the account row. Closing the tab resets an attacker's budget. Fix: add
   `pin_attempts` and `pin_locked_until` columns to `profiles`, and have
   `verify_own_pin` check and update them itself, returning whether the
   caller is currently locked out.
2. **Network-level rate limiting.** Per-IP and per-account throttling on the
   RPC call itself, independent of the lockout above, a Supabase Edge
   Function in front of it (instead of calling the RPC directly) is the
   usual way to add this.
3. **Actual encryption for locked message content**, if the threat model
   includes "someone reads the database directly." Right now "locked" means
   "hidden behind a server-verified PIN gate in the UI," not "encrypted at
   rest," the message body sits in plain text in the `messages` table. Those
   are different guarantees, say which one you mean when this gets a
   security review.
4. **PIN recovery flow.** What happens when someone forgets their PIN?
   Needs its own re-auth path (a fresh magic link, then set a new PIN), not
   a "reset PIN" button with no verification. Since sign-in is already a
   magic link, a "forgot PIN" flow can piggyback on the same email-ownership
   proof: re-authenticate, then call `set_own_pin` again.
