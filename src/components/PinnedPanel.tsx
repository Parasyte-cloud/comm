import { Pin, X } from "lucide-react";
import type { Message } from "../data/mock";

type PinnedPanelProps = {
  messages: Message[];
  onClose: () => void;
  onUnpin: (id: number) => void;
};

export function PinnedPanel({ messages, onClose, onUnpin }: PinnedPanelProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Pinned messages">
      <div className="modal glass">
        <div className="modal-head">
          <div className="modal-title">
            <Pin size={16} />
            <span>Pinned messages</span>
          </div>
          <button className="icon-button ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {messages.length === 0 && (
            <p className="modal-empty">Nothing pinned yet. Pin a message from its hover menu to keep it here.</p>
          )}
          {messages.map((message) => (
            <div className="pinned-row" key={message.id}>
              <div className="pinned-row-meta">
                <strong>{message.author}</strong>
                <time>{message.time}</time>
              </div>
              <p>{message.body}</p>
              <button className="pinned-unpin" onClick={() => onUnpin(message.id)}>
                Unpin
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
