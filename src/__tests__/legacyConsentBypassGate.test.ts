import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tagConsentImplementation } from "../../supabase/functions/bloom-assist/tools/implementations/tag-consent-tools";
import type { ToolExecutionContext } from "../../supabase/functions/bloom-assist/tools/types";
import type { JsonObject } from "../../supabase/functions/bloom-assist/types";

const emailConsent = readFileSync("src/lib/crm/emailConsent.ts", "utf8");
const smsConsent = readFileSync("src/lib/crm/smsConsent.ts", "utf8");
const bloomConsentTool = readFileSync(
  "supabase/functions/bloom-assist/tools/implementations/tag-consent-tools.ts",
  "utf8",
);

const TENANT = "11111111-1111-4111-8111-111111111111";
const CUSTOMER = "22222222-2222-4222-8222-222222222222";

type Call = { method: string; args: unknown[] };

/** A user-scoped client that records every table write and RPC call. */
function fakeUserClient(customer: Record<string, unknown> | null) {
  const writes: Call[] = [];
  const reads: Call[] = [];
  const rpcs: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "is"]) {
        builder[method] = (...args: unknown[]) => {
          reads.push({ method: `${table}.${method}`, args });
          return builder;
        };
      }
      for (const method of ["update", "insert", "upsert", "delete"]) {
        builder[method] = (...args: unknown[]) => {
          writes.push({ method: `${table}.${method}`, args });
          return builder;
        };
      }
      builder.maybeSingle = async () => ({ data: customer, error: null });
      return builder;
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcs.push({ fn, args });
      return {
        data: {
          customerId: CUSTOMER,
          tenantId: TENANT,
          statusChanged: true,
          cancelledQueuedMessages: 0,
          recordedAt: "2026-11-24T12:00:00Z",
        },
        error: null,
      };
    },
  };
  return { client, writes, reads, rpcs };
}

function toolContext(dataClient: unknown): ToolExecutionContext {
  return {
    tenantId: TENANT,
    userId: "user-1",
    approved: true,
    dataClient,
    serviceClient: {
      from: () => {
        throw new Error("the service client must not be used for consent");
      },
      rpc: () => {
        throw new Error("the service client must not be used for consent");
      },
    },
  } as unknown as ToolExecutionContext;
}

const smsCustomer = {
  id: CUSTOMER,
  tenant_id: TENANT,
  first_name: "Ada",
  last_name: "Lovelace",
  email: "ada@example.com",
  phone: "+15555550100",
  email_opt_in: false,
  sms_opt_in: false,
};

async function runManageConsent(params: JsonObject, dataClient: unknown) {
  const manageConsent = tagConsentImplementation("manage_consent");
  if (!manageConsent) throw new Error("manage_consent is not registered");
  return manageConsent(params, toolContext(dataClient));
}

describe("Bloom manage_consent changes only the requested channel", () => {
  it("never writes the email unsubscribe flag from an SMS action", () => {
    expect(bloomConsentTool).not.toMatch(/\bopt_out\s*=/);
    expect(bloomConsentTool).not.toMatch(/(?<![a-z_])opt_out\s*:/);
    expect(bloomConsentTool).not.toContain('.from("crm_sms_consent_events")');
    expect(bloomConsentTool).not.toContain('.from("crm_email_consent_events")');
    expect(bloomConsentTool).toContain(
      '"set_customer_marketing_consent_authorized"',
    );
  });

  it("keeps the unused phone-wide opt-out helper deleted", () => {
    expect(existsSync("src/lib/compliance/OptOutChecker.ts")).toBe(false);
  });

  it.each(["opt_in", "opt_out"])(
    "routes an SMS %s through the guarded RPC with no direct customer write",
    async (action) => {
      const fake = fakeUserClient(smsCustomer);
      const result = await runManageConsent(
        {
          customer_id: CUSTOMER,
          channel: "sms",
          action,
          source: "in_store",
          consent_basis: "express",
          evidence: "Signed the SMS sign-up card at the till today",
        },
        fake.client,
      );

      expect(result.success).toBe(true);
      expect(fake.writes).toEqual([]);
      expect(fake.reads).toContainEqual({
        method: "crm_customers.eq",
        args: ["tenant_id", TENANT],
      });
      expect(fake.rpcs).toHaveLength(1);
      const [{ fn, args }] = fake.rpcs;
      expect(fn).toBe("set_customer_marketing_consent_authorized");
      expect(args).toMatchObject({
        p_customer_id: CUSTOMER,
        p_channel: "sms",
        p_opt_in: action === "opt_in",
        p_source: "in_store",
        p_consent_basis: action === "opt_in" ? "express" : null,
      });
      expect(String(args.p_evidence)).toContain("Recorded via Bloom Assist");
      for (const key of Object.keys(args)) {
        expect(key).not.toMatch(/email|opt_out/);
      }
    },
  );

  it("defaults an opt-out with no stated source to an admin correction", async () => {
    const fake = fakeUserClient(smsCustomer);
    const result = await runManageConsent(
      { customer_id: CUSTOMER, channel: "sms", action: "opt_out" },
      fake.client,
    );
    expect(result.success).toBe(true);
    expect(fake.rpcs[0].args).toMatchObject({
      p_opt_in: false,
      p_source: "admin_correction",
    });
  });

  it("refuses an opt-in without a lawful basis and evidence", async () => {
    const fake = fakeUserClient(smsCustomer);
    const result = await runManageConsent(
      {
        customer_id: CUSTOMER,
        channel: "sms",
        action: "opt_in",
        source: "in_store",
      },
      fake.client,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("validation_error");
    expect(fake.rpcs).toEqual([]);
    expect(fake.writes).toEqual([]);
  });

  it("fails closed without the signed-in user's client", async () => {
    const result = await runManageConsent(
      { customer_id: CUSTOMER, channel: "sms", action: "opt_out" },
      undefined,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("forbidden");
  });

  it("does not touch a customer outside the tenant", async () => {
    const fake = fakeUserClient(null);
    const result = await runManageConsent(
      { customer_id: CUSTOMER, channel: "sms", action: "opt_out" },
      fake.client,
    );
    expect(result.error).toBe("customer_not_found");
    expect(fake.rpcs).toEqual([]);
  });
});

describe("legacy consent helpers cannot bypass the atomic consent ledger", () => {
  it.each([
    ["email", emailConsent],
    ["sms", smsConsent],
  ])("routes %s staff changes through the guarded RPC", (_channel, source) => {
    const updateHelper = source.slice(
      source.indexOf("export async function updateCustomer"),
    );
    expect(updateHelper).toContain(
      'rpc(\n      "set_customer_marketing_consent_authorized"',
    );
    expect(updateHelper).not.toContain('.from("crm_customers").update');
    expect(updateHelper).not.toContain('.from("suppression_list")');
  });

  it.each([
    ["email", emailConsent],
    ["sms", smsConsent],
  ])("fails closed when %s opt-in evidence is absent", (_channel, source) => {
    expect(source).toContain("params.consentBasis");
    expect(source).toContain("params.evidence?.trim().length");
    expect(source).toContain("Opt-in requires a lawful basis");
  });
});
