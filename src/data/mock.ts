export type Message = {
  id: number;
  author: string;
  handle: string;
  initials: string;
  body: string;
  time: string;
  mine?: boolean;
  reaction?: string;
  pinned?: boolean;
  locked?: boolean;
};

export type Channel = {
  name: string;
  unread: number;
};

export type Person = {
  name: string;
  handle: string;
  role: string;
  status: "online" | "away" | "offline";
  initials: string;
};

/** The signed-in account. In a real backend this comes from auth, along
 * with a server-issued handle and PIN, both shown here as local state
 * that lives on the account, not on any single device. */
export const me: Person = {
  name: "You",
  handle: "@biola.lawal",
  role: "Founder",
  status: "online",
  initials: "YO"
};

export const channels: Channel[] = [
  { name: "announcements", unread: 2 },
  { name: "product-design", unread: 7 },
  { name: "engineering", unread: 0 },
  { name: "operations", unread: 0 },
  { name: "random", unread: 1 }
];

export const people: Person[] = [
  { name: "Amara Okafor", handle: "@amara.okafor", role: "Product Designer", status: "online", initials: "AO" },
  { name: "David Cole", handle: "@david.cole", role: "Engineering", status: "online", initials: "DC" },
  { name: "Maya Brooks", handle: "@maya.brooks", role: "Operations", status: "away", initials: "MB" },
  { name: "Nuru Hassan", handle: "@nuru.hassan", role: "Growth", status: "offline", initials: "NH" }
];

export const initialMessages: Message[] = [
  {
    id: 1,
    author: "Amara Okafor",
    handle: "@amara.okafor",
    initials: "AO",
    body: "Morning team, I pushed the new onboarding flow into the review lane. The biggest change is a calmer first screen with fewer decisions up front.",
    time: "09:18",
    pinned: true
  },
  {
    id: 2,
    author: "David Cole",
    handle: "@david.cole",
    initials: "DC",
    body: "Nice. I can wire the invitation state today. The responsive shell is already looking much cleaner on mobile.",
    time: "09:24",
    reaction: "✨ 4"
  },
  {
    id: 3,
    author: "You",
    handle: me.handle,
    initials: "YO",
    body: "Perfect. Keep the glass surfaces subtle, I want premium, not noisy. Burgundy should carry the identity while beige keeps it warm.",
    time: "09:31",
    mine: true
  },
  {
    id: 4,
    author: "Maya Brooks",
    handle: "@maya.brooks",
    initials: "MB",
    body: "Agreed. I've added the operations use cases too: internal channels, private team rooms, external guest chat and voice/video entry points.",
    time: "09:36"
  },
  {
    id: 5,
    author: "David Cole",
    handle: "@david.cole",
    initials: "DC",
    body: "Here's the staging login for the client portal, do not forward this outside the team.",
    time: "09:42",
    locked: true
  }
];
