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
| Where it lives today | `src/data/mock.ts` (`Person.handle`, `me.handle`) | `App.tsx` `myPin` state, set via the Identity panel |

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
to brute-force with no rate limit. The lockout is enforced **client-side
only** right now, which is a UX safeguard, not a security boundary: it stops
someone idly mashing the unlock button in the UI, but a modified client (or
a direct API call, once there's a real backend) could ignore it entirely.

## What's still missing before this is production-grade

1. **Hashing.** The PIN is compared in plaintext against React state. A real
   backend stores only a salted hash (bcrypt/argon2) and never the PIN itself.
2. **Server-side lockout.** The counter and cooldown need to live on the
   account row (or a Redis key keyed by account id), not in a browser tab,
   otherwise clearing localStorage or opening a new tab resets the attacker's
   budget.
3. **Network-level rate limiting.** Per-IP and per-account throttling on the
   verify endpoint, independent of the app-level lockout.
4. **Actual encryption for locked message content**, if the threat model
   includes "someone reads the database directly." Right now "locked" means
   "hidden behind a PIN gate in the UI," not "encrypted at rest." Those are
   different guarantees, say which one you mean when this gets a security
   review.
5. **PIN recovery flow.** What happens when someone forgets their PIN?
   Needs its own re-auth path (email/SMS challenge), not a "reset PIN"
   button with no verification.

## Suggested API shape, whenever a backend exists

```
POST /api/pin/verify
Body: { candidate: "1234567" }
Auth: existing session cookie/token identifies the account
Response: { ok: boolean, attemptsLeft: number, lockedUntil: string | null }
```

Keep the verify endpoint dumb, it answers "does this PIN match," nothing
more. Whatever it's gating (revealing a message body, authorizing a call,
approving a payment) is a separate, subsequent call once `ok: true` comes
back, so the PIN check itself stays a small, auditable, reusable piece
instead of being duplicated per feature.
