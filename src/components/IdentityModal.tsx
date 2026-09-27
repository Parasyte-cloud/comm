import { FormEvent, useState } from "react";
import { KeyRound, LogOut, X } from "lucide-react";
import { PIN_LENGTH, sanitizePinInput } from "../lib/pin";
import type { Person } from "../types";

type IdentityModalProps = {
  me: Person;
  onClose: () => void;
  onSavePin: (pin: string) => Promise<void>;
  onSaveProfile: (fields: { name: string; role: string; status: Person["status"] }) => Promise<void>;
  onSignOut: () => void;
};

const STATUS_OPTIONS: Person["status"][] = ["online", "away", "offline"];

export function IdentityModal({ me, onClose, onSavePin, onSaveProfile, onSignOut }: IdentityModalProps) {
  const [pinDraft, setPinDraft] = useState("");
  const [pinSaved, setPinSaved] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSaving, setPinSaving] = useState(false);

  const [name, setName] = useState(me.name);
  const [role, setRole] = useState(me.role);
  const [status, setStatus] = useState<Person["status"]>(me.status);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  async function submitPin(event: FormEvent) {
    event.preventDefault();
    if (pinDraft.length !== PIN_LENGTH || pinSaving) return;
    setPinSaving(true);
    setPinError("");
    try {
      await onSavePin(pinDraft);
      setPinDraft("");
      setPinSaved(true);
      setTimeout(() => setPinSaved(false), 1600);
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "Could not save that PIN.");
    } finally {
      setPinSaving(false);
    }
  }

  async function submitProfile(event: FormEvent) {
    event.preventDefault();
    if (profileSaving) return;
    setProfileSaving(true);
    setProfileError("");
    try {
      await onSaveProfile({ name: name.trim() || me.name, role: role.trim() || me.role, status });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 1600);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setProfileSaving(false);
    }
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
            message, treat it like a passcode, not a public detail.
          </p>

          <div className="identity-field">
            <span>Handle</span>
            <strong className="identity-handle">{me.handle}</strong>
          </div>

          <form className="identity-field" onSubmit={submitProfile}>
            <span>Display name</span>
            <div className="identity-pin-row">
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
            </div>
            <span>Role</span>
            <div className="identity-pin-row">
              <input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Your role" />
            </div>
            <span>Status</span>
            <div className="identity-status-row">
              {STATUS_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={`identity-status-option ${status === option ? "is-active" : ""}`}
                  onClick={() => setStatus(option)}
                >
                  <span className={`presence presence--${option}`} />
                  {option === "online" ? "Online" : option === "away" ? "Away" : "Offline"}
                </button>
              ))}
            </div>
            <button type="submit" disabled={profileSaving} className="identity-save-profile">
              {profileSaving ? "Saving..." : profileSaved ? "Saved" : "Save profile"}
            </button>
            {profileError && <span className="pin-entry-error">{profileError}</span>}
          </form>

          <form className="identity-field identity-pin-field" onSubmit={submitPin}>
            <span>Set or change your {PIN_LENGTH}-digit PIN</span>
            <div className="identity-pin-row">
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={PIN_LENGTH}
                value={pinDraft}
                placeholder={"•".repeat(PIN_LENGTH)}
                onChange={(event) => setPinDraft(sanitizePinInput(event.target.value))}
              />
              <button type="submit" disabled={pinDraft.length !== PIN_LENGTH || pinSaving}>
                {pinSaving ? "Saving..." : pinSaved ? "Saved" : "Save"}
              </button>
            </div>
            {pinError && <span className="pin-entry-error">{pinError}</span>}
          </form>

          <p className="identity-note">
            5 wrong tries locks unlocking out for 30 seconds, across every locked message,
            not just the one you're trying. Your PIN is hashed server-side and never sent
            back to any device once set, not even to you.
          </p>

          <button type="button" className="identity-signout" onClick={onSignOut}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
