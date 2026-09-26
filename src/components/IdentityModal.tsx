import { FormEvent, useState } from "react";
import { KeyRound, X } from "lucide-react";

type IdentityModalProps = {
  handle: string;
  pin: string;
  onClose: () => void;
  onSavePin: (pin: string) => void;
};

export function IdentityModal({ handle, pin, onClose, onSavePin }: IdentityModalProps) {
  const [draft, setDraft] = useState(pin);
  const [saved, setSaved] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (draft.length !== 7) return;
    onSavePin(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Your PArA identity">
      <div className="modal glass identity-modal">
        <div className="modal-head">
          <div className="modal-title">
            <KeyRound size={16} />
            <span>Your PArA identity</span>
          </div>
          <button className="icon-button ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="identity-copy">
            People find and add you by your handle. Your PIN is what unlocks any locked
            message sent to you — treat it like a passcode, not a public detail.
          </p>

          <div className="identity-field">
            <span>Handle</span>
            <strong className="identity-handle">{handle}</strong>
          </div>

          <form className="identity-field identity-pin-field" onSubmit={submit}>
            <span>7-digit PIN</span>
            <div className="identity-pin-row">
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={7}
                value={draft}
                onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 7))}
              />
              <button type="submit" disabled={draft.length !== 7}>{saved ? "Saved" : "Save"}</button>
            </div>
          </form>

          <p className="identity-note">
            This PIN is stored only in this browser session for the demo. In production it
            should be set during onboarding, hashed server-side, and never stored or
            transmitted in plain text.
          </p>
        </div>
      </div>
    </div>
  );
}
