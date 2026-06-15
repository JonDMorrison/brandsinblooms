/**
 * Owner-driven consent attestation for contact import.
 *
 * Today imported contacts default to email_opt_in=false / email_consent_method=
 * 'pending_confirmation' and are silently excluded from sends — owners discover
 * the gap only when a campaign reaches almost no one (Erin Minter, Jeff at
 * Brands in Blooms). This module replaces that silent default with an
 * owner-attested record.
 *
 * The flow is: the owner picks one of three attestation choices at upload
 * time; the consent fields on each newly-inserted customer come from
 * `applyAttestationToCustomer`, the attestation header goes into
 * `consent_attestations`, and one row per contact goes into
 * `crm_email_consent_events` pointing back at that header.
 *
 * The default is "unsure" — the safe, pending option. Express consent
 * requires an explicit choice.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ImportAttestationChoice = "express" | "unsure" | "implied";

export interface ImportAttestationOption {
  id: ImportAttestationChoice;
  label: string;
  /**
   * The exact wording shown to the owner. Persisted verbatim into
   * `consent_attestations.attestation_wording` so that if we revise the copy
   * later, old attestations still document what the owner agreed to.
   */
  wording: string;
  /** Sub-explanation rendered under the label. */
  detail: string;
}

export const IMPORT_ATTESTATION_OPTIONS: readonly ImportAttestationOption[] = [
  {
    id: "express",
    label: "These contacts gave express consent to receive marketing email",
    wording:
      "These contacts gave express consent to receive marketing email from my business — for example through a signup form, a checkbox, or an in-store opt-in.",
    detail:
      "Their addresses will be opted in and eligible to receive marketing campaigns right away.",
  },
  {
    id: "unsure",
    label: "I'm not sure / I don't have records of consent",
    wording:
      "I'm not sure or I don't have records of consent for these contacts.",
    detail:
      "These addresses will import but stay paused — we won't send marketing email until consent is on file. You can send a one-time permission campaign asking them to opt in.",
  },
  {
    id: "implied",
    label:
      "These contacts have an existing business relationship (implied consent)",
    wording:
      "These contacts have an existing business relationship with me — for example, recent customers or active inquiries — and I am relying on implied consent.",
    detail:
      "Implied consent is time-limited (typically 2 years for paying customers, 6 months for inquiries under CASL). Their addresses will be opted in and you'll see an implied-consent flag on each record.",
  },
] as const;

/** The choice the import flow defaults to when the dialog opens. */
export const DEFAULT_ATTESTATION_CHOICE: ImportAttestationChoice = "unsure";

export function getAttestationOption(choice: ImportAttestationChoice) {
  const found = IMPORT_ATTESTATION_OPTIONS.find((option) => option.id === choice);
  if (!found) {
    throw new Error(`Unknown attestation choice: ${choice}`);
  }
  return found;
}

/**
 * Consent fields that should be merged onto an imported customer row based on
 * the owner's attestation. Returns an object the import path can spread over
 * the contact before insert.
 *
 * Express and implied opt the contact in (with distinct consent methods so we
 * can later report on them separately). Unsure leaves the contact pending —
 * matching the prior silent default, but now driven by an explicit owner
 * statement instead of a hidden one.
 */
export function applyAttestationToCustomer(
  choice: ImportAttestationChoice,
  now: Date = new Date(),
): {
  email_opt_in: boolean;
  email_consent_source: string;
  email_consent_method: string;
  email_opt_in_at: string | null;
} {
  if (choice === "express") {
    return {
      email_opt_in: true,
      email_consent_source: "import_attested",
      email_consent_method: "owner_attested_express",
      email_opt_in_at: now.toISOString(),
    };
  }

  if (choice === "implied") {
    return {
      email_opt_in: true,
      email_consent_source: "import_attested",
      email_consent_method: "owner_attested_implied",
      email_opt_in_at: now.toISOString(),
    };
  }

  return {
    email_opt_in: false,
    email_consent_source: "csv_import",
    email_consent_method: "pending_confirmation",
    email_opt_in_at: null,
  };
}

/** Per-contact event_type written into crm_email_consent_events. */
export function attestationEventType(choice: ImportAttestationChoice) {
  switch (choice) {
    case "express":
      return "imported_attested_express" as const;
    case "implied":
      return "imported_attested_implied" as const;
    case "unsure":
      return "imported_attested_unsure" as const;
  }
}

interface RecordAttestationInput {
  client: SupabaseClient;
  tenantId: string;
  attestedByUserId: string;
  choice: ImportAttestationChoice;
  contactCount: number;
  importBatchId?: string | null;
  source?: string;
}

/**
 * Inserts one row into `consent_attestations` and returns its id. Caller
 * threads the returned id through per-contact event rows.
 */
export async function recordImportAttestation({
  client,
  tenantId,
  attestedByUserId,
  choice,
  contactCount,
  importBatchId,
  source = "csv_import",
}: RecordAttestationInput): Promise<string> {
  const option = getAttestationOption(choice);

  const { data, error } = await client
    .from("consent_attestations")
    .insert({
      tenant_id: tenantId,
      attested_by_user_id: attestedByUserId,
      attestation_type: choice,
      contact_count: contactCount,
      source,
      import_batch_id: importBatchId ?? null,
      attestation_wording: option.wording,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

interface RecordImportConsentEventsInput {
  client: SupabaseClient;
  tenantId: string;
  attestationId: string;
  choice: ImportAttestationChoice;
  contacts: Array<{ id: string; email: string }>;
}

/**
 * Writes one row per imported contact into crm_email_consent_events,
 * pointing back at the attestation header so the audit trail joins back to
 * the owner statement that drove the consent flip.
 *
 * Chunked to keep payloads under PostgREST limits on large imports.
 */
export async function recordImportConsentEvents({
  client,
  tenantId,
  attestationId,
  choice,
  contacts,
}: RecordImportConsentEventsInput): Promise<void> {
  if (contacts.length === 0) {
    return;
  }

  const eventType = attestationEventType(choice);
  const source =
    choice === "unsure" ? "csv_import_pending" : "import_attested";

  const rows = contacts.map((contact) => ({
    tenant_id: tenantId,
    customer_id: contact.id,
    email: contact.email,
    event_type: eventType,
    source,
    attestation_id: attestationId,
  }));

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await client
      .from("crm_email_consent_events")
      .insert(slice);
    if (error) {
      // Audit-write failure must not silently swallow the import; surface it
      // so the caller can decide. The customer rows were already written.
      throw error;
    }
  }
}
