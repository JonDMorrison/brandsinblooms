// company_profiles has one row per user, but the row describes the business.
// A teammate who joined an existing tenant has no row of their own: their
// business profile is the tenant owner's (public.profile_user_id_for).
// Single-user tenants, users without a tenant, and tenants with no profile
// resolve to the user themselves, so existing behaviour is unchanged.
//
// profile_user_id_for is executable by service_role only; with any other
// client, or on error, the given id is returned unchanged.

// Structural so npm:, jsr: and esm.sh Supabase clients (typed or untyped)
// are all accepted.
interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): unknown;
}

/** The user_id whose company_profiles row represents `userId`'s business. */
export async function resolveBusinessProfileUserId(
  supabase: RpcClient,
  userId: string,
): Promise<string> {
  if (!userId) return userId;
  try {
    const { data, error } = (await supabase.rpc("profile_user_id_for", {
      p_user_id: userId,
    })) as { data: unknown; error: unknown };
    if (error || typeof data !== "string" || !data) return userId;
    return data;
  } catch {
    return userId;
  }
}

// ---------------------------------------------------------------------------
// The business profile for a campaign's tenant.
//
// profile_user_id_for(campaign.user_id) follows the creator. When a master
// admin creates a campaign while switched into a client's tenant, the creator
// is not a member of that tenant, so it resolved to the admin's own profile:
// the wrong footer name and postal address. The campaign's tenant wins
// instead, using the same row the app's tenant_profile_user_id(uuid) picks
// (owner/admin first, then the oldest profile).

interface ProfileQueryResult {
  data?: unknown;
  error?: unknown;
}

interface ProfileFilterBuilder extends PromiseLike<ProfileQueryResult> {
  eq(column: string, value: string): ProfileFilterBuilder;
  in(column: string, values: string[]): ProfileFilterBuilder;
}

/** The slice of a Supabase client used here (from().select() narrowed). */
export interface TenantProfileClient extends RpcClient {
  from: (table: string) => { select: (columns: string) => unknown };
}

function selectRows(
  supabase: TenantProfileClient,
  table: string,
  columns: string,
): ProfileFilterBuilder {
  return supabase.from(table).select(columns) as ProfileFilterBuilder;
}

function rowsOf(result: ProfileQueryResult): Record<string, unknown>[] {
  if (result.error || !Array.isArray(result.data)) return [];
  return result.data.filter(
    (row): row is Record<string, unknown> => !!row && typeof row === "object",
  );
}

function text(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  return typeof value === "string" ? value : "";
}

/**
 * The user_id whose company_profiles row represents the campaign's business.
 * A creator who belongs to the tenant keeps today's resolution
 * (profile_user_id_for). A creator outside the tenant (a master admin
 * switched into a client) never gets their own company: the tenant's ranked
 * profile is used, and when the tenant has none, the tenant's lead member is
 * returned so no profile row is found. The send path then uses the tenant
 * name, shows no website, and stops on the missing postal address.
 * Returns "" when the tenant has no members at all. Only when membership
 * cannot be read at all is the creator-based resolution kept.
 */
export async function resolveCampaignBusinessProfileUserId(
  supabase: TenantProfileClient,
  params: { tenantId: string | null | undefined; userId: string },
): Promise<string> {
  const { tenantId, userId } = params;
  const fallback = () => resolveBusinessProfileUserId(supabase, userId);
  if (!tenantId) return fallback();

  let members: Record<string, unknown>[];
  try {
    const result = await selectRows(supabase, "users", "id, role, created_at").eq(
      "tenant_id",
      tenantId,
    );
    // Membership unknown: the creator may well belong to the tenant.
    if (result.error || !Array.isArray(result.data)) return fallback();
    members = rowsOf(result);
  } catch {
    return fallback();
  }
  if (members.some((member) => text(member, "id") === userId)) {
    return fallback();
  }

  // From here the creator is known not to belong to the tenant.
  const roleOf = new Map(
    members.map((member) => [text(member, "id"), text(member, "role")]),
  );
  const isLead = (id: string) => {
    const role = roleOf.get(id);
    return role === "owner" || role === "admin";
  };
  const rankIds = (rows: Record<string, unknown>[], idField: string) =>
    [...rows].sort((a, b) => {
      const aId = text(a, idField);
      const bId = text(b, idField);
      const lead = Number(isLead(bId)) - Number(isLead(aId));
      if (lead !== 0) return lead;
      const created = text(a, "created_at").localeCompare(text(b, "created_at"));
      if (created !== 0) return created;
      return aId.localeCompare(bId);
    });
  const leadMember = text(rankIds(members, "id")[0] ?? {}, "id");

  const memberIds = members.map((member) => text(member, "id")).filter(Boolean);
  if (memberIds.length === 0) return "";
  try {
    const profiles = rowsOf(
      await selectRows(supabase, "company_profiles", "user_id, created_at").in(
        "user_id",
        memberIds,
      ),
    );
    return text(rankIds(profiles, "user_id")[0] ?? {}, "user_id") || leadMember;
  } catch {
    return leadMember;
  }
}
