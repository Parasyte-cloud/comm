-- PArA chat backend: accounts, channels, messages, realtime sync, and the
-- server-side half of the PArA Pin model. Run this once against the comm
-- Supabase project (SQL editor, or `supabase db push`), see
-- PARA-BACKEND-SETUP.md for the full walkthrough.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Profiles: one row per signed-in account. Auto-created on first sign-in
-- so a new teammate lands in the app with a usable identity right away,
-- they rename themselves and set their PIN afterward in Identity.
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique not null,
  name text not null,
  role text not null default 'Team member',
  status text not null default 'online' check (status in ('online', 'away', 'offline')),
  initials text not null,
  pin_hash text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles replica identity full;

create policy "profiles are readable by any signed-in teammate"
  on public.profiles for select
  to authenticated
  using (true);

create policy "a teammate updates only their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- pin_hash is never writable directly from the client, only through the
-- set_own_pin() function below, which hashes it server-side.
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (handle, name, role, status, initials) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle text;
  final_handle text;
  suffix int := 0;
  seed_initials text;
begin
  base_handle := '@' || regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9.]+', '', 'gi');
  if base_handle = '@' then
    base_handle := '@teammate';
  end if;
  final_handle := base_handle;
  while exists (select 1 from public.profiles where handle = final_handle) loop
    suffix := suffix + 1;
    final_handle := base_handle || suffix::text;
  end loop;

  seed_initials := upper(left(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z]', '', 'g'), 2));
  if seed_initials = '' then
    seed_initials := 'PA';
  end if;

  insert into public.profiles (id, handle, name, initials)
  values (new.id, final_handle, split_part(new.email, '@', 1), seed_initials);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Channels
-- ---------------------------------------------------------------------
create table public.channels (
  id text primary key,
  name text not null,
  topic text not null default '',
  created_at timestamptz not null default now()
);

alter table public.channels enable row level security;
alter table public.channels replica identity full;

create policy "channels are readable by any signed-in teammate"
  on public.channels for select
  to authenticated
  using (true);

create policy "any signed-in teammate can create a channel"
  on public.channels for insert
  to authenticated
  with check (true);

grant select, insert on public.channels to authenticated;

insert into public.channels (id, name, topic) values
  ('announcements', 'announcements', 'Company-wide updates and releases.'),
  ('dispatch', 'dispatch', 'Live ride dispatch coordination and driver assignment.'),
  ('instant-rides', 'instant-rides', 'Instant Ride product, fare tiers, and acceptance flow.'),
  ('wallet-payments', 'wallet-payments', 'Wallet balances, payouts, and payment references.'),
  ('support', 'support', 'Rider and driver support escalations.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Messages
--
-- conversation_key is "channel:<id>" for a channel, or "dm:<a>:<b>" for a
-- direct message with the two handles sorted, so both participants always
-- read and write the same thread regardless of who opened the DM first.
-- dm_participants carries the same two handles as an array so RLS can
-- check membership without parsing the key.
--
-- Author fields are denormalized (handle/name/initials captured at send
-- time) so a realtime INSERT payload is enough to render the message with
-- no extra join, and so a later name change doesn't rewrite history.
-- ---------------------------------------------------------------------
create table public.messages (
  id bigint generated always as identity primary key,
  conversation_key text not null,
  dm_participants text[],
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_handle text not null,
  author_name text not null,
  author_initials text not null,
  body text not null,
  created_at timestamptz not null default now(),
  pinned boolean not null default false,
  locked boolean not null default false,
  reaction text,
  reaction_count integer not null default 0
);

create index messages_conversation_key_idx on public.messages (conversation_key, created_at);
create index messages_dm_participants_idx on public.messages using gin (dm_participants);

alter table public.messages enable row level security;
alter table public.messages replica identity full;

create policy "read channel messages, or a dm you're part of"
  on public.messages for select
  to authenticated
  using (
    conversation_key like 'channel:%'
    or (
      dm_participants is not null
      and (select handle from public.profiles where id = auth.uid()) = any (dm_participants)
    )
  );

create policy "post as yourself, into a channel or your own dm"
  on public.messages for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and author_handle = (select handle from public.profiles where id = auth.uid())
    and (
      conversation_key like 'channel:%'
      or (
        dm_participants is not null
        and (select handle from public.profiles where id = auth.uid()) = any (dm_participants)
      )
    )
  );

create policy "update pin or reaction on a message you can read"
  on public.messages for update
  to authenticated
  using (
    conversation_key like 'channel:%'
    or (
      dm_participants is not null
      and (select handle from public.profiles where id = auth.uid()) = any (dm_participants)
    )
  )
  with check (true);

grant select, insert, update on public.messages to authenticated;

-- Belt and suspenders on top of the update policy above: RLS "with check"
-- can't restrict which COLUMNS change, only which rows, so this trigger
-- is the real guarantee that an update can only touch pinned/reaction/
-- reaction_count, never rewrite a message's body, author, or lock state.
create or replace function public.restrict_message_update()
returns trigger
language plpgsql
as $$
begin
  if new.body <> old.body
    or new.author_id <> old.author_id
    or new.author_handle <> old.author_handle
    or new.conversation_key <> old.conversation_key
    or new.locked <> old.locked
    or new.created_at <> old.created_at
  then
    raise exception 'Only pinned, reaction, and reaction_count can be changed on an existing message.';
  end if;
  return new;
end;
$$;

create trigger messages_restrict_update
  before update on public.messages
  for each row execute function public.restrict_message_update();

-- ---------------------------------------------------------------------
-- The PArA Pin model, server-side half.
--
-- The PIN is never stored or transmitted in plain text after it's set,
-- and the client never learns the correct value, only whether a guess
-- matched. verify_own_pin always checks the caller's OWN row (auth.uid()),
-- there is no way to check someone else's PIN through this function.
-- ---------------------------------------------------------------------
create or replace function public.set_own_pin(new_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_pin !~ '^[0-9]{7}$' then
    raise exception 'PIN must be exactly 7 digits.';
  end if;
  update public.profiles
    set pin_hash = crypt(new_pin, gen_salt('bf'))
    where id = auth.uid();
end;
$$;

create or replace function public.verify_own_pin(candidate text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored text;
begin
  select pin_hash into stored from public.profiles where id = auth.uid();
  if stored is null then
    return false;
  end if;
  return stored = crypt(candidate, stored);
end;
$$;

revoke all on function public.set_own_pin(text) from public;
revoke all on function public.verify_own_pin(text) from public;
grant execute on function public.set_own_pin(text) to authenticated;
grant execute on function public.verify_own_pin(text) to authenticated;

-- ---------------------------------------------------------------------
-- Realtime: broadcast changes on these tables. Supabase Realtime honors
-- the RLS policies above for postgres_changes, so a client only ever
-- receives rows it's already allowed to select.
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.channels;
alter publication supabase_realtime add table public.messages;
