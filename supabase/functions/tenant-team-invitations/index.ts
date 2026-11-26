// Team invitations: an owner/admin invites someone by email with a role (and
// stores, for location-scoped roles); the invitee accepts from the emailed
// link, creating a login first if they have none.
//
// Actions (POST JSON { action, ... }):
//   send     { email, role, locationIds }   manager  create or refresh an invitation, email it
//   resend   { invitationId }               manager  new link, new expiry, email again
//   revoke   { invitationId }               manager  cancel a pending invitation
//   remove   { userId }                     manager  take a member off the team
//   preview  { token }                      public   what the link is for
//   create_login { token, password, fullName } public  new account for the invited email, joined to the team
//   accept   { token }                      invitee  join with the signed-in account
//
// "Manager" means the caller's get_current_crm_access() includes
// access.manage (tenant owner/admin, or a master admin in that tenant). The
// tenant always comes from the caller's access, never from the request.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.1.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createInvitationToken,
  databaseRoleFor,
  exactEmailPattern,
  hashInvitationToken,
  invitationExpiry,
  invitationState,
  invitationUrl,
  isPlausibleInvitationToken,
  isUuid,
  MIN_PASSWORD_LENGTH,
  normalizeInviteEmail,
  parseInviteRole,
  parseLocationIds,
  renderInvitationEmail,
  roleLabel,
  roleNeedsLocations,
} from "../_shared/teamInvitations.ts";
import type { CrmRole } from "../../../src/lib/auth/crmAccess.ts";

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };
const FROM_ADDRESS = "BloomSuite <noreply@brandsinblooms.com>";

class HttpError extends Error {
  constructor(public status: number, message: string, public code = "error") {
    super(message);
  }
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

interface InvitationRow {
  id: string;
  tenant_id: string;
  email: string;
  role: CrmRole;
  location_ids: string[];
  status: string;
  expires_at: string;
  invited_by: string | null;
  send_count: number;
}

interface ManagerContext {
  userId: string;
  tenantId: string;
}

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function appUrl(): string {
  return Deno.env.get("APP_URL") || "https://bloomsuite.app";
}

async function requireUser(req: Request, db: SupabaseClient) {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Sign in to continue.", "auth_required");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Sign in to continue.", "auth_required");
  return { user: data.user, header };
}

async function requireManager(req: Request, db: SupabaseClient): Promise<ManagerContext> {
  const { user, header } = await requireUser(req, db);
  // Resolve access as the caller so master-admin tenant context and the
  // server-side permission model apply exactly as in the app.
  const asCaller = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: header } }, auth: { persistSession: false } },
  );
  const { data, error } = await asCaller.rpc("get_current_crm_access");
  const access = (data ?? {}) as { tenantId?: string; permissions?: string[] };
  if (error || !access.tenantId || !access.permissions?.includes("access.manage")) {
    throw new HttpError(403, "Only owners and admins can manage the team.", "forbidden");
  }
  return { userId: user.id, tenantId: access.tenantId };
}

async function audit(
  db: SupabaseClient,
  row: {
    tenant_id: string;
    actor_user_id: string;
    target_user_id?: string | null;
    event_type: "member_joined" | "member_removed" | "invitation_sent" | "invitation_revoked";
    new_role?: string | null;
    old_role?: string | null;
    new_location_ids?: string[];
    after_state?: Record<string, unknown>;
  },
) {
  const { error } = await db.from("crm_access_audit").insert({
    target_user_id: null,
    ...row,
  });
  // The audit trail must not block the team change itself.
  if (error) console.error("[team-invitations] audit insert failed:", error.message);
}

async function validateLocations(
  db: SupabaseClient,
  tenantId: string,
  role: CrmRole,
  locationIds: string[],
): Promise<string[]> {
  if (!roleNeedsLocations(role)) return [];
  if (locationIds.length === 0) {
    throw new HttpError(400, "Choose at least one store for this role.", "locations_required");
  }
  const { data, error } = await db
    .from("tenant_locations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .in("id", locationIds);
  if (error) throw new HttpError(500, "Could not check the stores. Try again.");
  if ((data ?? []).length !== locationIds.length) {
    throw new HttpError(400, "Every store must be active and belong to your business.", "invalid_locations");
  }
  return locationIds;
}

async function loadTenantName(db: SupabaseClient, tenantId: string): Promise<string> {
  const { data } = await db.from("tenants").select("name").eq("id", tenantId).maybeSingle();
  return (data?.name as string | undefined)?.trim() || "your team";
}

async function loadUserName(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await db
    .from("users")
    .select("full_name, name, email")
    .eq("id", userId)
    .maybeSingle();
  return (data?.full_name || data?.name || data?.email || null) as string | null;
}

async function sendInvitationEmail(
  db: SupabaseClient,
  invitation: InvitationRow,
  token: string,
  inviterId: string,
): Promise<{ emailed: boolean; inviteUrl: string }> {
  const inviteUrl = invitationUrl(appUrl(), token);
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("[team-invitations] RESEND_API_KEY is not set; invitation not emailed");
    return { emailed: false, inviteUrl };
  }
  const message = renderInvitationEmail({
    businessName: await loadTenantName(db, invitation.tenant_id),
    inviterName: await loadUserName(db, inviterId),
    role: invitation.role,
    acceptUrl: inviteUrl,
    expiresAt: invitation.expires_at,
  });
  try {
    const result = await new Resend(apiKey).emails.send({
      from: FROM_ADDRESS,
      to: [invitation.email],
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (result.error) {
      console.error("[team-invitations] email send failed:", result.error.message);
      return { emailed: false, inviteUrl };
    }
    return { emailed: true, inviteUrl };
  } catch (error) {
    console.error("[team-invitations] email send threw:", error instanceof Error ? error.message : error);
    return { emailed: false, inviteUrl };
  }
}

async function findInvitationByToken(db: SupabaseClient, token: unknown): Promise<InvitationRow> {
  if (!isPlausibleInvitationToken(token)) {
    throw new HttpError(404, "This invitation link isn't valid.", "invalid");
  }
  const { data, error } = await db
    .from("tenant_invitations")
    .select("id, tenant_id, email, role, location_ids, status, expires_at, invited_by, send_count")
    .eq("token_hash", await hashInvitationToken(token))
    .maybeSingle();
  if (error) throw new HttpError(500, "Could not load the invitation. Try again.");
  if (!data) throw new HttpError(404, "This invitation link isn't valid.", "invalid");
  return data as InvitationRow;
}

function requireUsable(invitation: InvitationRow) {
  const state = invitationState(invitation);
  if (state === "expired") throw new HttpError(410, "This invitation has expired. Ask for a new one.", "expired");
  if (state === "revoked") throw new HttpError(410, "This invitation was cancelled.", "revoked");
  if (state === "accepted") throw new HttpError(409, "This invitation has already been used.", "accepted");
}

async function loadManagedInvitation(
  db: SupabaseClient,
  manager: ManagerContext,
  invitationId: unknown,
): Promise<InvitationRow> {
  if (!isUuid(invitationId)) throw new HttpError(400, "Invitation not found.");
  const { data, error } = await db
    .from("tenant_invitations")
    .select("id, tenant_id, email, role, location_ids, status, expires_at, invited_by, send_count")
    .eq("id", invitationId)
    .eq("tenant_id", manager.tenantId)
    .maybeSingle();
  if (error) throw new HttpError(500, "Could not load the invitation. Try again.");
  if (!data) throw new HttpError(404, "Invitation not found.");
  return data as InvitationRow;
}

/** Adds `userId` to the invitation's tenant with its role and stores. */
async function joinTeam(db: SupabaseClient, invitation: InvitationRow, userId: string, email: string) {
  const { data: existing, error: existingError } = await db
    .from("users")
    .select("id, tenant_id, role")
    .eq("id", userId)
    .maybeSingle();
  if (existingError) throw new HttpError(500, "Could not load your account. Try again.");

  if (existing?.tenant_id && existing.tenant_id !== invitation.tenant_id) {
    throw new HttpError(
      409,
      "This email already has its own BloomSuite business. Ask the person who invited you to use a different email address.",
      "other_business",
    );
  }

  const alreadyMember = existing?.tenant_id === invitation.tenant_id;
  if (!alreadyMember) {
    const databaseRole = databaseRoleFor(invitation.role);
    if (existing) {
      const { error } = await db
        .from("users")
        .update({ tenant_id: invitation.tenant_id, role: databaseRole })
        .eq("id", userId)
        .is("tenant_id", null);
      if (error) throw new HttpError(500, "Could not add you to the team. Try again.");
    } else {
      const name = email.split("@")[0];
      const { error } = await db.from("users").insert({
        id: userId,
        email,
        name,
        full_name: name,
        tenant_id: invitation.tenant_id,
        role: databaseRole,
      });
      if (error) throw new HttpError(500, "Could not add you to the team. Try again.");
    }

    const locationIds = roleNeedsLocations(invitation.role) ? invitation.location_ids : [];
    if (locationIds.length > 0) {
      const { error } = await db.from("user_location_access").upsert(
        locationIds.map((locationId) => ({
          tenant_id: invitation.tenant_id,
          user_id: userId,
          location_id: locationId,
          assigned_by: invitation.invited_by,
        })),
        { onConflict: "user_id,location_id", ignoreDuplicates: true },
      );
      if (error) throw new HttpError(500, "Could not assign your stores. Try again.");
    }

    await audit(db, {
      tenant_id: invitation.tenant_id,
      actor_user_id: userId,
      target_user_id: userId,
      event_type: "member_joined",
      new_role: databaseRole,
      new_location_ids: locationIds,
      after_state: { invitation_id: invitation.id },
    });
  }

  const { error: acceptError } = await db
    .from("tenant_invitations")
    .update({
      status: "accepted",
      accepted_user_id: userId,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitation.id)
    .eq("status", "pending");
  if (acceptError) console.error("[team-invitations] could not mark accepted:", acceptError.message);
}

async function emailHasAccount(db: SupabaseClient, email: string): Promise<boolean> {
  const { data } = await db.from("users").select("id").ilike("email", exactEmailPattern(email)).limit(1);
  return (data ?? []).length > 0;
}

type Body = Record<string, unknown>;

async function handle(req: Request, body: Body): Promise<Response> {
  const db = admin();
  const action = body.action;

  switch (action) {
    case "send": {
      const manager = await requireManager(req, db);
      const email = normalizeInviteEmail(body.email);
      if (!email) throw new HttpError(400, "Enter a valid email address.", "invalid_email");
      const role = parseInviteRole(body.role);
      if (!role) throw new HttpError(400, "Choose a role.", "invalid_role");
      const requested = parseLocationIds(body.locationIds);
      if (!requested) throw new HttpError(400, "Choose stores from the list.", "invalid_locations");
      const locationIds = await validateLocations(db, manager.tenantId, role, requested);

      const { data: member } = await db
        .from("users")
        .select("id, tenant_id")
        .ilike("email", exactEmailPattern(email))
        .limit(1)
        .maybeSingle();
      if (member?.tenant_id === manager.tenantId) {
        throw new HttpError(409, "That person is already on your team.", "already_member");
      }
      if (member?.tenant_id) {
        throw new HttpError(
          409,
          "That email already has its own BloomSuite business. Invite a different email address.",
          "other_business",
        );
      }

      const token = createInvitationToken();
      const tokenHash = await hashInvitationToken(token);
      const now = new Date().toISOString();
      const fields = {
        role,
        location_ids: locationIds,
        token_hash: tokenHash,
        expires_at: invitationExpiry(),
        last_sent_at: now,
        updated_at: now,
        invited_by: manager.userId,
      };

      const { data: pending } = await db
        .from("tenant_invitations")
        .select("id, send_count")
        .eq("tenant_id", manager.tenantId)
        .eq("email", email)
        .eq("status", "pending")
        .maybeSingle();

      const write = pending
        ? db
            .from("tenant_invitations")
            .update({ ...fields, send_count: (pending.send_count as number) + 1 })
            .eq("id", pending.id)
        : db.from("tenant_invitations").insert({ ...fields, tenant_id: manager.tenantId, email });
      const { data: saved, error } = await write
        .select("id, tenant_id, email, role, location_ids, status, expires_at, invited_by, send_count")
        .single();
      if (error || !saved) throw new HttpError(500, "Could not save the invitation. Try again.");

      const invitation = saved as InvitationRow;
      const delivery = await sendInvitationEmail(db, invitation, token, manager.userId);
      await audit(db, {
        tenant_id: manager.tenantId,
        actor_user_id: manager.userId,
        event_type: "invitation_sent",
        new_role: databaseRoleFor(role),
        new_location_ids: locationIds,
        after_state: { invitation_id: invitation.id, email, emailed: delivery.emailed },
      });
      return json(200, { invitationId: invitation.id, ...delivery });
    }

    case "resend": {
      const manager = await requireManager(req, db);
      const existing = await loadManagedInvitation(db, manager, body.invitationId);
      if (existing.status !== "pending") {
        throw new HttpError(409, "Only pending invitations can be resent.", "not_pending");
      }
      const token = createInvitationToken();
      const now = new Date().toISOString();
      const { data: saved, error } = await db
        .from("tenant_invitations")
        .update({
          token_hash: await hashInvitationToken(token),
          expires_at: invitationExpiry(),
          last_sent_at: now,
          updated_at: now,
          send_count: existing.send_count + 1,
        })
        .eq("id", existing.id)
        .eq("status", "pending")
        .select("id, tenant_id, email, role, location_ids, status, expires_at, invited_by, send_count")
        .single();
      if (error || !saved) throw new HttpError(500, "Could not resend the invitation. Try again.");
      const delivery = await sendInvitationEmail(db, saved as InvitationRow, token, manager.userId);
      return json(200, { invitationId: existing.id, ...delivery });
    }

    case "revoke": {
      const manager = await requireManager(req, db);
      const existing = await loadManagedInvitation(db, manager, body.invitationId);
      if (existing.status !== "pending") {
        throw new HttpError(409, "Only pending invitations can be cancelled.", "not_pending");
      }
      const now = new Date().toISOString();
      const { error } = await db
        .from("tenant_invitations")
        .update({ status: "revoked", revoked_at: now, updated_at: now })
        .eq("id", existing.id)
        .eq("status", "pending");
      if (error) throw new HttpError(500, "Could not cancel the invitation. Try again.");
      await audit(db, {
        tenant_id: manager.tenantId,
        actor_user_id: manager.userId,
        event_type: "invitation_revoked",
        after_state: { invitation_id: existing.id, email: existing.email },
      });
      return json(200, { invitationId: existing.id });
    }

    case "remove": {
      const manager = await requireManager(req, db);
      if (!isUuid(body.userId)) throw new HttpError(400, "Team member not found.");
      if (body.userId === manager.userId) {
        throw new HttpError(400, "You can't remove yourself from the team.", "self");
      }
      const { data: target } = await db
        .from("users")
        .select("id, role, tenant_id")
        .eq("id", body.userId)
        .eq("tenant_id", manager.tenantId)
        .maybeSingle();
      if (!target) throw new HttpError(404, "Team member not found.");

      if (target.role === "owner" || target.role === "admin") {
        const { count } = await db
          .from("users")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", manager.tenantId)
          .in("role", ["owner", "admin"])
          .neq("id", target.id);
        if (!count) {
          throw new HttpError(400, "Your business needs at least one owner or admin.", "last_admin");
        }
      }

      const { data: locations } = await db
        .from("user_location_access")
        .select("location_id")
        .eq("user_id", target.id)
        .eq("tenant_id", manager.tenantId);

      const { error: accessError } = await db
        .from("user_location_access")
        .delete()
        .eq("user_id", target.id)
        .eq("tenant_id", manager.tenantId);
      if (accessError) throw new HttpError(500, "Could not remove the team member. Try again.");

      const { error } = await db
        .from("users")
        .update({ tenant_id: null })
        .eq("id", target.id)
        .eq("tenant_id", manager.tenantId);
      if (error) throw new HttpError(500, "Could not remove the team member. Try again.");

      await audit(db, {
        tenant_id: manager.tenantId,
        actor_user_id: manager.userId,
        target_user_id: target.id,
        event_type: "member_removed",
        old_role: target.role as string,
        after_state: {
          location_ids: (locations ?? []).map((row) => row.location_id),
        },
      });
      return json(200, { userId: target.id });
    }

    case "preview": {
      const invitation = await findInvitationByToken(db, body.token);
      return json(200, {
        state: invitationState(invitation),
        email: invitation.email,
        businessName: await loadTenantName(db, invitation.tenant_id),
        roleLabel: roleLabel(invitation.role),
        hasAccount: await emailHasAccount(db, invitation.email),
      });
    }

    case "create_login": {
      const invitation = await findInvitationByToken(db, body.token);
      requireUsable(invitation);
      const password = typeof body.password === "string" ? body.password : "";
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new HttpError(400, `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`, "weak_password");
      }
      if (await emailHasAccount(db, invitation.email)) {
        throw new HttpError(409, "You already have a login. Sign in to accept.", "has_account");
      }
      const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 120) : "";
      // The link was emailed to this address, so the address is confirmed.
      // bloom_invitation tells handle_new_user_signup not to create a new
      // business for this login.
      const { data: created, error } = await db.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
        user_metadata: fullName ? { full_name: fullName } : {},
        app_metadata: { bloom_invitation: invitation.id },
      });
      if (error || !created.user) {
        throw new HttpError(400, error?.message || "Could not create your login. Try again.", "create_failed");
      }
      await joinTeam(db, invitation, created.user.id, invitation.email);
      return json(200, { email: invitation.email });
    }

    case "accept": {
      const { user } = await requireUser(req, db);
      const invitation = await findInvitationByToken(db, body.token);
      requireUsable(invitation);
      if ((user.email ?? "").toLowerCase() !== invitation.email) {
        throw new HttpError(
          403,
          `This invitation is for ${invitation.email}. Sign in with that email to accept it.`,
          "wrong_account",
        );
      }
      await joinTeam(db, invitation, user.id, invitation.email);
      return json(200, { tenantId: invitation.tenant_id });
    }

    default:
      throw new HttpError(400, "Unknown action.");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { error: "Invalid request." });
  }

  try {
    return await handle(req, body);
  } catch (error) {
    if (error instanceof HttpError) {
      return json(error.status, { error: error.message, code: error.code });
    }
    console.error("[team-invitations] unexpected error:", error instanceof Error ? error.message : error);
    return json(500, { error: "Something went wrong. Try again." });
  }
});
