import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  intakeEvidenceNote,
  LIVE_EVIDENCE_DESCRIPTION,
} from "../../supabase/functions/_shared/bloom-support/readiness-evidence";

describe("Bloom Support readiness evidence", () => {
  it("reports a recent real support request without making a deployment claim", () => {
    expect(intakeEvidenceNote({
      configured: true,
      lastObservedAt: "2026-11-06T12:00:00.000Z",
      sourceLabel: "BloomSites",
      missingConfigurationNote: "missing",
    })).toBe("A real support request from BloomSites was observed in this environment within the last 30 days.");
  });

  it("distinguishes configured-but-unobserved intake from a failed health check", () => {
    expect(intakeEvidenceNote({
      configured: true,
      lastObservedAt: null,
      sourceLabel: "POS",
      missingConfigurationNote: "missing",
    })).toBe("Configured in Bloom; no real support request from POS has been observed in this environment within the last 30 days.");
    expect(LIVE_EVIDENCE_DESCRIPTION).toContain("not a deployment or health check");
  });

  it("reports missing configuration instead of an observation state", () => {
    expect(intakeEvidenceNote({
      configured: false,
      lastObservedAt: null,
      sourceLabel: "BloomSites",
      missingConfigurationNote: "Bloom Support is missing BLOOM_INTAKE_SECRET_CMS",
    })).toBe("Bloom Support is missing BLOOM_INTAKE_SECRET_CMS");
  });

  it("keeps the API and admin UI explicit about the evidence meaning", () => {
    const readiness = readFileSync("supabase/functions/_shared/bloom-support/readiness.ts", "utf8");
    const panel = readFileSync("src/components/bloomSupport/desk/SystemStatusPanel.tsx", "utf8");

    expect(readiness).toContain("live_evidence: LIVE_EVIDENCE_DESCRIPTION");
    expect(readiness).not.toContain("Needs the CRM frontend deployed from the merged PR");
    expect(readiness).not.toContain("OAuth approval page needs the CRM frontend deployed");
    expect(panel).toContain("Last observed success");
    expect(panel).toContain("No recent evidence");
    expect(panel).not.toContain("Last seen working");
  });
});
