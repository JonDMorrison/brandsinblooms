import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  explainReadFailure,
  pickInputs,
  readSuiteData,
  type SuiteDeps,
} from "../../supabase/functions/bloom-assist/tools/implementations/suite-tools";
import { SupportRpcError } from "../../supabase/functions/bloom-assist/tools/implementations/support-tools";
import { getRegisteredTool } from "../../supabase/functions/bloom-assist/tools/registry";
import type { ToolExecutionContext } from "../../supabase/functions/bloom-assist/tools/types";
import { createCampaign, updateCampaign } from "../../supabase/functions/bloom-assist/tools/implementations/campaign-mutations";
import type { JsonObject } from "../../supabase/functions/bloom-assist/types";

const context = { tenantId: "crm-tenant", userId: "user-1", userName: "Ann", serviceClient: {} } as unknown as ToolExecutionContext;

describe("Bloom campaign channel and sender routing contracts", () => {
  function harness(metadata: JsonObject = { campaignType: "email" }, profileCount = 1, memberIds = ["user-1"]) {
    let row: JsonObject = {
      id: "0cc95987-2fd9-43ea-96cb-834c876b063e", tenant_id: "crm-tenant",
      name: "Workshop", status: "draft", delivery_method: "custom_domain",
      content: "Original body", metadata, include_all_customers: false,
      additional_customer_ids: [], persona_ids: [], segment_id: null,
      sender_email: "hello@example.test",
    };
    const writes: JsonObject[] = [];
    const scopes: Array<[string, string, unknown]> = [];
    const client = {
      from(table: string) {
        let mutation: JsonObject | null = null;
        let operation = "read";
        const result = () => {
          if (mutation) {
            // Enforce the production check constraint, rather than accepting
            // a payload that Postgres would reject.
            if (mutation.delivery_method !== undefined && !["custom_domain", "shared_sender"].includes(String(mutation.delivery_method))) {
              return { data: null, error: new Error("crm_campaigns_delivery_method_check") };
            }
            writes.push(mutation);
            row = { ...row, ...mutation };
          }
          return { data: table === "crm_campaigns" && operation !== "delete" ? row
            : table === "users" ? memberIds.map((id) => ({ id }))
            : table === "company_profiles" ? Array.from({ length: profileCount }, () => ({ company_name: "My Nursery", feature_flags: { company_logo_url: "https://example.com/logo.png" } }))
            : [], error: null };
        };
        const query = {
          select() { return query; },
          insert(value: JsonObject) { mutation = value; operation = "insert"; return query; },
          update(value: JsonObject) { mutation = value; operation = "update"; return query; },
          delete() { operation = "delete"; return query; },
          eq(column: string, value: unknown) { scopes.push([table, column, value]); return query; },
          is() { return query; },
          ilike() { return query; },
          limit() { return query; },
          range() { return query; },
          in(column: string, value: unknown) { scopes.push([table, column, value]); return query; },
          single: async () => result(),
          maybeSingle: async () => result(),
          then(resolve: (value: ReturnType<typeof result>) => unknown) { return Promise.resolve(result()).then(resolve); },
        };
        return query;
      },
    };
    return {
      writes, scopes,
      context: { ...context, approved: true, serviceClient: client } as unknown as ToolExecutionContext,
      getRow: () => row,
    };
  }

  const newsletter = { name: "Workshop", delivery_method: "email", template_id: "botanical-editorial",
    newsletter_brief: { headline: "Come create", introduction: "A creative evening.", heroImageUrl: "https://example.com/wreath.jpg",
      features: [{ title: "Workshop", body: "Verified details", buttonText: "Book", buttonUrl: "https://example.com/book" }] } };

  it("creates a branded editable newsletter through the approved campaign tool", async () => {
    const h = harness();
    const result = await createCampaign(newsletter, h.context);
    expect(result.success).toBe(true);
    const metadata = h.writes[0].metadata as JsonObject;
    expect(metadata.templateId).toBe("botanical-editorial");
    expect(h.writes[0].content).toContain("Come create");
    expect(h.writes[0].content).not.toContain("Draft campaign content will be added later");
    expect(metadata.contentBlocks).toEqual(expect.arrayContaining([expect.objectContaining({ type: "email-safe-hero", layout: "editorial-panel", headline: "Come create" })]));
    expect(h.scopes).toContainEqual(["users", "tenant_id", "crm-tenant"]);
    expect(h.scopes).toContainEqual(["company_profiles", "user_id", ["user-1"]]);
    expect(h.writes[0].status).toBe("draft");
  });
  it("does not pick an operator's brand when operating another tenant", async () => {
    const h = harness();
    await createCampaign(newsletter, { ...h.context, userId: "outside-admin" });
    expect(h.scopes).toContainEqual(["company_profiles", "user_id", ["user-1"]]);
  });
  it("uses the tenant brand for a staff member without their own company profile", async () => {
    const h = harness(undefined, 1, ["user-1", "staff-member"]);
    const result = await createCampaign(newsletter, { ...h.context, userId: "staff-member" });
    expect(result.success).toBe(true);
    expect(h.scopes).toContainEqual(["company_profiles", "user_id", ["user-1", "staff-member"]]);
    expect(h.writes[0].content).toContain("My Nursery");
  });
  it("refuses ambiguous brand profiles before saving", async () => {
    const h = harness(undefined, 2);
    await expect(createCampaign(newsletter, { ...h.context, userId: "outside-admin" })).rejects.toThrow("multiple brand profiles");
    expect(h.writes).toHaveLength(0);
  });
  it("rejects incomplete newsletter briefs and SMS templates without writing", async () => {
    const h = harness();
    expect((await createCampaign({ ...newsletter, newsletter_brief: {} }, h.context)).success).toBe(false);
    expect((await createCampaign({ ...newsletter, delivery_method: "sms" }, h.context)).success).toBe(false);
    expect(h.writes).toHaveLength(0);
  });

  it.each(["email", "sms"])("creates an approved %s draft without writing the channel to sender routing", async (channel) => {
    const h = harness();
    const result = await createCampaign({ name: "Workshop", delivery_method: channel, content: "Draft body" }, h.context);
    expect(result.success).toBe(true);
    expect(h.writes[0]).not.toHaveProperty("delivery_method");
    expect(h.writes[0].metadata).toMatchObject({ campaignType: channel });
    expect(h.writes[0]).toMatchObject({ tenant_id: "crm-tenant", user_id: "user-1", status: "draft" });
  });

  it("updates the channel in metadata while preserving sender routing", async () => {
    const h = harness();
    const result = await updateCampaign({ campaign_id: h.getRow().id, changes: { delivery_method: "sms", content: "Updated SMS" } }, h.context);
    expect(result.success).toBe(true);
    expect(h.writes[0]).not.toHaveProperty("delivery_method");
    expect(h.writes[0].metadata).toMatchObject({ campaignType: "sms", smsMessage: "Updated SMS" });
    expect(h.scopes).toContainEqual(["crm_campaigns", "tenant_id", "crm-tenant"]);
  });

  it("preserves an SMS draft's channel when only its audience changes", async () => {
    const h = harness({ campaignType: "sms", smsMessage: "Original body" });
    await updateCampaign({ campaign_id: h.getRow().id, changes: { include_all_customers: false } }, h.context);
    expect(h.writes[0].metadata).toMatchObject({ campaignType: "sms", smsMessage: "Original body" });
  });

  it("updates SMS metadata when only the message body changes", async () => {
    const h = harness({ campaignType: "sms", smsMessage: "Original body" });
    await updateCampaign({ campaign_id: h.getRow().id, changes: { content: "New message" } }, h.context);
    expect(h.writes[0].metadata).toMatchObject({ campaignType: "sms", smsMessage: "New message" });
  });

  it("does not rebuild legacy audience metadata during a body-only edit", async () => {
    const metadata = { campaignType: "sms", includeAllCustomers: true, additionalCustomerIds: ["legacy-customer"], sourceSegmentId: "legacy-segment" };
    const h = harness(metadata);
    await updateCampaign({ campaign_id: h.getRow().id, changes: { content: "New message" } }, h.context);
    expect(h.writes[0].metadata).toMatchObject(metadata);
    expect(h.writes[0]).not.toHaveProperty("include_all_customers");
  });

  it("preserves newsletter design blocks when changing its audience", async () => {
    const blocks = [{ id: "hero-1", type: "text", content: "Saved newsletter" }];
    const h = harness({ campaignType: "email", contentBlocks: blocks, custom: "keep" });
    await updateCampaign({ campaign_id: h.getRow().id, changes: { include_all_customers: false } }, h.context);
    expect(h.writes[0].metadata).toMatchObject({ contentBlocks: blocks, custom: "keep" });
  });

  it("requires confirmation before creating a draft", async () => {
    const h = harness();
    const result = await createCampaign({ name: "Workshop", delivery_method: "email" }, { ...h.context, approved: false });
    expect(result.confirmation_required).toBe(true);
    expect(h.writes).toHaveLength(0);
  });
});

function deps(over: Partial<SuiteDeps> = {}): SuiteDeps & { runRead: ReturnType<typeof vi.fn> } {
  const runRead = vi.fn(async () => ({ pages: [{ id: "p1", title: "Home" }] }));
  return {
    rpcFor: () => (async () => null) as never,
    identity: async () => ({ principalId: "pr-1", role: "client", staff: false, ownTenantId: "crm-tenant", inAdminWorkspace: false, account: { id: "acct-1", name: "Sunny Gardens" } }),
    runRead,
    ...over,
  } as SuiteDeps & { runRead: ReturnType<typeof vi.fn> };
}

class StatusError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

describe("Bloom reads the website and point of sale through Support permissions", () => {
  it("is registered as a read-only query that needs no confirmation", () => {
    const tool = getRegisteredTool("read_suite_data");
    expect(tool?.category).toBe("query");
    expect(tool?.requires_confirmation).toBe(false);
    expect(tool?.risk_level).toBe("safe");
  });

  it("reads for the person's own principal and the company's own account", async () => {
    const d = deps();
    const result = await readSuiteData({ kind: "site.pages" }, context, d);
    expect(result.success).toBe(true);
    expect(d.runRead).toHaveBeenCalledWith(
      { principalId: "pr-1", role: "client", via: "crm_session", name: "Ann", scopes: [] },
      { kind: "site.pages", account_id: "acct-1", inputs: {} },
    );
    // No tenant_id at the top level, so the tenant-isolation scan still applies to everything else.
    expect(result.data).toEqual({ product: "bloomsites", kind: "site.pages", result: { pages: [{ id: "p1", title: "Home" }] } });
  });

  it("forwards only the inputs each read accepts", () => {
    expect(pickInputs("pos.sales_summary", { kind: "pos.sales_summary", from: "2026-10-01", to: "2026-10-31", store_id: "s1", account_id: "someone-else", actor: "admin" }))
      .toEqual({ from: "2026-10-01", to: "2026-10-31", store_id: "s1" });
    expect(pickInputs("site.read", { site_id: " site-9 ", q: "ignored" })).toEqual({ site_id: "site-9" });
  });

  it("refuses kinds that are not reads, such as publishing", async () => {
    const d = deps();
    const result = await readSuiteData({ kind: "site.publish" }, context, d);
    expect(result.success).toBe(false);
    expect(d.runRead).not.toHaveBeenCalled();
  });

  it("says plainly when the person has no access, without upstream detail", async () => {
    const d = deps({ runRead: vi.fn(async () => { throw new StatusError(403, "ops.pos.read required"); }) });
    const result = await readSuiteData({ kind: "pos.inventory" }, context, d);
    expect(result.success).toBe(false);
    expect(result.message).toContain("don't have access");
    expect(result.message).not.toContain("ops.pos.read");
  });

  it("explains a missing connection and a missing store", () => {
    expect(explainReadFailure("pos.products", new StatusError(400, "Account has no linked POS business"))).toContain("not connected");
    expect(explainReadFailure("site.pages", new StatusError(400, "Account has no linked BloomSites site"))).toContain("website is not connected");
    expect(explainReadFailure("pos.inventory", new StatusError(400, "Account has several pos links; pass pos_tenant_id"))).toContain("more than one");
    expect(explainReadFailure("pos.inventory", new StatusError(400, "store_id required"))).toContain("several stores");
    expect(explainReadFailure("site.read", new SupportRpcError("42501", "forbidden: account"))).toContain("could not connect your sign-in");
  });
});

describe("POS price history is a read like the others", () => {
  it("forwards only the variant and business", () => {
    expect(pickInputs("pos.price_history", { variant_id: "v-1", store_id: "ignored", q: "x" })).toEqual({ variant_id: "v-1" });
  });
});

describe("Website section edits are registered as draft-only Support changes", () => {
  const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../supabase/functions/_shared/bloom-support", p), "utf8");
  it("needs ops.site.edit and supports undo", () => {
    const policy = read("policy.ts");
    const ops = read("operations.ts");
    for (const kind of ["site.section.update", "site.section.reorder", "site.section.visibility"]) {
      expect(policy).toContain(`"${kind}": "ops.site.edit"`);
      expect(ops.slice(ops.indexOf("WRITE_OPERATIONS"), ops.indexOf("const PERMISSION"))).toContain(`"${kind}"`);
      expect(ops.slice(ops.indexOf("const UNDOABLE"))).toContain(`"${kind}"`);
    }
  });
  it("preview links are a read anyone with website read access can run from chat", () => {
    expect(pickInputs("site.preview_link", { content_id: "c1", patch: "x" })).toEqual({ content_id: "c1" });
  });
});

describe("Theme drafts are registered as Support changes", () => {
  const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../supabase/functions/_shared/bloom-support", p), "utf8");
  it("drafting needs ops.site.edit, publishing needs ops.site.publish, all undoable", () => {
    const policy = read("policy.ts");
    const ops = read("operations.ts");
    expect(policy).toContain('"site.theme.update": "ops.site.edit"');
    expect(policy).toContain('"site.theme.discard": "ops.site.edit"');
    expect(policy).toContain('"site.theme.publish": "ops.site.publish"');
    for (const kind of ["site.theme.update", "site.theme.publish", "site.theme.discard"]) {
      expect(ops.slice(ops.indexOf("WRITE_OPERATIONS"), ops.indexOf("const PERMISSION"))).toContain(`"${kind}"`);
      expect(ops.slice(ops.indexOf("const UNDOABLE"))).toContain(`"${kind}"`);
    }
  });
});

describe("Blog posts and SEO are registered as Support changes", () => {
  const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../supabase/functions/_shared/bloom-support", p), "utf8");
  it("drafting a post needs ops.site.edit; publishing a post and live SEO need ops.site.publish; all undoable", () => {
    const policy = read("policy.ts");
    const ops = read("operations.ts");
    expect(policy).toContain('"site.blog.create": "ops.site.edit"');
    expect(policy).toContain('"site.blog.update": "ops.site.edit"');
    expect(policy).toContain('"site.blog.publish": "ops.site.publish"');
    expect(policy).toContain('"site.seo.update": "ops.site.publish"');
    for (const kind of ["site.blog.create", "site.blog.update", "site.blog.publish", "site.seo.update"]) {
      expect(ops.slice(ops.indexOf("WRITE_OPERATIONS"), ops.indexOf("const PERMISSION"))).toContain(`"${kind}"`);
      expect(ops.slice(ops.indexOf("const UNDOABLE"))).toContain(`"${kind}"`);
      expect(ops.slice(ops.indexOf("READ_OPERATIONS"), ops.indexOf("WRITE_OPERATIONS"))).not.toContain(`"${kind}"`);
    }
  });
  it("the admin panel labels each kind and says SEO is live", () => {
    const panels = fs.readFileSync(path.resolve(__dirname, "../components/bloomSupport/AdminPanels.tsx"), "utf8");
    for (const kind of ["site.blog.create", "site.blog.update", "site.blog.publish", "site.seo.update"]) {
      expect(panels).toContain(`"${kind}": { label:`);
    }
    expect(panels).toMatch(/"site\.seo\.update": \{[^\n]*live page/);
  });
});
