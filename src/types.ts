export type Message = {
  id: number;
  author: string;
  handle: string;
  initials: string;
  body: string;
  time: string;
  mine?: boolean;
  reaction?: string;
  reactionCount?: number;
  pinned?: boolean;
  locked?: boolean;
};

export type Channel = {
  id: string;
  name: string;
  topic: string;
};

export type Person = {
  /** Supabase auth user id, doubles as the RealtimeKit participant id. */
  id: string;
  name: string;
  handle: string;
  role: string;
  status: "online" | "away" | "offline";
  initials: string;
};
