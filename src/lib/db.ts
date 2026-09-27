import { supabase } from "./supabase";
import type { Channel, Message, Person } from "../types";

/**
 * Data layer for PArA's real chat backend. Every read here goes through
 * Postgres row-level security (see supabase/migrations/0001_chat_backend.sql),
 * a signed-in account only ever gets rows it's actually allowed to see, this
 * file doesn't re-implement that filtering client-side.
 */

type MessageRow = {
  id: number;
  conversation_key: string;
  author_handle: string;
  author_name: string;
  author_initials: string;
  body: string;
  created_at: string;
  pinned: boolean;
  locked: boolean;
  reaction: string | null;
  reaction_count: number;
};

function rowToMessage(row: MessageRow, myHandle: string): Message {
  return {
    id: row.id,
    author: row.author_name,
    handle: row.author_handle,
    initials: row.author_initials,
    body: row.body,
    time: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    mine: row.author_handle === myHandle,
    reaction: row.reaction ?? undefined,
    reactionCount: row.reaction_count || undefined,
    pinned: row.pinned,
    locked: row.locked
  };
}

type ProfileRow = {
  id: string;
  handle: string;
  name: string;
  role: string;
  status: Person["status"];
  initials: string;
};

function rowToPerson(row: ProfileRow): Person {
  return { id: row.id, handle: row.handle, name: row.name, role: row.role, status: row.status, initials: row.initials };
}

export async function fetchMe(userId: string): Promise<Person | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToPerson(data as ProfileRow) : null;
}

export async function fetchProfiles(): Promise<Person[]> {
  const { data, error } = await supabase.from("profiles").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToPerson(row as ProfileRow));
}

export async function fetchChannels(): Promise<Channel[]> {
  const { data, error } = await supabase.from("channels").select("*").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, topic: row.topic }));
}

export async function createChannelRow(id: string): Promise<Channel> {
  const { data, error } = await supabase
    .from("channels")
    .insert({ id, name: id, topic: "New channel." })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, name: data.name, topic: data.topic };
}

/** Every channel message (readable by any signed-in teammate), plus every
 * DM thread this account is a participant in. Fetched once at load and
 * kept current after that by the realtime subscription below, an internal
 * ops team's message volume doesn't need per-conversation lazy loading. */
export async function fetchAllMessages(myHandle: string): Promise<Record<string, Message[]>> {
  const [channelResult, dmResult] = await Promise.all([
    supabase.from("messages").select("*").like("conversation_key", "channel:%").order("created_at"),
    supabase.from("messages").select("*").contains("dm_participants", [myHandle]).order("created_at")
  ]);
  if (channelResult.error) throw new Error(channelResult.error.message);
  if (dmResult.error) throw new Error(dmResult.error.message);

  const threads: Record<string, Message[]> = {};
  for (const row of [...(channelResult.data ?? []), ...(dmResult.data ?? [])] as MessageRow[]) {
    const key = row.conversation_key;
    if (!threads[key]) threads[key] = [];
    threads[key].push(rowToMessage(row, myHandle));
  }
  return threads;
}

type SendMessageInput = {
  conversationKey: string;
  dmParticipants?: [string, string];
  authorId: string;
  authorHandle: string;
  authorName: string;
  authorInitials: string;
  body: string;
  locked: boolean;
};

export async function sendMessage(input: SendMessageInput, myHandle: string): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_key: input.conversationKey,
      dm_participants: input.dmParticipants ?? null,
      author_id: input.authorId,
      author_handle: input.authorHandle,
      author_name: input.authorName,
      author_initials: input.authorInitials,
      body: input.body,
      locked: input.locked
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToMessage(data as MessageRow, myHandle);
}

export async function setPinned(id: number, pinned: boolean): Promise<void> {
  const { error } = await supabase.from("messages").update({ pinned }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function addReaction(id: number, emoji: string, nextCount: number): Promise<void> {
  const { error } = await supabase.from("messages").update({ reaction: emoji, reaction_count: nextCount }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Checks a PIN guess against the signed-in account's own PIN, server-side.
 * The real PIN never reaches the client, see verify_own_pin() in the
 * migration. */
export async function verifyOwnPin(candidate: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("verify_own_pin", { candidate });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** Sets or changes the signed-in account's PIN. Hashed server-side, never
 * stored or sent back in plain text. */
export async function setOwnPin(pin: string): Promise<void> {
  const { error } = await supabase.rpc("set_own_pin", { new_pin: pin });
  if (error) throw new Error(error.message);
}

export async function updateOwnProfile(fields: Partial<Pick<Person, "name" | "role" | "status">>): Promise<void> {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  const userId = userResult.user?.id;
  if (!userId) throw new Error("Not signed in.");
  const { error } = await supabase.from("profiles").update(fields).eq("id", userId);
  if (error) throw new Error(error.message);
}

type MessageChangeHandler = (conversationKey: string, message: Message, eventType: "INSERT" | "UPDATE") => void;

/** One shared realtime subscription for every message this account can
 * see. Supabase Realtime applies the same RLS policies as a normal select,
 * so this only ever fires for rows fetchAllMessages would also return. */
export function subscribeToMessages(myHandle: string, onChange: MessageChangeHandler) {
  const channel = supabase
    .channel("para-messages")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
      const row = payload.new as MessageRow;
      onChange(row.conversation_key, rowToMessage(row, myHandle), "INSERT");
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
      const row = payload.new as MessageRow;
      onChange(row.conversation_key, rowToMessage(row, myHandle), "UPDATE");
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToChannels(onInsert: (channel: Channel) => void) {
  const channel = supabase
    .channel("para-channels")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "channels" }, (payload) => {
      const row = payload.new as { id: string; name: string; topic: string };
      onInsert({ id: row.id, name: row.name, topic: row.topic });
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToProfiles(onChange: (person: Person) => void) {
  const channel = supabase
    .channel("para-profiles")
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
      const row = payload.new as ProfileRow | undefined;
      if (!row) return;
      onChange(rowToPerson(row));
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
