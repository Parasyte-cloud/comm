import { useState } from "react";
import { Mic, MicOff, PhoneOff, ScreenShare, Video, VideoOff } from "lucide-react";
import type { Person } from "../data/mock";

type CallOverlayProps = {
  kind: "audio" | "video";
  channelName: string;
  participants: Person[];
  onLeave: () => void;
};

/**
 * Call surface for PArA.
 *
 * This component only renders local UI state (mute/camera/leave), it holds no
 * transport of its own. To wire it to real calling:
 *
 *   1. On mount, call your signalling layer (RA-workspace call service, or a
 *      WebRTC/SIP gateway) with { channelName, kind, participants } and get
 *      back a session handle.
 *   2. Feed remote audio/video tracks into the tiles below in place of the
 *      placeholder avatars (swap the `.call-tile` divs for <video>/<audio>
 *      elements bound to each participant's MediaStream).
 *   3. Wire `micOn`/`cameraOn` toggles to the session handle's
 *      track.enabled setters, and `onLeave` to session.hangup().
 *
 * Keeping the transport out of this component is deliberate: it lets the
 * same call screen sit behind the web app, the RA-workspace mobile app, or a
 * future desktop client without duplicating UI.
 */
export function CallOverlay({ kind, channelName, participants, onLeave }: CallOverlayProps) {
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(kind === "video");
  const [elapsed] = useState("00:14");

  return (
    <div className="call-overlay">
      <div className="call-frame glass">
        <div className="call-head">
          <div>
            <span className="eyebrow">{kind === "video" ? "Video call" : "Voice call"}</span>
            <strong>#{channelName}</strong>
          </div>
          <span className="call-timer">{elapsed}</span>
        </div>

        <div className="call-grid">
          <div className="call-tile call-tile--self">
            <div className="call-avatar">YO</div>
            <span className="call-name">You {!micOn && <MicOff size={11} />}</span>
          </div>
          {participants.map((person) => (
            <div className="call-tile" key={person.name}>
              <div className="call-avatar">{person.initials}</div>
              <span className="call-name">{person.name.split(" ")[0]}</span>
              <span className={`presence presence--${person.status} call-tile-presence`} />
            </div>
          ))}
        </div>

        <div className="call-controls">
          <button
            className={`call-control ${micOn ? "" : "is-off"}`}
            onClick={() => setMicOn((value) => !value)}
            title={micOn ? "Mute microphone" : "Unmute microphone"}
          >
            {micOn ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          {kind === "video" && (
            <button
              className={`call-control ${cameraOn ? "" : "is-off"}`}
              onClick={() => setCameraOn((value) => !value)}
              title={cameraOn ? "Turn camera off" : "Turn camera on"}
            >
              {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
            </button>
          )}
          <button className="call-control" title="Share screen">
            <ScreenShare size={18} />
          </button>
          <button className="call-control call-control--leave" onClick={onLeave} title="Leave call">
            <PhoneOff size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
