import { supabase } from "@/integrations/supabase/client";
import type { CrmRole } from "@/lib/auth/crmAccess";
import { readFunctionErrorBody } from "@/lib/email/verifyDomainFeedback";

// Client for the tenant-team-invitations edge function. The tenant is always
// resolved on the server from the caller's access, never sent from here.

export type InvitationState = "valid" | "expired" | "accepted" | "revoked";

export interface InvitationPreview {
  state: InvitationState;
  email: string;
  businessName: string;
  roleLabel: string;
  hasAccount: boolean;
}

export interface InvitationDelivery {
  invitationId: string;
  emailed: boolean;
  inviteUrl: string;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: CrmRole;
  location_ids: string[];
  expires_at: string;
  last_sent_at: string;
  send_count: number;
}

export class TeamInvitationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

type ActionBody =
  | { action: "send"; email: string; role: CrmRole; locationIds: string[] }
  | { action: "resend"; invitationId: string }
  | { action: "revoke"; invitationId: string }
  | { action: "remove"; userId: string }
  | { action: "preview"; token: string }
  | { action: "create_login"; token: string; password: string; fullName: string }
  | { action: "accept"; token: string };

async function callTeamInvitations<T>(body: ActionBody): Promise<T> {
  const { data, error } = await supabase.functions.invoke("tenant-team-invitations", { body });
  if (error) {
    const { body: reply } = await readFunctionErrorBody(error);
    throw new TeamInvitationError(
      typeof reply?.error === "string" ? reply.error : "Something went wrong. Try again.",
      typeof reply?.code === "string" ? reply.code : "error",
    );
  }
  return data as T;
}

export const sendTeamInvitation = (email: string, role: CrmRole, locationIds: string[]) =>
  callTeamInvitations<InvitationDelivery>({ action: "send", email, role, locationIds });

export const resendTeamInvitation = (invitationId: string) =>
  callTeamInvitations<InvitationDelivery>({ action: "resend", invitationId });

export const revokeTeamInvitation = (invitationId: string) =>
  callTeamInvitations<{ invitationId: string }>({ action: "revoke", invitationId });

export const removeTeamMember = (userId: string) =>
  callTeamInvitations<{ userId: string }>({ action: "remove", userId });

export const previewTeamInvitation = (token: string) =>
  callTeamInvitations<InvitationPreview>({ action: "preview", token });

export const createInvitedLogin = (token: string, password: string, fullName: string) =>
  callTeamInvitations<{ email: string }>({ action: "create_login", token, password, fullName });

export const acceptTeamInvitation = (token: string) =>
  callTeamInvitations<{ tenantId: string }>({ action: "accept", token });

/** Pending, unexpired-or-not invitations for the tenant (owners/admins only, via RLS). */
export async function listPendingInvitations(tenantId: string): Promise<PendingInvitation[]> {
  const { data, error } = await supabase
    .from("tenant_invitations")
    .select("id, email, role, location_ids, expires_at, last_sent_at, send_count")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new TeamInvitationError(error.message, "list_failed");
  return (data ?? []) as PendingInvitation[];
}
