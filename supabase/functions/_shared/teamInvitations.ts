// Pure helpers for team invitations (tenant-team-invitations edge function).
// No Deno globals or Supabase calls here, so vitest covers them directly.

import {
  CRM_ROLE_DESCRIPTIONS,
  CRM_ROLE_LABELS,
  CRM_ROLES,
  type CrmRole,
} from "../../../src/lib/auth/crmAccess.ts";
import {
  bloomEmailEscape,
  renderBloomSystemEmail,
} from "../../../src/lib/email/premiumBotanical.ts";

export const INVITATION_TTL_DAYS = 7;
export const MIN_PASSWORD_LENGTH = 8;

const LOCATION_SCOPED_ROLES = new Set<CrmRole>(["store_manager", "staff"]);

/** Lower-cased, trimmed email, or null when it is not a plausible address. */
export function normalizeInviteEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/**
 * An email as a case-insensitive exact ILIKE pattern: users.email keeps the
 * case it was signed up with, and "_" / "%" must not act as wildcards.
 */
export function exactEmailPattern(email: string): string {
  return email.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function parseInviteRole(value: unknown): CrmRole | null {
  return typeof value === "string" && (CRM_ROLES as readonly string[]).includes(value)
    ? (value as CrmRole)
    : null;
}

export function roleNeedsLocations(role: CrmRole): boolean {
  return LOCATION_SCOPED_ROLES.has(role);
}

/** users.role value for a CRM role (owner/admin is stored as "admin"). */
export function databaseRoleFor(role: CrmRole): string {
  return role === "owner_admin" ? "admin" : role;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Distinct UUIDs from an unknown value, or null if any entry is not one. */
export function parseLocationIds(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const ids = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string" || !UUID_PATTERN.test(entry)) return null;
    ids.add(entry.toLowerCase());
  }
  return [...ids];
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** 32 random bytes, base64url: the secret carried by the invite link. */
export function createInvitationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isPlausibleInvitationToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{40,64}$/.test(value);
}

/** Hex SHA-256 of the token; only the hash is stored. */
export async function hashInvitationToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function invitationExpiry(now: Date = new Date()): string {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export type InvitationState = "valid" | "expired" | "accepted" | "revoked";

export function invitationState(
  invitation: { status: string; expires_at: string },
  now: Date = new Date(),
): InvitationState {
  if (invitation.status === "accepted") return "accepted";
  if (invitation.status === "revoked") return "revoked";
  return new Date(invitation.expires_at).getTime() <= now.getTime() ? "expired" : "valid";
}

export function invitationUrl(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/invite/accept?token=${encodeURIComponent(token)}`;
}

export function roleLabel(role: CrmRole): string {
  return CRM_ROLE_LABELS[role];
}

export interface InvitationEmailInput {
  businessName: string;
  inviterName: string | null;
  role: CrmRole;
  acceptUrl: string;
  expiresAt: string;
}

export function renderInvitationEmail(input: InvitationEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const business = input.businessName.trim() || "your team";
  const inviter = input.inviterName?.trim() || null;
  const label = roleLabel(input.role);
  const expires = new Date(input.expiresAt).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const lead = inviter
    ? `${inviter} invited you to join ${business} on BloomSuite.`
    : `You've been invited to join ${business} on BloomSuite.`;

  const html = renderBloomSystemEmail({
    eyebrow: "TEAM INVITATION",
    title: `Join ${business} on BloomSuite`,
    preheader: lead,
    icon: "mail",
    bodyHtml:
      `<p style="margin:0 0 12px">${bloomEmailEscape(lead)}</p>` +
      `<p style="margin:0 0 12px">Your role: <strong>${bloomEmailEscape(label)}</strong>. ` +
      `${bloomEmailEscape(CRM_ROLE_DESCRIPTIONS[input.role])}</p>` +
      `<p style="margin:0">This invitation expires on ${bloomEmailEscape(expires)}. ` +
      "If you weren't expecting it, you can ignore this email.</p>",
    action: { label: "Accept invitation", url: input.acceptUrl },
    footer: "BloomSuite — made for garden centres.",
  });

  const text = [
    lead,
    `Your role: ${label}. ${CRM_ROLE_DESCRIPTIONS[input.role]}`,
    `Accept the invitation: ${input.acceptUrl}`,
    `This invitation expires on ${expires}. If you weren't expecting it, you can ignore this email.`,
  ].join("\n\n");

  return { subject: `Join ${business} on BloomSuite`, html, text };
}
