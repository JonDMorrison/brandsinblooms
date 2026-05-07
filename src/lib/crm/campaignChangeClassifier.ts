// Classifies an externally-arriving crm_campaigns row update against the
// editor's last-known state, so the campaign editor can show an
// informational notification (server-side metadata change, edits safe)
// instead of an alarming warning that previously caused user panic.
//
// SCENARIO A: server changed status / metadata only. Local content is
//   unaffected; reload is safe even with unsaved local edits, because
//   reload only re-syncs what changed server-side.
//   (We still recommend reload to refresh the displayed status.)
//
// SCENARIO B: contentBlocks or content HTML actually changed server-
//   side. Local has NO unsaved edits. Reload is safe.
//
// SCENARIO C: contentBlocks or content HTML changed server-side AND
//   local has unsaved edits. Reload will discard local edits.
//
// The realtime subscription delivers the full payload.new row from
// postgres_changes, so we have everything we need to classify.

export type CampaignChangeScenario = "metadata_only" | "content_no_local" | "content_with_local";

export type CampaignChangeSeverity = "info" | "warning";

export interface CampaignChangeClassification {
  scenario: CampaignChangeScenario;
  severity: CampaignChangeSeverity;
  // Headline shown in the notification chip / banner.
  message: string;
  // Optional second line (e.g. explicit "your edits are safe").
  detail: string;
  // Whether the user has unsaved local edits that reload would discard.
  localChangesAtRisk: boolean;
  // Which trigger drove the message wording — useful for tests + telemetry.
  reason:
    | "stuck_send_recovery"
    | "audit_correction"
    | "metadata_generic"
    | "content_changed";
}

// Stable JSON stringify so block ordering doesn't produce false-positives.
// Keys are sorted recursively. We do not strip whitespace beyond what
// JSON.stringify does — the goal is structural equality, not pretty
// formatting.
export function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const stringify = (input: unknown): unknown => {
    if (input === null || typeof input !== "object") {
      return input;
    }
    if (seen.has(input as object)) {
      return null;
    }
    seen.add(input as object);
    if (Array.isArray(input)) {
      return input.map((item) => stringify(item));
    }
    const record = input as Record<string, unknown>;
    const ordered: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      ordered[key] = stringify(record[key]);
    }
    return ordered;
  };
  return JSON.stringify(stringify(value));
}

function extractContentBlocks(metadata: unknown): unknown[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }
  const value = (metadata as Record<string, unknown>).contentBlocks;
  return Array.isArray(value) ? value : [];
}

interface IncomingRow {
  // The raw crm_campaigns row from postgres_changes payload.new. Snake-case.
  content?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface LastKnownRecord {
  // The CampaignEditorRecord that was last loaded (or last saved) from the server.
  // We compare against this — NOT against the user's in-progress edits — so a
  // user who is mid-edit gets the metadata-only message when only metadata
  // moved on the server.
  content?: string | null;
  contentBlocks?: unknown[];
  metadata?: Record<string, unknown> | null;
}

export interface ClassifyInputs {
  incomingRow: IncomingRow;
  lastKnownRecord: LastKnownRecord | null | undefined;
  hasUnsavedLocalChanges: boolean;
}

export function classifyExternalCampaignChange(
  inputs: ClassifyInputs,
): CampaignChangeClassification {
  const { incomingRow, lastKnownRecord, hasUnsavedLocalChanges } = inputs;

  const incomingBlocks = extractContentBlocks(incomingRow.metadata);
  const lastBlocks = lastKnownRecord?.contentBlocks ?? [];
  const blocksChanged =
    stableStringify(incomingBlocks) !== stableStringify(lastBlocks);

  const incomingHtml = (incomingRow.content ?? "").trim();
  const lastHtml = (lastKnownRecord?.content ?? "").trim();
  const htmlChanged = incomingHtml !== lastHtml;

  if (!blocksChanged && !htmlChanged) {
    // SCENARIO A — server moved metadata only. Tailor the message based
    // on which metadata key looks like the trigger.
    const metadata = (incomingRow.metadata ?? {}) as Record<string, unknown>;
    const lastMetadata = (lastKnownRecord?.metadata ?? {}) as Record<
      string,
      unknown
    >;

    const stuckChanged =
      stableStringify(metadata.stuck_send_recovery) !==
      stableStringify(lastMetadata.stuck_send_recovery);
    if (stuckChanged && metadata.stuck_send_recovery) {
      return {
        scenario: "metadata_only",
        severity: "info",
        message: "This campaign was reset to draft after a delivery error.",
        detail: "Your content is safe. Reload to continue editing.",
        localChangesAtRisk: false,
        reason: "stuck_send_recovery",
      };
    }

    // Any audit_correction* key is a support-driven correction.
    const incomingAuditKeys = Object.keys(metadata).filter((key) =>
      key.startsWith("audit_correction"),
    );
    const lastAuditKeys = new Set(
      Object.keys(lastMetadata).filter((key) =>
        key.startsWith("audit_correction"),
      ),
    );
    const auditCorrectionAdded = incomingAuditKeys.some(
      (key) =>
        !lastAuditKeys.has(key) ||
        stableStringify(metadata[key]) !==
          stableStringify(lastMetadata[key]),
    );
    if (auditCorrectionAdded) {
      return {
        scenario: "metadata_only",
        severity: "info",
        message: "This campaign was updated by support.",
        detail: "Your content is unchanged. Reload to refresh.",
        localChangesAtRisk: false,
        reason: "audit_correction",
      };
    }

    return {
      scenario: "metadata_only",
      severity: "info",
      message:
        "This campaign was just updated by the platform (status or metadata change).",
      detail: "Your content is unchanged and your edits are safe. Reload to see the latest version.",
      localChangesAtRisk: false,
      reason: "metadata_generic",
    };
  }

  // Content actually changed server-side.
  if (hasUnsavedLocalChanges) {
    // SCENARIO C
    return {
      scenario: "content_with_local",
      severity: "warning",
      message:
        "This campaign content was modified in another tab or session.",
      detail: "Your current unsaved edits will be lost on reload.",
      localChangesAtRisk: true,
      reason: "content_changed",
    };
  }

  // SCENARIO B
  return {
    scenario: "content_no_local",
    severity: "warning",
    message: "This campaign content was modified in another tab.",
    detail: "Reload to see the latest version.",
    localChangesAtRisk: false,
    reason: "content_changed",
  };
}
