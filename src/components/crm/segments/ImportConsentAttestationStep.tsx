/**
 * Consent attestation step shown between column-mapping and the commit phase
 * of contact import. The owner picks one of three choices — the one they pick
 * decides whether the contacts land sendable or pending, and the choice is
 * persisted into `consent_attestations` so the boolean flip is on the record.
 *
 * Neutral framing. The safe choice (unsure) is default-selected. Continue is
 * never labelled in a way that nudges toward opting contacts in.
 */

import * as React from "react";
import {
  ShieldCheck,
  HelpCircle,
  Briefcase,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui-legacy/button";
import { Alert, AlertDescription } from "@/components/ui-legacy/alert";
import {
  DEFAULT_ATTESTATION_CHOICE,
  IMPORT_ATTESTATION_OPTIONS,
  type ImportAttestationChoice,
} from "@/lib/crm/importConsent";

interface ImportConsentAttestationStepProps {
  contactCount: number;
  value: ImportAttestationChoice;
  onChange: (next: ImportAttestationChoice) => void;
  onBack: () => void;
  onContinue: () => void;
  busy?: boolean;
}

const OPTION_ICON: Record<ImportAttestationChoice, React.ReactNode> = {
  express: <ShieldCheck className="h-5 w-5 text-emerald-600" />,
  unsure: <HelpCircle className="h-5 w-5 text-amber-600" />,
  implied: <Briefcase className="h-5 w-5 text-slate-600" />,
};

export function ImportConsentAttestationStep({
  contactCount,
  value,
  onChange,
  onBack,
  onContinue,
  busy = false,
}: ImportConsentAttestationStepProps) {
  const formattedCount = contactCount.toLocaleString();
  const isUnsure = value === "unsure";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Consent check</h3>
        <p className="text-sm text-muted-foreground">
          Before we import {formattedCount}{" "}
          {contactCount === 1 ? "contact" : "contacts"}, tell us what you know
          about their consent to receive marketing email. We record your
          answer so it&apos;s clear later who said what, and when.
        </p>
      </div>

      <fieldset
        className="space-y-3"
        aria-label="Consent attestation for imported contacts"
      >
        {IMPORT_ATTESTATION_OPTIONS.map((option) => {
          const checked = option.id === value;
          return (
            <label
              key={option.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${
                checked
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <input
                type="radio"
                name="import-consent-attestation"
                value={option.id}
                checked={checked}
                onChange={() => onChange(option.id)}
                className="mt-1 h-4 w-4 cursor-pointer accent-primary"
                aria-describedby={`attestation-detail-${option.id}`}
              />
              <span className="mt-0.5">{OPTION_ICON[option.id]}</span>
              <span className="flex-1 space-y-1">
                <span className="block text-sm font-medium text-foreground">
                  {option.label}
                </span>
                <span
                  id={`attestation-detail-${option.id}`}
                  className="block text-sm text-muted-foreground"
                >
                  {option.detail}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {isUnsure ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="space-y-1">
            <span className="block font-medium">
              These {formattedCount} contacts will import but stay paused.
            </span>
            <span className="block text-sm text-muted-foreground">
              We won&apos;t send marketing email to them until they confirm.
              You can send a one-time permission campaign asking them to opt
              in — we&apos;ll show that option on the next screen.
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-between border-t pt-4">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          Back to column mapping
        </Button>
        <Button onClick={onContinue} disabled={busy}>
          Continue
        </Button>
      </div>
    </div>
  );
}

ImportConsentAttestationStep.defaultChoice = DEFAULT_ATTESTATION_CHOICE;
