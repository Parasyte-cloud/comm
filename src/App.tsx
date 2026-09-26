import { FormEvent, useMemo, useState } from "react";
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
  Search,
  Send,
  Settings,
  Smile,
  Sparkles,
  Users,
  Video,
  X
} from "lucide-react";
import { channels, initialMessages, me, people, type Message } from "./data/mock";
import { Avatar } from "./components/Avatar";
import { MessageItem } from "./components/MessageItem";
import { PinnedPanel } from "./components/PinnedPanel";
import { CallOverlay } from "./components/CallOverlay";
import { IdentityModal } from "./components/IdentityModal";
import "./styles.css";

const spaces = ["PA", "DE", "OP", "CR"];

function App() {
  const [activeChannel, setActiveChannel] = useState("product-design");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [detailOpen, setDetailOpen] = useState(true);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [lockDraft, setLockDraft] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set());
  const [myPin, setMyPin] = useState("4821093");
  const [call, setCall] = useState<{ kind: "audio" | "video" } | null>(null);

  const activeCount = useMemo(() => people.filter((person) => person.status === "online").length, []);
  const pinnedMessages = useMemo(() => messages.filter((message) => message.pinned), [messages]);

  function submitMessage(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        author: "You",
        handle: me.handle,
        initials: "YO",
        body,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mine: true,
        locked: lockDraft
      }
    ]);
    setDraft("");
    setLockDraft(false);
  }

  function togglePin(id: number) {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, pinned: !message.pinned } : message))
    );
  }

  /** A locked message unlocks only when the reader enters the account's
   * 7-digit PIN (set in the Identity panel). Returns whether it matched
   * so the message bubble can show an error instead of silently failing. */
  function attemptUnlock(id: number, pin: string) {
    if (pin !== myPin) return false;
    setRevealedIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
    return true;
  }

  function startCall(kind: "audio" | "video") {
    setCall({ kind });
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />

      <aside className="rail glass">
        <button className="brand-mark" aria-label="PArA home">P</button>
        <div className="rail-divider" />
        {spaces.map((space, index) => (
          <button className={`space-dot ${index === 0 ? "is-active" : ""}`} key={space}>{space}</button>
        ))}
        <button className="space-dot space-dot--add"><Plus size={18} /></button>
        <div className="rail-spacer" />
        <button className="icon-button ghost" onClick={() => setIdentityOpen(true)} title="Your PArA identity"><Settings size={18} /></button>
        <Avatar initials="YO" small />
      </aside>

      <aside className={`sidebar glass ${mobileNav ? "is-open" : ""}`}>
        <div className="sidebar-top">
          <div>
            <span className="eyebrow">Workspace</span>
            <button className="workspace-name">PArA Studio <ChevronDown size={16} /></button>
          </div>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)}><X size={18} /></button>
        </div>

        <button className="search-box"><Search size={17} /><span>Search PArA</span><kbd>⌘ K</kbd></button>

        <nav className="nav-block">
          <button className="nav-row"><MessageCircle size={18} /><span>Threads</span><span className="pill">3</span></button>
          <button className="nav-row" onClick={() => setPinnedOpen(true)}>
            <Pin size={18} /><span>Pinned</span>
            {pinnedMessages.length > 0 && <span className="pill">{pinnedMessages.length}</span>}
          </button>
          <button className="nav-row"><Bell size={18} /><span>Activity</span></button>
          <button className="nav-row"><Sparkles size={18} /><span>Canvas</span></button>
        </nav>

        <div className="section-heading"><span>Channels</span><Plus size={16} /></div>
        <div className="channel-list">
          {channels.map((channel) => (
            <button
              key={channel.name}
              onClick={() => { setActiveChannel(channel.name); setMobileNav(false); }}
              className={`channel-row ${activeChannel === channel.name ? "is-active" : ""}`}
            >
              <Hash size={16} />
              <span>{channel.name}</span>
              {!!channel.unread && <span className="unread">{channel.unread}</span>}
            </button>
          ))}
        </div>

        <div className="section-heading"><span>Direct messages</span><Plus size={16} /></div>
        <div className="dm-list">
          {people.map((person) => (
            <button className="dm-row" key={person.name}>
              <span className={`presence presence--${person.status}`} />
              <Avatar initials={person.initials} small />
              <span className="dm-row-name">
                {person.name}
                <span className="handle">{person.handle}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="huddle-card">
          <div className="huddle-icon"><Headphones size={18} /></div>
          <div>
            <strong>Design huddle</strong>
            <span>3 people live</span>
          </div>
          <button className="join-button" onClick={() => startCall("audio")}>Join</button>
        </div>
      </aside>

      <main className="main-panel glass">
        <header className="chat-header">
          <div className="chat-title-wrap">
            <button className="icon-button menu-button" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
            <div>
              <div className="chat-title"><Hash size={20} /> {activeChannel}</div>
              <div className="chat-subtitle">Design conversations, decisions and polished work.</div>
            </div>
          </div>
          <div className="header-actions">
            <button className="header-chip"><Users size={17} /><span>{activeCount + 3}</span></button>
            <button className="icon-button" onClick={() => startCall("audio")} title="Start voice call"><Mic size={18} /></button>
            <button className="icon-button" onClick={() => startCall("video")} title="Start video call"><Video size={18} /></button>
            <button className="icon-button" onClick={() => setDetailOpen((value) => !value)}><MoreHorizontal size={18} /></button>
          </div>
        </header>

        <section className="messages">
          <div className="channel-intro">
            <div className="channel-icon"><Hash size={28} /></div>
            <h1>{activeChannel}</h1>
            <p>This is the beginning of <strong>#{activeChannel}</strong>. Keep decisions searchable, human and beautifully organised.</p>
          </div>

          {messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              revealed={revealedIds.has(message.id)}
              onTogglePin={togglePin}
              onUnlockAttempt={attemptUnlock}
            />
          ))}
          <div className="typing"><span /><span /><span /> Amara is typing</div>
        </section>

        <form className="composer" onSubmit={submitMessage}>
          <div className="composer-tools">
            <button type="button" className="icon-button ghost"><Plus size={18} /></button>
            <button type="button" className="icon-button ghost"><Paperclip size={18} /></button>
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
            placeholder={lockDraft ? `Locked message to #${activeChannel}` : `Message #${activeChannel}`}
            aria-label="Message"
          />
          <div className="composer-tools">
            <button type="button" className="icon-button ghost"><Smile size={18} /></button>
            <button className="send-button" type="submit"><Send size={17} /></button>
          </div>
        </form>
      </main>

      {detailOpen && (
        <aside className="details glass">
          <div className="details-head">
            <div><span className="eyebrow">Channel</span><strong>Details</strong></div>
            <button className="icon-button ghost" onClick={() => setDetailOpen(false)}><X size={18} /></button>
          </div>

          <div className="focus-card">
            <span className="focus-badge">FOCUS</span>
            <h3>Build the calmest place to communicate.</h3>
            <p>Keep updates clear, calls intentional and decisions easy to find.</p>
          </div>

          <div className="details-section">
            <div className="details-title"><span>Pinned messages</span><button onClick={() => setPinnedOpen(true)}>See all</button></div>
            {pinnedMessages.length === 0 ? (
              <p className="details-empty">Nothing pinned yet.</p>
            ) : (
              <div className="pinned-mini-list">
                {pinnedMessages.slice(0, 2).map((message) => (
                  <button className="pinned-mini-row" key={message.id} onClick={() => setPinnedOpen(true)}>
                    <Pin size={11} />
                    <span>{message.body}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="details-section">
            <div className="details-title"><span>Members</span><button>See all</button></div>
            <div className="member-stack">
              {people.slice(0, 4).map((person) => (
                <div className="member-row" key={person.name}>
                  <div className="member-avatar-wrap">
                    <Avatar initials={person.initials} small />
                    <span className={`presence presence--${person.status}`} />
                  </div>
                  <div><strong>{person.name}</strong><span>{person.handle} · {person.role}</span></div>
                </div>
              ))}
            </div>
          </div>

          <div className="details-section">
            <div className="details-title"><span>Shared media</span><button>View all</button></div>
            <div className="media-grid">
              <div className="media-card media-card--a" />
              <div className="media-card media-card--b" />
              <div className="media-card media-card--c" />
            </div>
          </div>

          <div className="security-note">
            <div className="security-icon">✓</div>
            <div><strong>Private by design</strong><span>Role-ready permissions, guest access, locked messages and secure message architecture.</span></div>
          </div>
        </aside>
      )}

      {pinnedOpen && (
        <PinnedPanel messages={pinnedMessages} onClose={() => setPinnedOpen(false)} onUnpin={togglePin} />
      )}

      {identityOpen && (
        <IdentityModal
          handle={me.handle}
          pin={myPin}
          onClose={() => setIdentityOpen(false)}
          onSavePin={setMyPin}
        />
      )}

      {call && (
        <CallOverlay
          kind={call.kind}
          channelName={activeChannel}
          participants={people}
          onLeave={() => setCall(null)}
        />
      )}
    </div>
  );
}

export default App;
