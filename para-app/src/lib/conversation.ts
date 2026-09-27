/** A conversation is either a channel or a direct message. Every message
 * thread, pin, and lock is scoped to one of these, not global, that's what
 * makes switching channels/DMs actually change what you see. */
export type ConversationRef = { kind: "channel"; id: string } | { kind: "dm"; handle: string };

export function conversationKey(ref: ConversationRef): string {
  return ref.kind === "channel" ? `channel:${ref.id}` : `dm:${ref.handle}`;
}
