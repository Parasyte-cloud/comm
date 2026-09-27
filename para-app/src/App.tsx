import { FormEvent, Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronDown,
  Hash,
  Headphones,
  Lock,
  Menu,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Paperclip,
  Pin,
  Plus,
  PhoneCall,
  Search,
  Send,
  Settings,
  Smile,
  Sparkles,
  Users,
  Video,
  X
} from "lucide-react";
import { channels as seedChannels, initialThreads, me, people, type Channel, type Message } from "./data/mock";
import { conversationKey, type ConversationRef } from "./lib/conversation";
import { Avatar } from "./components/Avatar";
import { MessageItem } from "./components/MessageItem";
import { PinnedPanel, type PinnedEntry } from "./components/PinnedPanel";
import { JoinCallModal } from "./components/JoinCallModal";
import { IdentityModal } from "./components/IdentityModal";
import { MembersModal } from "./components/MembersModal";
import { CreateChannelModal } from "./components/CreateChannelModal";
import { usePinGuard } from "./lib/pin";
import "./styles.css";

// RealtimeKit's meeting UI is a large bundle of its own. Loading it only
// when someone actually starts or joins a call keeps the rest of the chat
// app light, the same reason RA-workspace lazy-loads its equivalent
// RoomMeeting component.
const CallOverlay = lazy(() => import("./components/CallOverlay").then((m) => ({ default: m.CallOverlay })));

function userIdFromHandle(handle: string) {
  return handle.replace(/^@/, "");
}

function conversationLabel(ref: ConversationRef, channels: Channel[]): string {
  if (ref.kind === "channel") {
    const channel = channels.find((c) => c.id === ref.id);
    return `#${channel?.name ?? ref.id}`;
  }
  const person = people.find((p) => p.handle === ref.handle);
  return person?.name ?? ref.handle;
}

function App() {
  const [channels, setChannels] = useState<Channel[]>(seedChannels);
  const [activeConversation, setActiveConversation] = useState<ConversationRef>({ kind: "channel", id: "dispatch" });
  const [threads, setThreads] = useState<Record<string, Message[]>>(initialThreads);
  const [draft, setDraft] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [detailOpen, setDetailOpen] = useState(true);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [joinCallOpen, setJoinCallOpen] = useState(false);
  const [lockDraft, setLockDraft] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set());
  const [myPin, setMyPin] = useState("4821093");
  const [call, setCall] = useState<{ kind: "audio" | "video"; joinMeetingId?: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const pinGuard = usePinGuard(myPin);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  function notify(message: string) {
    setToast(message);
  }

  const currentKey = conversationKey(activeConversation);
  const currentMessages = threads[currentKey] ?? [];
  const activeChannel = activeConversation.kind === "channel" ? channels.find((c) => c.id === activeConversation.id) : null;
  const activePerson = activeConversation.kind === "dm" ? people.find((p) => p.handle === activeConversation.handle) : null;

  const activeCount = useMemo(() => people.filter((person) => person.status === "online").length, []);

  const pinnedEntries = useMemo<PinnedEntry[]>(() => {
    const entries: PinnedEntry[] = [];
    Object.entries(threads).forEach(([key, msgs]) => {
      msgs.forEach((message) => {
        if (message.pinned) {
          const ref: ConversationRef = key.startsWith("channel:")
            ? { kind: "channel", id: key.slice("channel:".length) }
            : { kind: "dm", handle: key.slice("dm:".length) };
          entries.push({ convKey: key, convLabel: conversationLabel(ref, channels), message });
        }
      });
    });
    return entries;
  }, [threads, channels]);

  const filteredChannels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return channels;
    return channels.filter((c) => c.name.toLowerCase().includes(query));
  }, [channels, searchQuery]);

  const filteredPeople = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return people;
    return people.filter((p) => p.name.toLowerCase().includes(query) || p.handle.toLowerCase().includes(query));
  }, [searchQuery]);

  function updateThread(convKey: string, updater: (messages: Message[]) => Message[]) {
    setThreads((current) => ({ ...current, [convKey]: updater(current[convKey] ?? []) }));
  }

  function submitMessage(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    updateThread(currentKey, (messages) => [
      ...messages,
      {
        id: Date.now(),
        author: "You",
        handle: me.handle,
        initials: me.initials,
        body,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mine: true,
        locked: lockDraft
      }
    ]);
    setDraft("");
    setLockDraft(false);
  }

  function togglePin(convKey: string, id: number) {
    updateThread(convKey, (messages) =>
      messages.map((message) => (message.id === id ? { ...message, pinned: !message.pinned } : message))
    );
  }

  function reactToMessage(convKey: string, id: number) {
    updateThread(convKey, (messages) =>
      messages.map((message) =>
        message.id === id
          ? { ...message, reaction: message.reaction ?? "\u{1F44D}", reactionCount: (message.reactionCount ?? 0) + 1 }
          : message
      )
    );
  }

  /** A locked message unlocks only when the reader enters the account's
   * 7-digit PIN (set in the Identity panel). Routed through the shared
   * pin guard so repeated wrong guesses lock out ALL locked messages for
   * a cooldown, not just the one being attacked. */
  function attemptUnlock(convKey: string, id: number, pin: string) {
    const ok = pinGuard.verify(pin);
    if (!ok) return false;
    setRevealedIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
    return true;
  }

  function selectChannel(id: string) {
    setActiveConversation({ kind: "channel", id });
    setMobileNav(false);
  }

  function selectDM(handle: string) {
    setActiveConversation({ kind: "dm", handle });
    setMobileNav(false);
  }

  function createChannel(id: string) {
    setChannels((current) => [...current, { id, name: id, topic: "New channel." }]);
    setThreads((current) => ({ ...current, [`channel:${id}`]: [] }));
    setActiveConversation({ kind: "channel", id });
    setCreateChannelOpen(false);
  }

  function startCall(kind: "audio" | "video") {
    setCall({ kind });
  }

  function joinCallByCode(meetingId: string) {
    setJoinCallOpen(false);
    setCall({ kind: "video", joinMeetingId: meetingId });
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />

      <aside className="rail glass">
        <button className="brand-mark" aria-label="RideArrivo Ops home">
          <img src="/logo-mark.png" alt="" />
        </button>
        <div className="rail-divider" />
        <button className="space-dot is-active" onClick={() => notify("Multiple workspaces are coming soon.")}>RA</button>
        <button className="space-dot space-dot--add" onClick={() => notify("Multiple workspaces are coming soon.")}>
          <Plus size={18} />
        </button>
        <div className="rail-spacer" />
        <button className="icon-button ghost" onClick={() => setIdentityOpen(true)} title="Your PArA identity">
          <Settings size={18} />
        </button>
        <Avatar initials={me.initials} small />
      </aside>

      <aside className={`sidebar glass ${mobileNav ? "is-open" : ""}`}>
        <div className="sidebar-top">
          <div>
            <span className="eyebrow">Workspace</span>
            <button className="workspace-name" onClick={() => notify("Multiple workspaces are coming soon.")}>
              RideArrivo Ops <ChevronDown size={16} />
            </button>
          </div>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="search-box search-box--live">
          <Search size={17} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search channels and people"
          />
          {searchQuery ? (
            <button className="search-clear" onClick={() => setSearchQuery("")}>
              <X size={13} />
            </button>
          ) : (
            <kbd>&#8984; K</kbd>
          )}
        </div>

        <nav className="nav-block">
          <button className="nav-row" onClick={() => notify("Threads are coming soon.")}>
            <MessageCircle size={18} /><span>Threads</span><span className="pill">3</span>
          </button>
          <button className="nav-row" onClick={() => setPinnedOpen(true)}>
            <Pin size={18} /><span>Pinned</span>
            {pinnedEntries.length > 0 && <span className="pill">{pinnedEntries.length}</span>}
          </button>
          <button className="nav-row" onClick={() => notify("Activity is coming soon.")}>
            <Bell size={18} /><span>Activity</span>
          </button>
          <button className="nav-row" onClick={() => notify("Canvas is coming soon.")}>
            <Sparkles size={18} /><span>Canvas</span>
          </button>
          <button className="nav-row" onClick={() => setJoinCallOpen(true)}>
            <PhoneCall size={18} /><span>Join a call</span>
          </button>
        </nav>

        <div className="section-heading">
          <span>Channels</span>
          <button onClick={() => setCreateChannelOpen(true)} title="Create a channel">
            <Plus size={16} />
          </button>
        </div>
        <div className="channel-list">
          {filteredChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => selectChannel(channel.id)}
              className={`channel-row ${activeConversation.kind === "channel" && activeConversation.id === channel.id ? "is-active" : ""}`}
            >
              <Hash size={16} />
              <span>{channel.name}</span>
            </button>
          ))}
          {filteredChannels.length === 0 && <p className="empty-hint">No channels match "{searchQuery}".</p>}
        </div>

        <div className="section-heading">
          <span>Direct messages</span>
          <button onClick={() => notify("Inviting teammates is coming soon.")} title="Add a teammate">
            <Plus size={16} />
          </button>
        </div>
        <div className="dm-list">
          {filteredPeople.map((person) => (
            <button
              className={`dm-row ${activeConversation.kind === "dm" && activeConversation.handle === person.handle ? "is-active" : ""}`}
              key={person.handle}
              onClick={() => selectDM(person.handle)}
            >
              <span className={`presence presence--${person.status}`} />
              <Avatar initials={person.initials} small />
              <span className="dm-row-name">
                {person.name}
                <span className="handle">{person.handle}</span>
              </span>
            </button>
          ))}
          {filteredPeople.length === 0 && <p className="empty-hint">No one matches "{searchQuery}".</p>}
        </div>

        <div className="huddle-card">
          <div className="huddle-icon">
            <Headphones size={18} />
          </div>
          <div>
            <strong>Dispatch huddle</strong>
            <span>Start a live call</span>
          </div>
          <button className="join-button" onClick={() => startCall("audio")}>
            Start
          </button>
        </div>
      </aside>

      <main className="main-panel glass">
        <header className="chat-header">
          <div className="chat-title-wrap">
            <button className="icon-button menu-button" onClick={() => setMobileNav(true)}>
              <Menu size={20} />
            </button>
            {activeConversation.kind === "channel" ? (
              <div>
                <div className="chat-title">
                  <Hash size={20} /> {activeChannel?.name ?? activeConversation.id}
                </div>
                <div className="chat-subtitle">{activeChannel?.topic}</div>
              </div>
            ) : (
              <div>
                <div className="chat-title">
                  {activePerson?.name ?? activeConversation.handle}
                </div>
                <div className="chat-subtitle">
                  {activeConversation.handle}
                  {activePerson && ` · ${activePerson.status === "online" ? "Online" : activePerson.status === "away" ? "Away" : "Offline"}`}
                </div>
              </div>
            )}
          </div>
          <div className="header-actions">
            {activeConversation.kind === "channel" && (
              <button className="header-chip" onClick={() => setMembersOpen(true)}>
                <Users size={17} />
                <span>{activeCount + 1}</span>
              </button>
            )}
            <button className="icon-button" onClick={() => startCall("audio")} title="Start voice call">
              <Mic size={18} />
            </button>
            <button className="icon-button" onClick={() => startCall("video")} title="Start video call">
              <Video size={18} />
            </button>
            <button className="icon-button" onClick={() => setDetailOpen((value) => !value)}>
              <MoreHorizontal size={18} />
            </button>
          </div>
        </header>

        <section className="messages">
          <div className="channel-intro">
            <div className="channel-icon">
              {activeConversation.kind === "channel" ? <Hash size={28} /> : <Avatar initials={activePerson?.initials ?? "?"} />}
            </div>
            <h1>{activeConversation.kind === "channel" ? activeChannel?.name : activePerson?.name}</h1>
            <p>
              {activeConversation.kind === "channel"
                ? activeChannel?.topic
                : `Direct messages between you and ${activePerson?.name ?? activeConversation.handle} are only visible to the two of you.`}
            </p>
          </div>

          {currentMessages.length === 0 && (
            <p className="empty-hint empty-hint--conversation">No messages here yet. Say hello.</p>
          )}

          {currentMessages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              revealed={revealedIds.has(message.id)}
              onTogglePin={(id) => togglePin(currentKey, id)}
              onUnlockAttempt={(id, pin) => attemptUnlock(currentKey, id, pin)}
              onReact={(id) => reactToMessage(currentKey, id)}
              pinLocked={pinGuard.isLocked}
              pinLockSeconds={pinGuard.secondsLeft}
            />
          ))}
        </section>

        <form className="composer" onSubmit={submitMessage}>
          <div className="composer-tools">
            <button type="button" className="icon-button ghost" onClick={() => notify("Attachments are coming soon.")}>
              <Plus size={18} />
            </button>
            <button type="button" className="icon-button ghost" onClick={() => notify("Attachments are coming soon.")}>
              <Paperclip size={18} />
            </button>
            <button
              type="button"
              className={`icon-button ghost ${lockDraft ? "is-locked" : ""}`}
              onClick={() => setLockDraft((value) => !value)}
              title={lockDraft ? "Sending as a locked message" : "Send as locked message"}
            >
              <Lock size={18} />
            </button>
          </div>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={lockDraft ? `Locked message to ${conversationLabel(activeConversation, channels)}` : `Message ${conversationLabel(activeConversation, channels)}`}
            aria-label="Message"
          />
          <div className="composer-tools">
            <button type="button" className="icon-button ghost" onClick={() => notify("Emoji picker is coming soon.")}>
              <Smile size={18} />
            </button>
            <button className="send-button" type="submit">
              <Send size={17} />
            </button>
          </div>
        </form>
      </main>

      {detailOpen && (
        <aside className="details glass">
          <div className="details-head">
            <div>
              <span className="eyebrow">{activeConversation.kind === "channel" ? "Channel" : "Direct message"}</span>
              <strong>Details</strong>
            </div>
            <button className="icon-button ghost" onClick={() => setDetailOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="focus-card">
            <span className="focus-badge">FOCUS</span>
            <h3>Keep operations calm and coordinated.</h3>
            <p>Dispatch decisions, payments, and support escalations stay searchable in one place.</p>
          </div>

          <div className="details-section">
            <div className="details-title">
              <span>Pinned messages</span>
              <button onClick={() => setPinnedOpen(true)}>See all</button>
            </div>
            {pinnedEntries.length === 0 ? (
              <p className="details-empty">Nothing pinned yet.</p>
            ) : (
              <div className="pinned-mini-list">
                {pinnedEntries.slice(0, 2).map(({ convKey, message }) => (
                  <button className="pinned-mini-row" key={`${convKey}:${message.id}`} onClick={() => setPinnedOpen(true)}>
                    <Pin size={11} />
                    <span>{message.body}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="details-section">
            <div className="details-title">
              <span>Members</span>
              <button onClick={() => setMembersOpen(true)}>See all</button>
            </div>
            <div className="member-stack">
              {people.slice(0, 4).map((person) => (
                <button className="member-row" key={person.handle} onClick={() => selectDM(person.handle)}>
                  <div className="member-avatar-wrap">
                    <Avatar initials={person.initials} small />
                    <span className={`presence presence--${person.status}`} />
                  </div>
                  <div>
                    <strong>{person.name}</strong>
                    <span>
                      {person.handle} &middot; {person.role}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="details-section">
            <div className="details-title">
              <span>Shared media</span>
              <button onClick={() => notify("No shared files in this conversation yet.")}>View all</button>
            </div>
            <p className="details-empty">Nothing shared here yet.</p>
          </div>

          <div className="security-note">
            <div className="security-icon">&#10003;</div>
            <div>
              <strong>Private by design</strong>
              <span>Role-ready permissions, guest access, locked messages, and secure message architecture.</span>
            </div>
          </div>
        </aside>
      )}

      {pinnedOpen && (
        <PinnedPanel
          entries={pinnedEntries}
          onClose={() => setPinnedOpen(false)}
          onUnpin={(convKey, id) => togglePin(convKey, id)}
        />
      )}

      {identityOpen && (
        <IdentityModal handle={me.handle} pin={myPin} onClose={() => setIdentityOpen(false)} onSavePin={setMyPin} />
      )}

      {membersOpen && (
        <MembersModal
          people={people}
          onClose={() => setMembersOpen(false)}
          onMessage={(handle) => {
            selectDM(handle);
            setMembersOpen(false);
          }}
        />
      )}

      {createChannelOpen && (
        <CreateChannelModal
          existingIds={channels.map((c) => c.id)}
          onClose={() => setCreateChannelOpen(false)}
          onCreate={createChannel}
        />
      )}

      {joinCallOpen && <JoinCallModal onClose={() => setJoinCallOpen(false)} onJoin={joinCallByCode} />}

      {call && (
        <Suspense
          fallback={
            <div className="call-overlay">
              <div className="call-state">
                <div className="call-spinner" />
              </div>
            </div>
          }
        >
          <CallOverlay
            kind={call.kind}
            channelName={activeChannel?.name ?? conversationLabel(activeConversation, channels)}
            myHandle={me.handle}
            myUserId={userIdFromHandle(me.handle)}
            joinMeetingId={call.joinMeetingId}
            onLeave={() => setCall(null)}
          />
        </Suspense>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;
