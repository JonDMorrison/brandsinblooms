import type { Provider, Session, SupabaseClient } from "@supabase/supabase-js";

/**
 * BloomSuite central login for the CRM: the provider name, the return path kept across the sign-in, and the
 * session reports to BloomSuite ID (through the bloomsuite-session-report Edge Function). Display and
 * reporting only: nothing here decides access.
 */
export const BLOOMSUITE_PROVIDER = "custom:bloomsuite";
export const BLOOMSUITE_RETURN_PATH = "/auth/bloomsuite";

const RETURN_TO_KEY = "bloomsuite.crm.return-to";
const START_FAILED_MESSAGE = "BloomSuite sign-in didn't start. Try again in a moment.";
const REPORT_STATE_KEY = "bloomsuite.crm.session-report";
const ACTIVE_EVERY_MS = 15 * 60 * 1000;
const SIGN_IN_RETRY_MS = 5 * 60 * 1000;
const REPORT_TIMEOUT_MS = 4000;

/** Pages a BloomSuite sign-in must never return to: the sign-in pages and the provider callbacks. */
const NEVER_RETURN_TO = ["/auth", "/oauth/callback", "/admin/impersonate/callback"];

/**
 * A same-origin path to open after a BloomSuite sign-in, or null. Only a path on this site that isn't a
 * sign-in page or a provider callback is accepted.
 */
export function getSafeBloomsuiteReturnTo(
  value: string | null | undefined,
  origin: string = window.location.origin,
): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return null;
    const blocked = NEVER_RETURN_TO.some(
      (path) => url.pathname === path || url.pathname.startsWith(`${path}/`),
    );
    const providerCallback = url.pathname.startsWith("/integrations/") && url.pathname.endsWith("/callback");
    if (blocked || providerCallback) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Keeps where to go after the BloomSuite sign-in (this tab only). */
export function rememberBloomsuiteReturnTo(value: string | null | undefined): void {
  const safe = getSafeBloomsuiteReturnTo(value);
  try {
    if (safe) sessionStorage.setItem(RETURN_TO_KEY, safe);
    else sessionStorage.removeItem(RETURN_TO_KEY);
  } catch {
    // Storage unavailable: the sign-in opens the dashboard.
  }
}

/** The kept return path (removed as it is read), or null. */
export function takeBloomsuiteReturnTo(): string | null {
  try {
    const value = sessionStorage.getItem(RETURN_TO_KEY);
    sessionStorage.removeItem(RETURN_TO_KEY);
    return getSafeBloomsuiteReturnTo(value);
  } catch {
    return null;
  }
}

/** True when this user has a BloomSuite identity. Display and reporting only, never authorization. */
export function isBloomsuiteSession(session: Session | null): boolean {
  return (session?.user.identities ?? []).some((identity) => identity.provider === BLOOMSUITE_PROVIDER);
}

export function sessionIdFromAccessToken(accessToken: string): string | null {
  try {
    const payloadPart = accessToken.split(".")[1];
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))) as {
      session_id?: unknown;
    };
    return typeof payload.session_id === "string" && payload.session_id ? payload.session_id : null;
  } catch {
    return null;
  }
}

export type SessionReportEvent = "sign_in" | "active" | "sign_out";

/**
 * Sends one session report to BloomSuite ID. Never throws and never waits more than a few seconds; a
 * failure is logged as a warning, without token values. Resolves true when the report went through.
 */
export async function reportSession(client: SupabaseClient, event: SessionReportEvent): Promise<boolean> {
  try {
    const result = await Promise.race([
      client.functions.invoke("bloomsuite-session-report", { body: { event } }),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), REPORT_TIMEOUT_MS)),
    ]);
    if (result === null) console.warn("BloomSuite session report timed out", { event });
    else if (result.error) console.warn("BloomSuite session report failed", { event, reason: result.error.name });
    return result !== null && !result.error;
  } catch {
    console.warn("BloomSuite session report failed", { event });
    return false;
  }
}

type ReportState = { sessionId: string; lastAt: number };

function readReportState(): ReportState | null {
  try {
    const value = JSON.parse(localStorage.getItem(REPORT_STATE_KEY) ?? "null") as Partial<ReportState> | null;
    return value && typeof value.sessionId === "string" && typeof value.lastAt === "number"
      ? { sessionId: value.sessionId, lastAt: value.lastAt }
      : null;
  } catch {
    return null;
  }
}

function writeReportState(state: ReportState): void {
  try {
    localStorage.setItem(REPORT_STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: a report may repeat, which BloomSuite ID accepts.
  }
}

/**
 * For a BloomSuite session: `sign_in` once per session, then `active` at most every 15 minutes while it stays
 * signed in (shared across tabs). Returns the stop function for an effect cleanup.
 */
export function startSessionReports(client: SupabaseClient, session: Session): () => void {
  const sessionId = sessionIdFromAccessToken(session.access_token);
  if (!sessionId || !isBloomsuiteSession(session)) return () => {};
  let signInPending = false;
  let signInRetryAt = 0;
  const tick = () => {
    const state = readReportState();
    if (state?.sessionId !== sessionId) {
      // crm-r2-F21: sign_in counts as sent only once it went through; a failed one is sent again a few minutes later.
      if (signInPending || Date.now() < signInRetryAt) return;
      signInPending = true;
      void reportSession(client, "sign_in").then((reported) => {
        signInPending = false;
        if (reported) writeReportState({ sessionId, lastAt: Date.now() });
        else signInRetryAt = Date.now() + SIGN_IN_RETRY_MS;
      });
    } else if (Date.now() - state.lastAt >= ACTIVE_EVERY_MS) {
      writeReportState({ sessionId, lastAt: Date.now() });
      void reportSession(client, "active");
    }
  };
  tick();
  const timer = window.setInterval(tick, 60_000);
  return () => window.clearInterval(timer);
}

function switchOn(value: unknown): boolean {
  return typeof value === "string" && ["on", "true"].includes(value.trim().toLowerCase());
}

/** "Continue with BloomSuite" is offered only when VITE_BLOOMSUITE_LOGIN is on. */
export function bloomsuiteLoginEnabled(): boolean {
  return switchOn(import.meta.env.VITE_BLOOMSUITE_LOGIN);
}

/**
 * The CRM's own email sign-in and sign-up show when VITE_LEGACY_EMAIL_LOGIN is on, and also whenever the
 * BloomSuite button is off, so a deployment without the new settings keeps its only way in.
 */
export function legacyEmailLoginEnabled(): boolean {
  return switchOn(import.meta.env.VITE_LEGACY_EMAIL_LOGIN) || !bloomsuiteLoginEnabled();
}

/** A page of the BloomSuite Account Center (VITE_BLOOMSUITE_WEB_URL), or null when that isn't a web address. */
export function bloomsuiteAccountUrl(path: "" | "/personal-info" | "/security" = ""): string | null {
  const base = import.meta.env.VITE_BLOOMSUITE_WEB_URL?.trim();
  if (!base) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}/account${path}`;
  } catch {
    return null;
  }
}

/** The name the person keeps in their BloomSuite account (from the BloomSuite identity), or null. */
export function bloomsuiteProfileName(session: Session | null): string | null {
  const identity = (session?.user.identities ?? []).find((entry) => entry.provider === BLOOMSUITE_PROVIDER);
  const data = identity?.identity_data ?? {};
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  for (const key of ["full_name", "name"]) {
    const value = data[key];
    // BloomSuite ID sends the email as `name` when the person has no profile name; that isn't a name.
    if (typeof value === "string" && value.trim() && value.trim().toLowerCase() !== email) return value.trim().slice(0, 120);
  }
  return null;
}

/**
 * Starts "Continue with BloomSuite": keeps the safe return path for this tab, then the browser leaves for
 * BloomSuite ID and comes back to /auth/bloomsuite (PKCE). Returns a message when it couldn't start.
 */
export async function continueWithBloomsuite(client: SupabaseClient, returnTo: string | null): Promise<string | null> {
  rememberBloomsuiteReturnTo(returnTo);
  const { error } = await client.auth.signInWithOAuth({
    // auth-js 2.70's Provider type predates custom providers; Auth accepts "custom:<identifier>".
    provider: BLOOMSUITE_PROVIDER as unknown as Provider,
    options: { redirectTo: `${window.location.origin}${BLOOMSUITE_RETURN_PATH}` },
  });
  return error ? START_FAILED_MESSAGE : null;
}

/**
 * 33/R-01 containment: the CRM never keeps BloomSuite ID's own tokens. The code exchange hands back provider_token
 * and provider_refresh_token with the CRM session, and the client stores the whole response; this stores the CRM
 * session again without them (setSession keeps only the CRM's own tokens). Returns false when that failed, so the
 * caller can end the sign-in instead.
 */
export async function dropBloomsuiteProviderTokens(client: SupabaseClient, session: Session): Promise<boolean> {
  if (!session.provider_token && !session.provider_refresh_token) return true;
  const { data, error } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  return !error && Boolean(data.session) && !data.session?.provider_token && !data.session?.provider_refresh_token;
}

/** Signs out of the CRM on this device only, telling BloomSuite ID first for a BloomSuite session. */
export async function signOutThisDevice(client: SupabaseClient, session: Session | null): Promise<void> {
  if (isBloomsuiteSession(session)) await reportSession(client, "sign_out");
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) console.warn("Sign out failed", { reason: error.name });
}

export type BloomsuiteApp = { id: string; name: string; home_url: string | null; last_used_at: string | null };

/** The person's BloomSuite apps for the switcher, through the CRM's signed server-side call. */
export async function fetchBloomsuiteApps(client: SupabaseClient): Promise<BloomsuiteApp[]> {
  const { data, error } = await client.functions.invoke<{ apps?: BloomsuiteApp[] }>("bloomsuite-my-apps", {
    body: {},
  });
  if (error) throw new Error("BloomSuite apps unavailable");
  return data?.apps ?? [];
}
