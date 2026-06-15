import { describe, expect, it, vi } from "vitest";

import {
  applyAttestationToCustomer,
  attestationEventType,
  DEFAULT_ATTESTATION_CHOICE,
  getAttestationOption,
  IMPORT_ATTESTATION_OPTIONS,
  recordImportAttestation,
  recordImportConsentEvents,
} from "@/lib/crm/importConsent";

const FIXED_NOW = new Date("2026-06-15T23:37:00.000Z");

describe("applyAttestationToCustomer", () => {
  it("express attestation opts the contact in with a distinct method", () => {
    const fields = applyAttestationToCustomer("express", FIXED_NOW);
    expect(fields).toEqual({
      email_opt_in: true,
      email_consent_source: "import_attested",
      email_consent_method: "owner_attested_express",
      email_opt_in_at: FIXED_NOW.toISOString(),
    });
  });

  it("implied attestation opts the contact in with implied-consent method", () => {
    const fields = applyAttestationToCustomer("implied", FIXED_NOW);
    expect(fields.email_opt_in).toBe(true);
    expect(fields.email_consent_method).toBe("owner_attested_implied");
    expect(fields.email_opt_in_at).toBe(FIXED_NOW.toISOString());
  });

  it("unsure attestation leaves the contact pending (the safe default)", () => {
    const fields = applyAttestationToCustomer("unsure", FIXED_NOW);
    expect(fields).toEqual({
      email_opt_in: false,
      email_consent_source: "csv_import",
      email_consent_method: "pending_confirmation",
      email_opt_in_at: null,
    });
  });

  it("unsure matches the prior silent default field-for-field — the only thing that changed is now it's explicitly attested", () => {
    const fields = applyAttestationToCustomer("unsure");
    // Same shape as the hard-coded defaults at EnhancedSegmentImportDialog.tsx
    // lines 286-288 before this feature landed.
    expect(fields.email_opt_in).toBe(false);
    expect(fields.email_consent_source).toBe("csv_import");
    expect(fields.email_consent_method).toBe("pending_confirmation");
  });
});

describe("IMPORT_ATTESTATION_OPTIONS", () => {
  it("includes express, unsure, and implied with non-empty wording", () => {
    const ids = IMPORT_ATTESTATION_OPTIONS.map((option) => option.id);
    expect(ids).toEqual(["express", "unsure", "implied"]);
    for (const option of IMPORT_ATTESTATION_OPTIONS) {
      expect(option.wording.length).toBeGreaterThan(20);
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.detail.length).toBeGreaterThan(0);
    }
  });

  it("defaults to the safe option (unsure)", () => {
    expect(DEFAULT_ATTESTATION_CHOICE).toBe("unsure");
  });

  it("never includes the letters A-I as a standalone word in any user-facing copy", () => {
    // Voice rule from the glossary module (PR #68).
    const pattern = /\bA\.?I\.?\b/i;
    for (const option of IMPORT_ATTESTATION_OPTIONS) {
      expect(option.label, option.id).not.toMatch(pattern);
      expect(option.wording, option.id).not.toMatch(pattern);
      expect(option.detail, option.id).not.toMatch(pattern);
    }
  });

  it("implied option discloses the time limit (CASL compliance)", () => {
    const implied = getAttestationOption("implied");
    expect(implied.detail.toLowerCase()).toContain("time-limited");
  });
});

describe("attestationEventType", () => {
  it("maps each choice to its event_type literal", () => {
    expect(attestationEventType("express")).toBe("imported_attested_express");
    expect(attestationEventType("unsure")).toBe("imported_attested_unsure");
    expect(attestationEventType("implied")).toBe("imported_attested_implied");
  });
});

describe("recordImportAttestation", () => {
  function buildClient(insertedRow: { id: string }) {
    const single = vi.fn().mockResolvedValue({ data: insertedRow, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    return { from, insert, select, single };
  }

  it("writes a row with the exact wording the owner saw, and returns the id", async () => {
    const client = buildClient({ id: "attestation-uuid-1" });

    const id = await recordImportAttestation({
      client: { from: client.from } as never,
      tenantId: "tenant-a",
      attestedByUserId: "user-a",
      choice: "express",
      contactCount: 42,
      importBatchId: "import-2026-06-15.csv",
    });

    expect(id).toBe("attestation-uuid-1");
    expect(client.from).toHaveBeenCalledWith("consent_attestations");
    expect(client.insert).toHaveBeenCalledWith({
      tenant_id: "tenant-a",
      attested_by_user_id: "user-a",
      attestation_type: "express",
      contact_count: 42,
      source: "csv_import",
      import_batch_id: "import-2026-06-15.csv",
      attestation_wording: getAttestationOption("express").wording,
    });
  });

  it("records the unsure wording when the owner picks unsure", async () => {
    const client = buildClient({ id: "attestation-uuid-2" });

    await recordImportAttestation({
      client: { from: client.from } as never,
      tenantId: "tenant-a",
      attestedByUserId: "user-a",
      choice: "unsure",
      contactCount: 100,
    });

    const expected = getAttestationOption("unsure").wording;
    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        attestation_type: "unsure",
        contact_count: 100,
        attestation_wording: expected,
        import_batch_id: null,
      }),
    );
  });

  it("throws when the insert fails so the caller can surface the audit-write error", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "rls denied" } });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });

    await expect(
      recordImportAttestation({
        client: { from } as never,
        tenantId: "tenant-a",
        attestedByUserId: "user-a",
        choice: "express",
        contactCount: 1,
      }),
    ).rejects.toMatchObject({ message: "rls denied" });
  });
});

describe("recordImportConsentEvents", () => {
  function buildClient() {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    return { from, insert };
  }

  it("writes one event per contact pointing back at the attestation", async () => {
    const client = buildClient();

    await recordImportConsentEvents({
      client: { from: client.from } as never,
      tenantId: "tenant-a",
      attestationId: "attestation-uuid-1",
      choice: "express",
      contacts: [
        { id: "c-1", email: "a@example.com" },
        { id: "c-2", email: "b@example.com" },
      ],
    });

    expect(client.insert).toHaveBeenCalledTimes(1);
    expect(client.insert).toHaveBeenCalledWith([
      {
        tenant_id: "tenant-a",
        customer_id: "c-1",
        email: "a@example.com",
        event_type: "imported_attested_express",
        source: "import_attested",
        attestation_id: "attestation-uuid-1",
      },
      {
        tenant_id: "tenant-a",
        customer_id: "c-2",
        email: "b@example.com",
        event_type: "imported_attested_express",
        source: "import_attested",
        attestation_id: "attestation-uuid-1",
      },
    ]);
  });

  it("uses the pending source label for unsure attestations", async () => {
    const client = buildClient();

    await recordImportConsentEvents({
      client: { from: client.from } as never,
      tenantId: "tenant-a",
      attestationId: "attestation-uuid-2",
      choice: "unsure",
      contacts: [{ id: "c-1", email: "a@example.com" }],
    });

    expect(client.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: "imported_attested_unsure",
        source: "csv_import_pending",
      }),
    ]);
  });

  it("does nothing when given an empty contact list", async () => {
    const client = buildClient();

    await recordImportConsentEvents({
      client: { from: client.from } as never,
      tenantId: "tenant-a",
      attestationId: "attestation-uuid-3",
      choice: "express",
      contacts: [],
    });

    expect(client.insert).not.toHaveBeenCalled();
  });

  it("chunks large contact lists into multiple inserts", async () => {
    const client = buildClient();
    const contacts = Array.from({ length: 1234 }, (_, idx) => ({
      id: `c-${idx}`,
      email: `c${idx}@example.com`,
    }));

    await recordImportConsentEvents({
      client: { from: client.from } as never,
      tenantId: "tenant-a",
      attestationId: "att-1",
      choice: "express",
      contacts,
    });

    // 500 + 500 + 234 = 1234, three insert calls.
    expect(client.insert).toHaveBeenCalledTimes(3);
    expect((client.insert.mock.calls[0][0] as unknown[]).length).toBe(500);
    expect((client.insert.mock.calls[1][0] as unknown[]).length).toBe(500);
    expect((client.insert.mock.calls[2][0] as unknown[]).length).toBe(234);
  });
});
