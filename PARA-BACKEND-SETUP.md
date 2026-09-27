# PArA backend setup

PArA now has a real backend for both chat and calling, one Supabase project
does both. Nothing works end to end until you complete this once. Everything
below assumes the Supabase project you already created for comm (kept
separate from RA-workspace's own project, per your earlier choice).

## 1. Run the database migration

`supabase/migrations/0001_chat_backend.sql` creates everything chat needs:
accounts (`profiles`), `channels`, `messages`, row level security so people
only ever see channels and their own DMs, realtime sync, and the two
functions behind the PIN model (`set_own_pin`, `verify_own_pin`).

Easiest path, no CLI needed:
1. Open your Supabase project, go to the SQL editor.
2. Paste the contents of `supabase/migrations/0001_chat_backend.sql`.
3. Run it once.

Or with the Supabase CLI, from the `para-app` folder:
```
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## 2. Turn on email sign-in

Sign-in is a magic link to your work email, Supabase handles sending it,
no separate password to manage.

1. In the Supabase dashboard: Authentication -> Providers -> Email, make
   sure it's enabled (it is by default).
2. Authentication -> URL Configuration: set Site URL to
   `https://comm.parasyte.cloud` (or wherever this is deployed), and add it
   under Redirect URLs too. Add `http://localhost:5173` as an extra redirect
   URL if you'll test locally.
3. That's it, no extra secrets. The first time someone signs in with a new
   email, the migration's trigger creates their `profiles` row automatically
   (handle guessed from their email, they rename themselves in Identity).

## 3. Deploy the calling function

The `call-session` Edge Function is the only place that holds Cloudflare
RealtimeKit credentials, the browser never sees them.

```
supabase functions deploy call-session
```

Then set the same five secrets RA-workspace already uses (copy the values
straight from its Cloudflare RealtimeKit app):
```
supabase secrets set CLOUDFLARE_ACCOUNT_ID=...
supabase secrets set CLOUDFLARE_REALTIMEKIT_APP_ID=...
supabase secrets set CLOUDFLARE_REALTIMEKIT_API_TOKEN=...
supabase secrets set CLOUDFLARE_REALTIMEKIT_HOST_PRESET=...
supabase secrets set CLOUDFLARE_REALTIMEKIT_PARTICIPANT_PRESET=...
```

## 4. Set the client environment variables

From your Supabase project's Settings -> API page, copy the Project URL and
anon public key.

Locally, copy `.env.example` to `.env.local` and fill both in:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

On Cloudflare Pages: Settings -> Environment variables, add
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` there too (production and
preview), then redeploy, Vite bakes env vars in at build time, not runtime.

## 5. Test it end to end

- Open the deployed app in two different browsers (or one normal + one
  private window), sign in with two different email addresses.
- Each lands with an auto-generated handle, open Identity (gear icon) and
  set a real name and a PIN.
- Message in a channel from one, it should appear in the other within a
  second or two, no refresh, that's the realtime subscription.
- DM the other account by name, confirm the thread only shows up for the
  two of you (open it from a third account and it won't be there).
- Pin a message, lock a message, confirm the lock only opens after the
  correct PIN, five wrong tries locks it out for 30 seconds.
- Start a video call from one, copy the meeting code shown, join from the
  other with "Join a call".

## What's still simplified, on purpose

- **Presence is manual.** Online/away/offline is a field the person sets in
  Identity, not automatic idle detection. Real presence would use Supabase
  Realtime's Presence feature, worth adding once this is in daily use.
- **No invite flow yet.** New accounts are created by signing in, there's no
  "invite a teammate" screen, that button still says so. Add someone by
  having them sign in once.
- **PIN lockout is per-browser-tab.** The count of wrong tries resets if you
  close the tab. Moving the counter into the `profiles` row (a `locked_until`
  column, checked inside `verify_own_pin`) closes that gap, see the note at
  the bottom of `src/lib/pin.ts`.
- **Locked messages are a UI gate, not encryption.** The body is stored in
  plain text in Postgres and only hidden client-side until the PIN check
  passes. Real encryption-at-rest for locked content is future work, noted
  in `src/lib/pin.ts` and `PARA-PIN-MODEL.md`.
- **Anyone can create a channel and post in any channel.** That matches the
  small-team, everyone's-ops flow this was built for. If PArA grows past
  that, add a `channel_members` table and tighten the RLS policies in the
  migration.
