export const LIVE_EVIDENCE_DESCRIPTION =
  "Last observed success is real production evidence, not a deployment or health check. No recent evidence means no successful use was observed within that capability's window.";

interface IntakeEvidenceNoteInput {
  configured: boolean;
  lastObservedAt: string | null;
  sourceLabel: string;
  missingConfigurationNote: string;
}

export function intakeEvidenceNote({
  configured,
  lastObservedAt,
  sourceLabel,
  missingConfigurationNote,
}: IntakeEvidenceNoteInput): string {
  if (!configured) return missingConfigurationNote;
  return lastObservedAt
    ? `A real support request from ${sourceLabel} was observed in this environment within the last 30 days.`
    : `Configured in Bloom; no real support request from ${sourceLabel} has been observed in this environment within the last 30 days.`;
}
