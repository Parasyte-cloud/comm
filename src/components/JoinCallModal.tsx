import { FormEvent, useState } from "react";
import { PhoneCall, X } from "lucide-react";

type JoinCallModalProps = {
  onClose: () => void;
  onJoin: (meetingId: string) => void;
};

export function JoinCallModal({ onClose, onJoin }: JoinCallModalProps) {
  const [code, setCode] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    onJoin(trimmed);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Join a call">
      <div className="modal glass identity-modal">
        <div className="modal-head">
          <div className="modal-title">
            <PhoneCall size={16} />
            <span>Join a call</span>
          </div>
          <button className="icon-button ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="identity-copy">
            Paste the meeting code someone shared with you from their call screen.
          </p>
          <form className="identity-field identity-pin-field" onSubmit={submit}>
            <span>Meeting code</span>
            <div className="identity-pin-row">
              <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="e.g. 8f3a2c1d" />
              <button type="submit" disabled={!code.trim()}>
                Join
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
