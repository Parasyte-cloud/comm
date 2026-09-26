import { FormEvent, useState } from "react";
import { Lock, Pin, Reply, SmilePlus } from "lucide-react";
import { Avatar } from "./Avatar";
import type { Message } from "../data/mock";

type MessageItemProps = {
  message: Message;
  revealed: boolean;
  onTogglePin: (id: number) => void;
  onUnlockAttempt: (id: number, pin: string) => boolean;
};

export function MessageItem({ message, revealed, onTogglePin, onUnlockAttempt }: MessageItemProps) {
  const [unlocking, setUnlocking] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [error, setError] = useState(false);

  const isLockedAndHidden = message.locked && !revealed;

  function submitPin(event: FormEvent) {
    event.preventDefault();
    const ok = onUnlockAttempt(message.id, pinValue);
    if (ok) {
      setUnlocking(false);
      setPinValue("");
      setError(false);
    } else {
      setError(true);
      setPinValue("");
    }
  }

  return (
    <article className={`message ${message.mine ? "message--mine" : ""}`}>
      <Avatar initials={message.initials} />
      <div className="message-card">
        <div className="message-meta">
          <strong>{message.author}</strong>
          <span className="handle">{message.handle}</span>
          <time>{message.time}</time>
          {message.pinned && (
            <span className="badge badge--pin">
              <Pin size={10} /> Pinned
            </span>
          )}
          {message.locked && (
            <span className="badge badge--lock">
              <Lock size={10} /> Locked
            </span>
          )}
        </div>

        {isLockedAndHidden ? (
          unlocking ? (
            <form className={`pin-entry ${error ? "is-error" : ""}`} onSubmit={submitPin}>
              <input
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={7}
                placeholder="7-digit PIN"
                value={pinValue}
                onChange={(event) => {
                  setError(false);
                  setPinValue(event.target.value.replace(/\D/g, "").slice(0, 7));
                }}
              />
              <button type="submit" disabled={pinValue.length !== 7}>Unlock</button>
              <button
                type="button"
                className="pin-entry-cancel"
                onClick={() => { setUnlocking(false); setPinValue(""); setError(false); }}
              >
                Cancel
              </button>
              {error && <span className="pin-entry-error">Wrong PIN, try again.</span>}
            </form>
          ) : (
            <button className="locked-body" onClick={() => setUnlocking(true)}>
              <Lock size={14} />
              <span>Locked message — tap to unlock</span>
            </button>
          )
        ) : (
          <p className={message.locked ? "revealed-body" : undefined}>{message.body}</p>
        )}

        {message.reaction && <button className="reaction">{message.reaction}</button>}

        <div className="message-actions">
          <button
            className={`message-action ${message.pinned ? "is-active" : ""}`}
            onClick={() => onTogglePin(message.id)}
            title={message.pinned ? "Unpin message" : "Pin message"}
          >
            <Pin size={13} />
          </button>
          <button className="message-action" title="Reply in thread">
            <Reply size={13} />
          </button>
          <button className="message-action" title="Add reaction">
            <SmilePlus size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}
