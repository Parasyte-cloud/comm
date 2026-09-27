import { FormEvent, useState } from "react";
import { Hash, X } from "lucide-react";

type CreateChannelModalProps = {
  existingIds: string[];
  onClose: () => void;
  onCreate: (name: string) => void;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function CreateChannelModal({ existingIds, onClose, onCreate }: CreateChannelModalProps) {
  const [name, setName] = useState("");
  const slug = slugify(name);
  const isDuplicate = slug.length > 0 && existingIds.includes(slug);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!slug || isDuplicate) return;
    onCreate(slug);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Create a channel">
      <div className="modal glass identity-modal">
        <div className="modal-head">
          <div className="modal-title">
            <Hash size={16} />
            <span>Create a channel</span>
          </div>
          <button className="icon-button ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <form className="identity-field" onSubmit={submit}>
            <span>Channel name</span>
            <div className="identity-pin-row">
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. driver-incentives"
              />
              <button type="submit" disabled={!slug || isDuplicate}>
                Create
              </button>
            </div>
            {slug && <span className="create-channel-preview">#{slug}</span>}
            {isDuplicate && <span className="pin-entry-error">#{slug} already exists.</span>}
          </form>
        </div>
      </div>
    </div>
  );
}
