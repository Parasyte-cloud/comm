# PArA

A premium communication UI inspired by the best interaction patterns from team workspaces, community servers and direct messaging apps.

## Included

- Burgundy + beige liquid-glass visual system
- Workspace rail and channel navigation
- Direct messages with presence states
- Responsive desktop/mobile layout
- Channel header with voice/video actions
- Chat composer with working local demo messages
- Channel details, members and shared-media rail
- **Pinned messages**, pin any message from its hover menu, see a live count in the sidebar, and browse everything pinned in a dedicated panel
- **@handle identity + 7-digit PIN**, every person has a unique `@handle` (shown next to their name everywhere), and the signed-in account has a private 7-digit PIN, set from the Identity panel (gear icon in the rail)
- **Locked messages**, send a message as locked (vault-style); it renders blurred behind a "tap to unlock" bubble, and unlocking it requires typing the account's 7-digit PIN, not just a tap, this is what makes "pinned" and "locked" two genuinely different things instead of both meaning the same "pin"
- **Real calling**, backed by Cloudflare RealtimeKit (the same provider RA-workspace runs in production), not a mock. Start a call from the header, share the meeting code, join from another browser. See PARA-CALLING-SETUP.md to wire up your own Supabase project and RealtimeKit credentials
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
  PIN to reveal it. In this demo it checks against the viewer's own local `myPin` state
  in `App.tsx` (single-user, no backend yet), the realistic version is per-account,
  set at signup, and checked server-side (or better, used to derive a decryption key
  client-side so the server never sees plaintext).

Both `people[].handle` and the account's PIN live in `src/data/mock.ts` /
`App.tsx`'s `myPin` state, swap those for real user records once there's an auth
backend, keeping the same shape (`{ name, handle, ... }`) so the components don't change.

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
PARA-CALLING-SETUP.md for the full setup (Supabase project, RealtimeKit
credentials, environment variables).

A person's `@handle` becomes their display name inside the call (passed as
the participant's `name` when the edge function adds them to the meeting),
and the PIN model (`src/lib/pin.ts`) is available to gate joining a
sensitive call the same way it gates unlocking a message, not wired up by
default, but the same `usePinGuard` instance can cover both.

## Recommended production backend

For the real app, add:

- Supabase Auth or Clerk for identity
- Postgres + row-level security for channels, messages, pins
- WebSocket/realtime transport (Supabase Realtime, Ably, or a custom socket server)
- WebRTC (or the RA-workspace call service) for voice/video, replacing the mock `CallOverlay`
- Object storage for attachments
- Push notifications
- A real encryption strategy for locked messages and private DMs (the current
  "locked" feature is a client-side reveal-on-tap UI, not encryption, treat it as
  the UI shell for whatever key-management approach you land on)
- Audit logs, rate limits and abuse controls

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
