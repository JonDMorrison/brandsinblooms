// Talks to a deployed bloom-assist edge function as a real signed-in user.
// Request shape: supabase/functions/bloom-assist/index.ts parseBloomAssistRequest.

import { createClient } from "@supabase/supabase-js";
import { readSseStream } from "./sse.mjs";
import { buildTranscript } from "./transcript.mjs";

const TURN_TIMEOUT_MS = 120_000;

/**
 * @param {{ url: string, anonKey: string, email: string, password: string, clientFactory?: typeof createClient }} args
 * @returns {Promise<{ accessToken: string, userId: string }>}
 */
export async function signIn({ url, anonKey, email, password, clientFactory = createClient }) {
  const client = clientFactory(url, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const result = await client.auth.signInWithPassword({ email, password });
  const session = result.data?.session;
  if (result.error || !session?.access_token || !result.data?.user) {
    throw new Error(`Eval sign-in failed for ${email}: ${result.error?.message ?? "no session"}`);
  }
  return { accessToken: session.access_token, userId: result.data.user.id };
}

/**
 * Sends one chat turn and reads the whole stream.
 * @param {{
 *   url: string,
 *   anonKey: string,
 *   accessToken: string,
 *   message: string,
 *   conversationId?: string | null,
 *   resourceFocus?: { resourceType: string, resourceId: string, resourceSummary: string } | null,
 *   request?: typeof fetch,
 * }} args
 */
export async function askBloom({
  url,
  anonKey,
  accessToken,
  message,
  conversationId = null,
  resourceFocus = null,
  request = fetch,
}) {
  const body = {
    message,
    mode: "standard",
    timezone: "America/Vancouver",
    conversation_id: conversationId,
    model_preference: null,
    session_type: resourceFocus ? "resource_focused" : "standard",
    resource_focus: resourceFocus,
    client_context: { route: "/bloom-evals", user_agent: "bloom-evals", viewport: "1440x900" },
  };

  const response = await request(`${url.replace(/\/$/, "")}/functions/v1/bloom-assist`, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(TURN_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    let json = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    return { status: response.status, json, transcript: buildTranscript([]) };
  }

  const events = await readSseStream(response.body);
  return { status: response.status, json: null, transcript: buildTranscript(events) };
}
