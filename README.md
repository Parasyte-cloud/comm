# PArA

A premium communication UI inspired by the best interaction patterns from team workspaces, community servers and direct messaging apps.

## Included

- Burgundy + beige liquid-glass visual system
- Workspace rail and channel navigation
- Direct messages with presence states
- Responsive desktop/mobile layout
- Channel header with voice/video actions
- **Real accounts**, sign in with a magic link to your work email (Supabase Auth), no shared local identity, two people in two browsers are genuinely two different accounts
- **Real-time chat**, channels and DMs are backed by Postgres (Supabase) with row-level security and a realtime subscription, a message sent in one browser shows up in another within a second or two, no refresh
- Channel details, members and shared-media rail
- **Pinned messages**, pin any message from its hover menu, see a live count in the sidebar, and browse everything pinned in a dedicated panel, synced for everyone who can see that conversation
- **@handle identity + 7-digit PIN**, every person has a unique `@handle` (shown next to their name everywhere), and the signed-in account has a private 7-digit PIN, set from the Identity panel (gear icon in the rail) and verified server-side, the PIN itself never reaches any client once set
- **Locked messages**, send a message as locked (vault-style); it renders blurred behind a "tap to unlock" bubble, and unlocking it requires typing the account's 7-digit PIN, checked against the server, not just a tap, this is what makes "pinned" and "locked" two genuinely different things instead of both meaning the same "pin"
- **Real calling**, backed by Cloudflare RealtimeKit (the same provider RA-workspace runs in production), not a mock. Start a call from the header, share the meeting code, join from another browser. See PARA-BACKEND-SETUP.md to wire up your own Supabase project and RealtimeKit credentials
- Huddle card and "Join a call" wired to the real call flow
- Clean React + TypeScript + Vite structure

## Run

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

Output goes to `dist/`.

## How identity, pinning and locking relate

These are three separate mechanisms that happen to share vocabulary, worth being
explicit about since "pin" and "PIN" collide:

- **Pinning** (`message.pinned`) is bookmarking. Any member can pin any message they
  can see; it just keeps it surfaced in the Pinned panel. No security involved.
- **Handle** (`@amara.okafor`) is a public, stable identifier for a person, shown next
  to their name in the message list, DM list and member list. It's how people find or
  @-mention each other, analogous to a Discord tag or a Signal username.
- **PIN** is a private 7-digit code that belongs to the signed-in account (set/changed
  from the Identity panel, opened via the Settings gear in the left rail). It is the
  unlock key for **locked** messages: composing with the lock toggle on flags a message
  `locked: true`; anyone who opens it sees a blurred bubble and must type the 7-digit
  PIN to reveal it. The PIN is hashed and checked server-side (`set_own_pin` /
  `verify_own_pin` in `supabase/migrations/0001_chat_backend.sql`), no client, including
  the one that set it, ever gets the real value back. See `PARA-PIN-MODEL.md` for what's
  still simplified (lockout is per-tab, not per-account yet) versus real encryption.

Accounts, handles and channels are real rows in Postgres now (`profiles`, `channels`,
`messages`), see `src/lib/db.ts` for every read/write and `src/types.ts` for their
shapes. There's no more local mock data to swap out.

## Calling, and how it matches RA-workspace

`src/components/CallOverlay.tsx` is real, not a mock: it calls the
`call-session` Supabase Edge Function to mint a Cloudflare RealtimeKit
participant token, then hands that token to RealtimeKit's own client and
prebuilt meeting UI (`@cloudflare/realtimekit-react` + `-react-ui`). This is
the same provider and the same token-minting pattern RA-workspace's
`room-session` function already runs in production, comm intentionally uses
its own Supabase project and its own edge function rather than sharing
RA-workspace's, so the two stay independently deployable while still
running on the same calling infrastructure underneath. See
PARA-BACKEND-SETUP.md for the full setup (Supabase project, RealtimeKit
credentials, environment variables).

A person's `@handle` becomes their display name inside the call (passed as
the participant's `name` when the edge function adds them to the meeting),
and the PIN model (`src/lib/pin.ts`) is available to gate joining a
sensitive call the same way it gates unlocking a message, not wired up by
default, but the same `usePinGuard` instance can cover both.

## What's real now, and what's next

Real: accounts (Supabase Auth, magic link), channels and DMs backed by Postgres with
row-level security, realtime sync across devices, server-verified PINs, and calling
over Cloudflare RealtimeKit. See PARA-BACKEND-SETUP.md to turn all of that on for your
own Supabase project, it does nothing until that's done.

Still ahead:

- An invite flow (today, a new account is created by signing in once, there's no
  "invite a teammate" screen)
- Object storage for attachments (the paperclip button is still a "coming soon" toast)
- Automatic presence (online/away/offline is set by hand in Identity, not idle-detected)
- Push notifications
- Real encryption for locked messages (currently a server-verified UI gate, the body
  itself is stored in plain text, see `PARA-PIN-MODEL.md`)
- Audit logs, rate limits and abuse controls
- A `channel_members` table if PArA outgrows "anyone can read/post in any channel"

PArA should stay visually original rather than cloning Slack, Discord or WhatsApp
branding/UI exactly.

## Deploying to Cloudflare Pages (call.parasyte.cloud or comm.parasyte.cloud)

1. Push this repo to GitHub (see below).
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**,
   pick the `comm` repo.
3. Build settings:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `para-app` (since the app lives in that subfolder of the repo)
4. Deploy. Cloudflare gives you a `*.pages.dev` URL immediately.
5. Attach your domain: **Pages project → Custom domains → Add a custom domain**,
   enter `comm.parasyte.cloud` (or `call.parasyte.cloud`). Cloudflare will offer to
   create the CNAME automatically if the zone (`parasyte.cloud`) is already on
   Cloudflare DNS, accept it, or add manually:
   ```
   Type: CNAME
   Name: comm   (or "call")
   Target: <your-project>.pages.dev
   Proxy status: Proxied
   ```
6. `public/_redirects` is already set to fall back every route to `index.html`, so
   client-side routing (once you add any) won't 404 on refresh.

## Push to GitHub

From inside this folder:

```bash
git init
git add .
git commit -m "PArA: pinned messages, locked messages, call overlay"
git branch -M main
git remote add origin https://github.com/Parasyte-cloud/comm.git
git push -u origin main
```

If the remote already has commits (an existing README, license, etc.), pull first
with rebase to avoid a merge commit:

```bash
git pull --rebase origin main
git push -u origin main
```

If `Parasyte-cloud/comm` doesn't exist yet, create it first (empty, no README) at
https://github.com/organizations/Parasyte-cloud/repositories/new, then run the
commands above.
