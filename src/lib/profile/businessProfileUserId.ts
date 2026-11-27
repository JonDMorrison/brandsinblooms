import { supabase } from "@/integrations/supabase/client";

// company_profiles has one row per user, but the row describes the business.
// A teammate who joined an existing tenant reads and edits the tenant's
// profile, which belongs to the tenant owner. This resolves the user id whose
// company_profiles row represents the signed-in user's business
// (public.current_profile_user_id). Single-user tenants, users without a
// tenant and master admins resolve to themselves.

const cache = new Map<string, Promise<string>>();

/**
 * The user_id to use for company_profiles reads and writes on behalf of
 * `userId` (the signed-in user). Falls back to `userId` if the lookup fails,
 * which is the behaviour every single-user business already has.
 */
export function getBusinessProfileUserId(userId: string): Promise<string> {
  const cached = cache.get(userId);
  if (cached) return cached;

  const pending = (async () => {
    try {
      // The RPC resolves the signed-in user only. Any other id (admin tools
      // acting on a specific user) is used as given.
      const { data: session } = await supabase.auth.getSession();
      if (session.session?.user.id !== userId) {
        cache.delete(userId);
        return userId;
      }
      const { data, error } = await supabase.rpc("current_profile_user_id");
      if (error || typeof data !== "string" || !data) {
        cache.delete(userId);
        return userId;
      }
      return data;
    } catch {
      cache.delete(userId);
      return userId;
    }
  })();

  cache.set(userId, pending);
  return pending;
}

/** Forget resolved ids, e.g. after the user joins a team. */
export function clearBusinessProfileUserIdCache(): void {
  cache.clear();
  tenantCache.clear();
}

const tenantCache = new Map<string, Promise<string | null>>();

/**
 * The user_id whose company_profiles row represents `tenantId`'s business,
 * for the signed-in `userId` working in that tenant.
 *
 * In the user's own tenant this is getBusinessProfileUserId. In any other
 * tenant (a master admin using the tenant switcher) it is that tenant's
 * profile (public.tenant_profile_user_id), never the signed-in user's own
 * company. Returns null when that tenant's profile cannot be resolved, so
 * callers show the tenant's own name rather than someone else's business.
 */
export function getTenantBusinessProfileUserId(
  userId: string,
  tenantId: string | null | undefined,
): Promise<string | null> {
  if (!tenantId) return getBusinessProfileUserId(userId);

  const key = `${userId}:${tenantId}`;
  const cached = tenantCache.get(key);
  if (cached) return cached;

  const pending = (async (): Promise<string | null> => {
    try {
      const { data: member, error: memberError } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", userId)
        .maybeSingle();
      if (!memberError && member?.tenant_id === tenantId) {
        return await getBusinessProfileUserId(userId);
      }

      const { data, error } = await supabase.rpc("tenant_profile_user_id", {
        p_tenant_id: tenantId,
      });
      if (error) {
        tenantCache.delete(key);
        return null;
      }
      return typeof data === "string" && data ? data : null;
    } catch {
      tenantCache.delete(key);
      return null;
    }
  })();

  tenantCache.set(key, pending);
  return pending;
}

// A business profile saved on one page (Contact & Footer settings) must reach
// every surface that reads it, including a campaign editor open in another
// tab: the readiness check's "Add your business address" link opens settings
// in a new tab, and company_profiles is not in the realtime publication.
const BUSINESS_PROFILE_CHANGED_EVENT = "bloomsuite:business-profile-changed";
const BUSINESS_PROFILE_CHANNEL = "bloomsuite-business-profile";

export interface BusinessProfileChange {
  /** The tenant whose business profile changed; null for a user with no tenant. */
  tenantId: string | null;
  /** The company_profiles.user_id of the saved row. */
  profileUserId: string;
}

function isBusinessProfileChange(value: unknown): value is BusinessProfileChange {
  if (!value || typeof value !== "object") return false;
  const change = value as Record<string, unknown>;
  return (
    typeof change.profileUserId === "string" &&
    (change.tenantId === null || typeof change.tenantId === "string")
  );
}

// BroadcastChannel also delivers to other channel objects in the same tab,
// which the window event already reached; messages carry this tab's id so
// each listener runs once per save.
let tabSourceId: string | null = null;
function getTabSourceId(): string {
  if (!tabSourceId) {
    tabSourceId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return tabSourceId;
}

interface BusinessProfileChannelMessage {
  source: string;
  change: BusinessProfileChange;
}

function isChannelMessage(value: unknown): value is BusinessProfileChannelMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return typeof message.source === "string" && isBusinessProfileChange(message.change);
}

function openBusinessProfileChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(BUSINESS_PROFILE_CHANNEL);
  } catch {
    return null;
  }
}

/**
 * Announce that a business profile was saved. Clears the resolved-id caches
 * (a tenant that had no profile is cached as null) and tells every listener in
 * this tab and in other tabs to reload.
 */
export function notifyBusinessProfileChanged(change: BusinessProfileChange): void {
  clearBusinessProfileUserIdCache();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<BusinessProfileChange>(BUSINESS_PROFILE_CHANGED_EVENT, {
        detail: change,
      }),
    );
  }
  const channel = openBusinessProfileChannel();
  if (channel) {
    try {
      const message: BusinessProfileChannelMessage = {
        source: getTabSourceId(),
        change,
      };
      channel.postMessage(message);
    } finally {
      channel.close();
    }
  }
}

/** Listen for saved business profiles. Returns the unsubscribe function. */
export function subscribeBusinessProfileChanged(
  listener: (change: BusinessProfileChange) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onLocal = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (isBusinessProfileChange(detail)) listener(detail);
  };
  window.addEventListener(BUSINESS_PROFILE_CHANGED_EVENT, onLocal);

  const channel = openBusinessProfileChannel();
  const onRemote = (event: MessageEvent<unknown>) => {
    if (!isChannelMessage(event.data) || event.data.source === getTabSourceId()) return;
    // Another tab saved: this tab's cached ids may be stale too.
    clearBusinessProfileUserIdCache();
    listener(event.data.change);
  };
  channel?.addEventListener("message", onRemote);

  return () => {
    window.removeEventListener(BUSINESS_PROFILE_CHANGED_EVENT, onLocal);
    if (channel) {
      channel.removeEventListener("message", onRemote);
      channel.close();
    }
  };
}
