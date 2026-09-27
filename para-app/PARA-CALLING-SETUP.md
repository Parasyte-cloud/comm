# Wiring up real calling

PArA's call overlay uses **Cloudflare RealtimeKit**, the same calling
provider RA-workspace already runs in production (`@cloudflare/realtimekit-react`
+ `@cloudflare/realtimekit-react-ui`). The client never touches your
RealtimeKit API credentials directly, it only ever sees a short-lived
participant token minted by a Supabase Edge Function
(`supabase/functions/call-session/index.ts`).

You chose to give `comm` its own Supabase project rather than share
RA-workspace's, so it can deploy and scale independently while still using
the same underlying Cloudflare RealtimeKit account.

## 1. Create the Supabase project

```bash
npx supabase login
npx supabase projects create comm --org-id <your-org-id>
```

Or do it from the Supabase dashboard: New Project, name it `comm`, pick a
region close to your users.

## 2. Link this repo to it and deploy the function

```bash
cd para-app
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy call-session
```

## 3. Set the calling secrets

These are the exact same env var names RA-workspace's `room-session`
function uses, so you can copy the same values straight from wherever
RA-workspace's Cloudflare RealtimeKit app is configured, or provision a
second RealtimeKit app in the same Cloudflare account if you'd rather keep
comm's call traffic and analytics separate from RA-workspace's:

```bash
npx supabase secrets set \
  CLOUDFLARE_ACCOUNT_ID=your_account_id \
  CLOUDFLARE_REALTIMEKIT_APP_ID=your_app_id \
  CLOUDFLARE_REALTIMEKIT_API_TOKEN=your_api_token \
  CLOUDFLARE_REALTIMEKIT_HOST_PRESET=your_host_preset_name \
  CLOUDFLARE_REALTIMEKIT_PARTICIPANT_PRESET=your_member_preset_name
```

If you don't already have a RealtimeKit app, create one from the Cloudflare
dashboard (Realtime, RealtimeKit) and define at least two presets: one for
the person who starts a call (host, usually with moderation rights) and one
for everyone else joining (member).

## 4. Point the client at the new project

Copy `.env.example` to `.env.local` and fill in your project's URL and anon
key (Supabase dashboard, Settings, API):

```bash
cp .env.example .env.local
```

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Add the same two variables as build-time environment variables in Cloudflare
Pages (Pages project, Settings, Environment variables) so the deployed site
has them too, not just your local dev server.

## 5. Test it end to end

```bash
npm run dev
```

Click the video or mic icon in the header. It should call `create`, mint a
real RealtimeKit meeting, and drop you into Cloudflare's own meeting UI
(camera/mic setup screen, then the call). Copy the meeting code shown in the
call header, open the app in a second browser (or send it to someone else
running the app), and use "Join a call" from the sidebar to enter that code.
Both of you should land in the same real call.

## What this does not include yet

- **No persistent room registry.** Each "start call" creates a brand new
  Cloudflare meeting, there's no database table tying a meeting to a PArA
  channel the way RA-workspace ties rooms to `room_code`. Good enough to
  prove the pipeline works, not yet good enough for "everyone in
  #product-design automatically joins the same ongoing call."
- **No real multi-user chat.** The bigger gap: `comm`'s messages, channels,
  and the `people` list are still local mock state in `src/data/mock.ts`,
  not backed by real accounts or a synced database. Calling now works for
  real between two real browsers, but chat itself doesn't sync between
  them yet. That's the next real backend piece, not a calling problem.
- **No moderation controls.** RA-workspace's room system has host/member
  presets, kicking, and reconnect handling (see `RoomMeeting.tsx` there for
  the reconnect-loop pattern if PArA needs it later). This version wires the
  presets through but doesn't build UI for using them yet.
