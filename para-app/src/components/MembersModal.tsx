import { Users, X } from "lucide-react";
import { Avatar } from "./Avatar";
import type { Person } from "../data/mock";

type MembersModalProps = {
  people: Person[];
  onClose: () => void;
  onMessage: (handle: string) => void;
};

const STATUS_LABEL: Record<Person["status"], string> = {
  online: "Online",
  away: "Away",
  offline: "Offline"
};

export function MembersModal({ people, onClose, onMessage }: MembersModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Members">
      <div className="modal glass">
        <div className="modal-head">
          <div className="modal-title">
            <Users size={16} />
            <span>Members</span>
          </div>
          <button className="icon-button ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {people.map((person) => (
            <button className="member-row-modal" key={person.handle} onClick={() => onMessage(person.handle)}>
              <div className="member-avatar-wrap">
                <Avatar initials={person.initials} small />
                <span className={`presence presence--${person.status}`} />
              </div>
              <div className="member-row-modal-info">
                <strong>{person.name}</strong>
                <span>{person.handle} &middot; {person.role} &middot; {STATUS_LABEL[person.status]}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
