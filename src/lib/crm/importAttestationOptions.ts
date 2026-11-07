/**
 * The owner's consent statements for contact import.
 *
 * Dependency-free so the same wording is used by the CRM import dialog and by
 * Bloom chat's server-side import (supabase/functions/bloom-assist). The
 * wording is persisted verbatim into consent_attestations.attestation_wording.
 */

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
