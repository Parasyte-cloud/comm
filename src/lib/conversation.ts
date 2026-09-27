/** A conversation is either a channel or a direct message. Every message
 * thread, pin, and lock is scoped to one of these, not global, that's what
 * makes switching channels/DMs actually change what you see.
 *
 * DM conversation keys are stored sorted (both participants land on the
 * same key regardless of who opened the DM first), so two different
 * accounts always read and write the same thread instead of two separate
 * ones. */
export type ConversationRef = { kind: "channel"; id: string } | { kind: "dm"; handle: string };

export function dmConversationKey(handleA: string, handleB: string): string {
  return `dm:${[handleA, handleB].sort().join(":")}`;
}

export function conversationKey(ref: ConversationRef, myHandle: string): string {
  return ref.kind === "channel" ? `channel:${ref.id}` : dmConversationKey(ref.handle, myHandle);
}

/** Recover a ConversationRef from a stored key, given my own handle. For a
 * DM key this picks out whichever of the two sorted handles isn't mine, so
 * the sidebar and pinned panel can show the other person, not myself. */
export function refFromKey(key: string, myHandle: string): ConversationRef {
  if (key.startsWith("channel:")) {
    return { kind: "channel", id: key.slice("channel:".length) };
  }
  const parts = key.slice("dm:".length).split(":");
  const other = parts.find((handle) => handle !== myHandle) ?? parts[0];
  return { kind: "dm", handle: other };
}
