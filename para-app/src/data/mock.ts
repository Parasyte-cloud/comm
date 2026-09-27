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
  name: "Biola Lawal",
  handle: "@biola.lawal",
  role: "Founder",
  status: "online",
  initials: "BL"
};

/**
 * Seed workspace configuration for RideArrivo operations. These channels
 * mirror RideArrivo's actual operational surfaces (dispatch, instant rides,
 * wallet/payments, support) rather than generic demo names.
 *
 * The people below are placeholder SEATS, not real named employees, on
 * purpose: this is still a no-backend local demo, so it ships with role
 * titles instead of inventing fictional staff. Swap them for real accounts
 * once comm has real auth (see PARA-CALLING-SETUP.md and the identity
 * package discussion for what that migration looks like).
 */
export const channels: Channel[] = [
  { id: "announcements", name: "announcements", topic: "Company-wide updates and releases." },
  { id: "dispatch", name: "dispatch", topic: "Live ride dispatch coordination and driver assignment." },
  { id: "instant-rides", name: "instant-rides", topic: "Instant Ride product, fare tiers, and acceptance flow." },
  { id: "wallet-payments", name: "wallet-payments", topic: "Wallet balances, payouts, and payment references." },
  { id: "support", name: "support", topic: "Rider and driver support escalations." }
];

export const people: Person[] = [
  { name: "Dispatch Lead", handle: "@dispatch.lead", role: "Operations", status: "online", initials: "DL" },
  { name: "Fleet Ops", handle: "@fleet.ops", role: "Fleet Operations", status: "online", initials: "FO" },
  { name: "Support Lead", handle: "@support.lead", role: "Customer Support", status: "away", initials: "SL" },
  { name: "Payments", handle: "@payments", role: "Finance Ops", status: "offline", initials: "PY" }
];

function seedMessage(partial: Omit<Message, "id">, id: number): Message {
  return { id, ...partial };
}

/**
 * Per-conversation message threads, keyed by conversationKey() (see
 * App.tsx). Each channel and each DM has its own thread now, previously
 * every conversation showed the same single global list, which is why
 * switching channels used to look broken.
 */
export const initialThreads: Record<string, Message[]> = {
  "channel:announcements": [
    seedMessage(
      {
        author: "Fleet Ops",
        handle: "@fleet.ops",
        initials: "FO",
        body: "Driver app v4.2 is rolling out this week, includes the updated wallet balance screen and faster ride acceptance.",
        time: "08:02",
        pinned: true
      },
      1
    ),
    seedMessage(
      {
        author: "You",
        handle: me.handle,
        initials: me.initials,
        body: "Good, keep me posted on rollout percentage through the day.",
        time: "08:05",
        mine: true
      },
      2
    )
  ],
  "channel:dispatch": [
    seedMessage(
      {
        author: "Dispatch Lead",
        handle: "@dispatch.lead",
        initials: "DL",
        body: "Morning, dispatch queue is clear. Peak coverage looks tight in Lekki between 5 and 7pm, flagging for extra drivers.",
        time: "09:18",
        pinned: true
      },
      3
    ),
    seedMessage(
      {
        author: "Fleet Ops",
        handle: "@fleet.ops",
        initials: "FO",
        body: "I can shift two drivers over from Ikeja for the evening window.",
        time: "09:24",
        reaction: "✅",
        reactionCount: 2
      },
      4
    ),
    seedMessage(
      {
        author: "You",
        handle: me.handle,
        initials: me.initials,
        body: "Approved. Keep an eye on acceptance time once they move.",
        time: "09:31",
        mine: true
      },
      5
    )
  ],
  "channel:instant-rides": [
    seedMessage(
      {
        author: "Fleet Ops",
        handle: "@fleet.ops",
        initials: "FO",
        body: "Instant Ride acceptance rate is up to 91% after the tier change. Fare tiers 2 and 3 are the biggest movers.",
        time: "10:02"
      },
      6
    )
  ],
  "channel:wallet-payments": [
    seedMessage(
      {
        author: "Payments",
        handle: "@payments",
        initials: "PY",
        body: "Payout batch for last week's driver settlements is queued, here are the staging reference credentials, do not forward this outside the team.",
        time: "09:42",
        locked: true
      },
      7
    )
  ],
  "channel:support": [
    seedMessage(
      {
        author: "Support Lead",
        handle: "@support.lead",
        initials: "SL",
        body: "Three escalations open from yesterday's outage window, all refunded, closing them out this morning.",
        time: "08:47"
      },
      8
    )
  ],
  "dm:@dispatch.lead": [
    seedMessage(
      {
        author: "Dispatch Lead",
        handle: "@dispatch.lead",
        initials: "DL",
        body: "Got a minute to look at the Lekki coverage numbers?",
        time: "09:40"
      },
      9
    )
  ],
  "dm:@fleet.ops": [],
  "dm:@support.lead": [],
  "dm:@payments": []
};
