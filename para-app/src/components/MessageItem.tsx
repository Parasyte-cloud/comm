import { FormEvent, useEffect, useState } from "react";
import { Lock, Pin, Reply, SmilePlus } from "lucide-react";
import { Avatar } from "./Avatar";
import type { Message } from "../data/mock";
import { PIN_LENGTH, sanitizePinInput } from "../lib/pin";

type MessageItemProps = {
  message: Message;
  revealed: boolean;
  onTogglePin: (id: number) => void;
  onUnlockAttempt: (id: number, pin: string) => boolean;
  onReact: (id: number) => void;
  pinLocked: boolean;
  pinLockSeconds: number;
};

export function MessageItem({
  message,
  revealed,
  onTogglePin,
  onUnlockAttempt,
  onReact,
  pinLocked,
  pinLockSeconds
}: MessageItemProps) {
  const [unlocking, setUnlocking] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [error, setError] = useState(false);

  // If the shared guard locks out mid-attempt (five wrong guesses across
  // any locked message), drop out of the input state and show the cooldown.
  useEffect(() => {
    if (pinLocked) setPinValue("");
  }, [pinLocked]);

  const isLockedAndHidden = message.locked && !revealed;

  function submitPin(event: FormEvent) {
    event.preventDefault();
    if (pinLocked) return;
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
                maxLength={PIN_LENGTH}
                placeholder={`${PIN_LENGTH}-digit PIN`}
                value={pinValue}
                disabled={pinLocked}
                onChange={(event) => {
                  setError(false);
                  setPinValue(sanitizePinInput(event.target.value));
                }}
              />
              <button type="submit" disabled={pinLocked || pinValue.length !== PIN_LENGTH}>Unlock</button>
              <button
                type="button"
                className="pin-entry-cancel"
                onClick={() => { setUnlocking(false); setPinValue(""); setError(false); }}
              >
                Cancel
              </button>
              {pinLocked ? (
                <span className="pin-entry-error">Too many wrong tries. Try again in {pinLockSeconds}s.</span>
              ) : (
                error && <span className="pin-entry-error">Wrong PIN, try again.</span>
              )}
            </form>
          ) : (
            <button className="locked-body" onClick={() => setUnlocking(true)}>
              <Lock size={14} />
              <span>Locked message, tap to unlock</span>
            </button>
          )
        ) : (
          <p className={message.locked ? "revealed-body" : undefined}>{message.body}</p>
        )}

        {message.reaction && (
          <button className="reaction" onClick={() => onReact(message.id)} title="Add your reaction">
            {message.reaction} {message.reactionCount ?? 1}
          </button>
        )}

        <div className="message-actions">
          <button
            className={`message-action ${message.pinned ? "is-active" : ""}`}
            onClick={() => onTogglePin(message.id)}
            title={message.pinned ? "Unpin message" : "Pin message"}
          >
            <Pin size={13} />
          </button>
          <button className="message-action" title="Threaded replies are coming soon">
            <Reply size={13} />
          </button>
          <button className="message-action" onClick={() => onReact(message.id)} title="React">
            <SmilePlus size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}
