import { useEffect, useRef, useState } from "react";
import { Check, Copy, PhoneOff } from "lucide-react";
import { RealtimeKitProvider, useRealtimeKitClient } from "@cloudflare/realtimekit-react";
import { RtkMeeting } from "@cloudflare/realtimekit-react-ui";
import { createCall, endCall, joinCall, type CallSession } from "../lib/callSession";

type CallOverlayProps = {
  kind: "audio" | "video";
  channelName: string;
  myHandle: string;
  myUserId: string;
  /** Set when joining a call someone else already started. Omit to start
   * a brand new one. */
  joinMeetingId?: string;
  onLeave: () => void;
};

/**
 * Real call surface for PArA, backed by Cloudflare RealtimeKit, the same
 * calling provider RA-workspace already runs in production. This talks to
 * the `call-session` Supabase Edge Function to get a short-lived
 * participant token, then hands that token to RealtimeKit's own client and
 * prebuilt meeting UI. See PARA-BACKEND-SETUP.md for what needs deploying
 * before this works end to end.
 */
export function CallOverlay({ kind, channelName, myHandle, myUserId, joinMeetingId, onLeave }: CallOverlayProps) {
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [session, setSession] = useState<CallSession | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const sessionRef = useRef<CallSession | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const result = joinMeetingId
          ? await joinCall(joinMeetingId, myHandle, myUserId)
          : await createCall(`#${channelName}`, myHandle, myUserId);
        if (!active) return;
        sessionRef.current = result;
        setSession(result);
        await initMeeting({
          authToken: result.authToken,
          defaults: { audio: true, video: kind === "video" }
        });
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not start the call.");
      }
    })();

    return () => {
      active = false;
    };
    // Runs once per mount, joining/creating again on prop changes would
    // start a second meeting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If RealtimeKit itself ends the room (host left, meeting deactivated),
  // close the overlay instead of leaving a dead call screen up.
  useEffect(() => {
    const self = meeting?.self;
    if (!self) return;
    const handleRoomLeft = () => onLeave();
    self.on("roomLeft", handleRoomLeft as never);
    return () => {
      self.removeListener("roomLeft", handleRoomLeft as never);
    };
  }, [meeting, onLeave]);

  async function leave() {
    try {
      await meeting?.leave();
    } catch {
      // Leaving regardless of whether the SDK call succeeded.
    }
    if (sessionRef.current?.role === "host") {
      endCall(sessionRef.current.meetingId).catch(() => {});
    }
    onLeave();
  }

  function copyCode() {
    if (!session) return;
    navigator.clipboard
      ?.writeText(session.meetingId)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  }

  return (
    <div className="call-overlay">
      <div className="call-frame glass">
        <div className="call-head">
          <div>
            <span className="eyebrow">{kind === "video" ? "Video call" : "Voice call"}</span>
            <strong>#{channelName}</strong>
          </div>
          {session && (
            <button className="call-code" onClick={copyCode} title="Copy meeting code to invite someone">
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {session.meetingId.slice(0, 8)}
            </button>
          )}
        </div>

        <div className="call-surface">
          {error ? (
            <div className="call-state call-state--error">
              <p>{error}</p>
              <button className="call-control call-control--leave" onClick={onLeave}>
                Close
              </button>
            </div>
          ) : !meeting ? (
            <div className="call-state">
              <div className="call-spinner" />
              <p>Connecting...</p>
            </div>
          ) : (
            <RealtimeKitProvider value={meeting}>
              <RtkMeeting meeting={meeting} mode="fill" showSetupScreen leaveOnUnmount={false} />
            </RealtimeKitProvider>
          )}
        </div>

        <div className="call-controls">
          <button className="call-control call-control--leave" onClick={leave} title="Leave call">
            <PhoneOff size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
