// call-session: mints Cloudflare RealtimeKit meetings and participant
// tokens for PArA calls. This is the ONLY place that holds the RealtimeKit
// API token, everything on the client only ever sees a short-lived
// per-participant auth token, never the account credentials.
//
// Deploy with the Supabase CLI:
//   supabase functions deploy call-session
//
// Required secrets (set with `supabase secrets set NAME=value`), using the
// exact same names RA-workspace uses so you can copy the same values from
// its Cloudflare RealtimeKit app straight across:
//   CLOUDFLARE_ACCOUNT_ID
//   CLOUDFLARE_REALTIMEKIT_APP_ID
//   CLOUDFLARE_REALTIMEKIT_API_TOKEN
//   CLOUDFLARE_REALTIMEKIT_HOST_PRESET
//   CLOUDFLARE_REALTIMEKIT_PARTICIPANT_PRESET
//
// See PARA-CALLING-SETUP.md at the repo root for the full setup walkthrough.

type MediaConfig = {
  accountId: string;
  appId: string;
  apiToken: string;
  hostPreset: string;
  memberPreset: string;
};

type RequestBody =
  | { action: "create"; title: string; handle: string; userId: string }
  | { action: "join"; meetingId: string; handle: string; userId: string }
  | { action: "end"; meetingId: string };

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
  "content-type": "application/json; charset=utf-8"
};

function json(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), { status, headers: CORS_HEADERS });
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function getMediaConfig(): MediaConfig | null {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID")?.trim() || "";
  const appId = Deno.env.get("CLOUDFLARE_REALTIMEKIT_APP_ID")?.trim() || "";
  const apiToken = Deno.env.get("CLOUDFLARE_REALTIMEKIT_API_TOKEN")?.trim() || "";
  const hostPreset = Deno.env.get("CLOUDFLARE_REALTIMEKIT_HOST_PRESET")?.trim() || "";
  const memberPreset = Deno.env.get("CLOUDFLARE_REALTIMEKIT_PARTICIPANT_PRESET")?.trim() || "";
  if (!accountId || !appId || !apiToken || !hostPreset || !memberPreset) return null;
  return { accountId, appId, apiToken, hostPreset, memberPreset };
}

async function realtimeRequest(config: MediaConfig, path: string, init: RequestInit) {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/realtime/kit/${encodeURIComponent(config.appId)}${path}`;
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.success === false) {
    console.error("RealtimeKit request failed", { status: response.status, path, errors: payload?.errors || null });
    throw new Error("PArA calling provider request failed.");
  }
  return payload.data;
}

async function createMeeting(config: MediaConfig, title: string): Promise<string> {
  const data = await realtimeRequest(config, "/meetings", {
    method: "POST",
    body: JSON.stringify({
      title: cleanText(title, 160) || "PArA call",
      status: "ACTIVE",
      persist_chat: false,
      record_on_start: false,
      session_keep_alive_time_in_secs: 600
    })
  });
  const id = cleanText(data?.id, 160);
  if (!id) throw new Error("PArA calling provider did not return a meeting ID.");
  return id;
}

async function addParticipant(
  config: MediaConfig,
  meetingId: string,
  input: { userId: string; name: string; preset: string }
): Promise<{ participantId: string; token: string }> {
  const data = await realtimeRequest(config, `/meetings/${encodeURIComponent(meetingId)}/participants`, {
    method: "POST",
    body: JSON.stringify({
      name: cleanText(input.name, 100) || "PArA member",
      preset_name: input.preset,
      custom_participant_id: input.userId
    })
  });
  const participantId = cleanText(data?.id, 160);
  const token = cleanText(data?.token, 10000);
  if (!participantId || !token) {
    throw new Error("PArA calling provider did not return a participant session.");
  }
  return { participantId, token };
}

async function deactivateMeeting(config: MediaConfig, meetingId: string) {
  await realtimeRequest(config, `/meetings/${encodeURIComponent(meetingId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "INACTIVE" })
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  const config = getMediaConfig();
  if (!config) {
    return json(500, {
      error: "Calling is not configured yet. Set the CLOUDFLARE_REALTIMEKIT_* secrets, see PARA-CALLING-SETUP.md."
    });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  try {
    if (body.action === "create") {
      const meetingId = await createMeeting(config, body.title);
      const { participantId, token } = await addParticipant(config, meetingId, {
        userId: body.userId,
        name: body.handle,
        preset: config.hostPreset
      });
      return json(200, { meetingId, participantId, authToken: token });
    }

    if (body.action === "join") {
      const { participantId, token } = await addParticipant(config, body.meetingId, {
        userId: body.userId,
        name: body.handle,
        preset: config.memberPreset
      });
      return json(200, { meetingId: body.meetingId, participantId, authToken: token });
    }

    if (body.action === "end") {
      await deactivateMeeting(config, body.meetingId);
      return json(200, { ok: true });
    }

    return json(400, { error: "Unknown action." });
  } catch (error) {
    return json(502, { error: error instanceof Error ? error.message : "Unexpected calling error." });
  }
});
