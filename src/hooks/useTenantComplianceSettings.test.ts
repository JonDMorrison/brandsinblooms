import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Json } from "@/integrations/supabase/types";

// In-memory stand-in for public.tenant_compliance_settings keyed by tenant_id.
const store = new Map<string, Json>();
const calls: Array<{ op: string; tenantId: string }> = [];

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    if (table !== "tenant_compliance_settings") {
      throw new Error(`unexpected table ${table}`);
    }
    return {
      select: () => ({
        eq: (_column: string, tenantId: string) => ({
          maybeSingle: async () => {
            calls.push({ op: "select", tenantId });
            const settings = store.get(tenantId);
            return { data: settings ? { settings } : null, error: null };
          },
        }),
      }),
      upsert: (row: { tenant_id: string; settings: Json }) => {
        calls.push({ op: "upsert", tenantId: row.tenant_id });
        store.set(row.tenant_id, row.settings);
        return {
          select: () => ({
            single: async () => ({ data: { settings: row.settings }, error: null }),
          }),
        };
      },
    };
  };
  return { supabase: { from } };
});

import {
  fetchTenantComplianceSettings,
  saveTenantComplianceSettings,
} from "./useTenantComplianceSettings";
import {
  COMPLIANCE_SETTING_ENFORCED,
  DEFAULT_COMPLIANCE_SETTINGS,
  parseComplianceSettings,
} from "@/lib/complianceSettings";

const TENANT_A = "3eade43c-2e5a-4ad0-80fb-500e3d7afbd4";
const TENANT_B = "c190325a-5da0-49f6-b374-187464762021";

describe("tenant compliance settings persistence", () => {
  beforeEach(() => {
    store.clear();
    calls.length = 0;
  });

  it("loads defaults when the tenant has no saved row", async () => {
    const loaded = await fetchTenantComplianceSettings(TENANT_A);
    expect(loaded.privacyPolicyText).toBe(DEFAULT_COMPLIANCE_SETTINGS.privacyPolicyText);
    expect(calls).toEqual([{ op: "select", tenantId: TENANT_A }]);
  });

  it("persists per tenant and loads the saved values back", async () => {
    await saveTenantComplianceSettings(TENANT_A, {
      ...DEFAULT_COMPLIANCE_SETTINGS,
      privacyPolicyText: "We keep garden club data for one season.",
      quietHoursStart: "21:00",
      dataRetentionDays: 400,
    });

    const reloaded = await fetchTenantComplianceSettings(TENANT_A);
    expect(reloaded.privacyPolicyText).toBe("We keep garden club data for one season.");
    expect(reloaded.quietHoursStart).toBe("21:00");
    expect(reloaded.dataRetentionDays).toBe(400);

    const other = await fetchTenantComplianceSettings(TENANT_B);
    expect(other.privacyPolicyText).toBe(DEFAULT_COMPLIANCE_SETTINGS.privacyPolicyText);
  });

  it("never stores or shows an unenforced toggle as on", async () => {
    await saveTenantComplianceSettings(TENANT_A, {
      ...DEFAULT_COMPLIANCE_SETTINGS,
      doubleOptInRequired: true,
      ageVerificationRequired: true,
      includeOptOutInstructions: true,
      quietHoursEnabled: true,
    });

    const stored = store.get(TENANT_A) as Record<string, unknown>;
    expect(stored.double_opt_in_required).toBe(COMPLIANCE_SETTING_ENFORCED.doubleOptInRequired);
    expect(stored.age_verification_required).toBe(false);

    const reloaded = await fetchTenantComplianceSettings(TENANT_A);
    expect(reloaded.doubleOptInRequired).toBe(false);
    expect(reloaded.ageVerificationRequired).toBe(false);
    expect(reloaded.includeOptOutInstructions).toBe(false);
    expect(reloaded.quietHoursEnabled).toBe(false);
  });

  it("ignores a stored 'on' flag for an unenforced setting and tolerates bad values", () => {
    const parsed = parseComplianceSettings({
      double_opt_in_required: true,
      quiet_hours: { enabled: true, start: "25:99", end: "07:30" },
      data_retention: { days: 5, mode: "shred" },
    });
    expect(parsed.doubleOptInRequired).toBe(false);
    expect(parsed.quietHoursEnabled).toBe(false);
    expect(parsed.quietHoursStart).toBe(DEFAULT_COMPLIANCE_SETTINGS.quietHoursStart);
    expect(parsed.quietHoursEnd).toBe("07:30");
    expect(parsed.dataRetentionDays).toBe(30);
    expect(parsed.dataHandlingMode).toBe("anonymize");
  });
});
