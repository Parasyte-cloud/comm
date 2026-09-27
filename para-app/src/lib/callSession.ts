import { supabase } from "./supabase";

/**
 * Thin client for the `call-session` Supabase Edge Function. That function
 * is the only place holding Cloudflare RealtimeKit credentials, this file
 * never sees them. See PARA-CALLING-SETUP.md for what to deploy and which
 * secrets the function expects.
 */

export type CallRole = "host" | "member";

export type CallSession = {
  meetingId: string;
  participantId: string;
  authToken: string;
  role: CallRole;
};

type CreateCallInput = {
  action: "create";
  title: string;
  handle: string;
  userId: string;
};

type JoinCallInput = {
  action: "join";
  meetingId: string;
  handle: string;
  userId: string;
};

type EndCallInput = {
  action: "end";
  meetingId: string;
};

async function invokeCallSession(body: CreateCallInput | JoinCallInput | EndCallInput) {
  const { data, error } = await supabase.functions.invoke("call-session", { body });
  if (error) {
    throw new Error(error.message || "Could not reach the calling service.");
  }
  if (!data || data.error) {
    throw new Error(data?.error || "The calling service returned an unexpected response.");
  }
  return data;
}

/** Start a brand new call as its host. Returns a meeting ID worth showing
 * to the other person (or channel) so they can join the same call. */
export async function createCall(title: string, handle: string, userId: string): Promise<CallSession> {
  const data = await invokeCallSession({ action: "create", title, handle, userId });
  return {
    meetingId: data.meetingId,
    participantId: data.participantId,
    authToken: data.authToken,
    role: "host"
  };
}

/** Join a call someone else already started, given its meeting ID. */
export async function joinCall(meetingId: string, handle: string, userId: string): Promise<CallSession> {
  const data = await invokeCallSession({ action: "join", meetingId, handle, userId });
  return {
    meetingId,
    participantId: data.participantId,
    authToken: data.authToken,
    role: "member"
  };
}

/** Ends the call for everyone. Only meaningful for the host; a member
 * leaving should just call meeting.leave() on the RealtimeKit client. */
export async function endCall(meetingId: string): Promise<void> {
  await invokeCallSession({ action: "end", meetingId });
}
