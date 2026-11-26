import { describe, expect, it } from "vitest";
import {
  correctFalseFailureReply,
  toolOutcomeFrom,
} from "../../supabase/functions/bloom-assist/reply-guard";
import {
  buildNamedEntityContextNote,
  enforceNamedEntityReply,
  extractNamedEntityReferences,
  lookupNamedEntitiesInMessage,
  matchNamedEntity,
  nameSimilarity,
} from "../../supabase/functions/bloom-assist/named-entity-lookup";
import { queryCampaigns } from "../../supabase/functions/bloom-assist/tools/implementations/query-campaigns";
import { getToolCategoriesForRouting } from "../../supabase/functions/bloom-assist/tools/tool-routing";
import { BASE_SYSTEM_PROMPT } from "../../supabase/functions/bloom-assist/prompts/base-system-prompt";
import type { ToolExecutionContext } from "../../supabase/functions/bloom-assist/tools/types";

const tropicals = toolOutcomeFrom("completed", {
  success: true,
  message:
    "Search succeeded: 6,648 customers bought it. 14,971 have purchase records without it. 26,315 have no purchase records on file, so they are counted separately. This is a complete answer, not an error.",
  data: { trail: [{ label: "Top 50 Tropical Shoppers" }] },
});

describe("Bloom never reports a successful lookup as a failure", () => {
  it("replaces a false failure claim with what the search returned", () => {
    const reply = correctFalseFailureReply(
      "I attempted to retrieve the top 50 Tropical shoppers, but it seems there was an issue accessing the data. The result is currently unavailable.",
      [tropicals],
    );
    expect(reply).toBe(
      "Here is what I found.\n\nTop 50 Tropical Shoppers: 6,648 customers bought it. 14,971 have purchase records without it. 26,315 have no purchase records on file, so they are counted separately.",
    );
  });

  it("catches the other phrasings Bloom used", () => {
    for (const claim of [
      "It seems there was an issue retrieving the list of customers who purchased sea soil. The data could not be retrieved at this time.",
      "The purchase history could not be retrieved due to a timeout error.",
    ]) {
      expect(correctFalseFailureReply(claim, [tropicals])).toContain("6,648 customers bought it");
    }
  });

  it("leaves a correct answer alone", () => {
    const answer = "6,648 customers bought Tropicals. Jayne Ercog spent the most.";
    expect(correctFalseFailureReply(answer, [tropicals])).toBe(answer);
  });

  it("keeps the failure message when a lookup really failed", () => {
    const failed = toolOutcomeFrom("failed", { success: false, message: "The data lookup timed out before it finished." });
    const reply = "The purchase history could not be retrieved due to a timeout error.";
    expect(correctFalseFailureReply(reply, [tropicals, failed])).toBe(reply);
  });

  it("does nothing when no tool ran", () => {
    const reply = "I could not be retrieved anything without a question.";
    expect(correctFalseFailureReply(reply, [])).toBe(reply);
  });
});


const NORTHFIELD_CAMPAIGNS = [
  { id: "c1", name: "Newsletter Builder QA – November 25", created_at: "2026-11-25" },
  { id: "c2", name: "Winter Garden Maintenance", created_at: "2026-11-24" },
  { id: "c3", name: "", created_at: "2026-11-24" },
  { id: "c4", name: "Untitled Campaign", created_at: "2026-11-23" },
  { id: "c5", name: "Patio Season Kickoff", created_at: "2026-05-04" },
  { id: "c6", name: "Spring Perennial Sale", created_at: "2026-05-02" },
  { id: "c7", name: "Mother's Day Hanging Baskets", created_at: "2026-04-13" },
];

type Recorded = { table: string; method: string; args: unknown[] };

/** Supabase-like client. A query that used .or() (a name search) returns no rows. */
function namedClient(tables: Record<string, unknown[]>) {
  const calls: Recorded[] = [];
  return {
    calls,
    rpc: async () => ({ data: null, error: null }),
    from(table: string) {
      let searched = false;
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "neq", "is", "in", "gte", "lt", "lte", "not", "order", "limit", "range", "ilike", "or"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          if (method === "or" && table === "crm_campaigns") searched = true;
          return builder;
        };
      }
      builder.maybeSingle = async () => ({ data: null, error: null });
      builder.then = (resolve: (value: unknown) => unknown) => {
        const rows = searched ? [] : tables[table] ?? [];
        return Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve);
      };
      return builder;
    },
  };
}

describe("Bloom looks up a named record before answering about it", () => {
  it("finds the names users give campaigns, segments, products and customers", () => {
    expect(extractNamedEntityReferences("How much revenue did my Black Friday Blowout campaign bring in last year?")).toEqual([
      { entityType: "campaign", name: "Black Friday Blowout" },
    ]);
    expect(extractNamedEntityReferences("How many customers are in my VIP Buyers segment?")).toEqual([
      { entityType: "segment", name: "VIP Buyers" },
    ]);
    expect(extractNamedEntityReferences('How did the "spring promo" campaign do?')).toEqual([
      { entityType: "campaign", name: "spring promo" },
    ]);
    expect(extractNamedEntityReferences("What did customer Jane Smith buy?")).toEqual([
      { entityType: "customer", name: "Jane Smith" },
    ]);
    expect(extractNamedEntityReferences("How did my last campaign do?")).toEqual([]);
    expect(extractNamedEntityReferences("Show me my campaigns")).toEqual([]);
  });

  it("scores similar names above unrelated ones", () => {
    expect(nameSimilarity("VIP Buyers", "vip buyers")).toBe(1);
    expect(nameSimilarity("Spring Sale", "Spring Perennial Sale")).toBeGreaterThan(
      nameSimilarity("Spring Sale", "Patio Season Kickoff"),
    );
  });

  it("reports a missing campaign as not found with real campaign names", async () => {
    const client = namedClient({ crm_campaigns: NORTHFIELD_CAMPAIGNS });
    const [result] = await lookupNamedEntitiesInMessage(
      client as never,
      "tenant-1",
      "How much revenue did my Black Friday Blowout campaign bring in last year?",
    );
    expect(result.status).toBe("not_found");
    expect(result.match).toBeNull();
    const names = result.closestMatches.map((match) => match.name);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(NORTHFIELD_CAMPAIGNS.map((row) => row.name)).toContain(name);
    expect(names).not.toContain("");
    expect(names).not.toContain("Untitled Campaign");
    // Tenant scoped.
    expect(client.calls).toContainEqual({ table: "crm_campaigns", method: "eq", args: ["tenant_id", "tenant-1"] });

    const note = buildNamedEntityContextNote([result]) ?? "";
    expect(note).toContain('campaign "Black Friday Blowout": NOT FOUND');
    expect(note).toContain(`"${names[0]}"`);
    expect(note).toContain("Never give figures");
  });

  it("marks an exact name as found and a unique containing name as a close match", () => {
    const segments = [{ id: "s1", name: "VIP Buyers" }, { id: "s2", name: "Lapsed Customers" }];
    expect(matchNamedEntity({ entityType: "segment", name: "vip buyers" }, segments)).toMatchObject({
      status: "found",
      match: { id: "s1" },
    });
    expect(matchNamedEntity({ entityType: "campaign", name: "Mother's Day" }, NORTHFIELD_CAMPAIGNS)).toMatchObject({
      status: "close_match",
      match: { name: "Mother's Day Hanging Baskets" },
    });
  });

  it("replaces a reply that treats a missing campaign as real", async () => {
    const [result] = await lookupNamedEntitiesInMessage(
      namedClient({ crm_campaigns: NORTHFIELD_CAMPAIGNS }) as never,
      "tenant-1",
      "How much revenue did my Black Friday Blowout campaign bring in last year?",
    );
    const reply = enforceNamedEntityReply(
      "Unfortunately, there are no dated sales records connected for Northfield Garden Center, so I can't provide specific revenue figures for the Black Friday Blowout campaign from last year.",
      [result],
    );
    expect(reply).toContain('I couldn\'t find a campaign called "Black Friday Blowout"');
    expect(reply).toContain(`- ${result.closestMatches[0].name}`);
    expect(reply).not.toContain("dated sales records");
  });

  it("keeps an honest not-found reply and adds real names when it named none", async () => {
    const [result] = await lookupNamedEntitiesInMessage(
      namedClient({ crm_campaigns: NORTHFIELD_CAMPAIGNS }) as never,
      "tenant-1",
      "How did my Black Friday Blowout campaign do?",
    );
    const honest = `I couldn't find a campaign called Black Friday Blowout. Your closest campaigns are ${result.closestMatches[0].name}.`;
    expect(enforceNamedEntityReply(honest, [result])).toBe(honest);
    const bare = "I couldn't find a campaign called Black Friday Blowout.";
    expect(enforceNamedEntityReply(bare, [result])).toContain(result.closestMatches[0].name);
    const found = { ...result, status: "found" as const };
    expect(enforceNamedEntityReply("It made $500.", [found])).toBe("It made $500.");
  });

  it("returns found: false with the closest real campaigns when a name search matches nothing", async () => {
    const client = namedClient({ crm_campaigns: NORTHFIELD_CAMPAIGNS });
    const context = {
      tenantId: "tenant-1",
      authenticatedTenantId: "tenant-1",
      userId: "user",
      conversationId: "conversation",
      messageId: "message",
      timezone: "America/Vancouver",
      dataClient: client,
      serviceClient: client,
    } as unknown as ToolExecutionContext;
    const result = await queryCampaigns({ search: "Black Friday Blowout" }, context);
    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
    expect(result.message).toContain("found: false");
    expect(result.message).toMatch(/Closest real campaigns: "/);
    expect(result.message).toContain("Winter Garden Maintenance");
  });

  it("offers lookup tools whenever a record is named, and the prompt requires the lookup", () => {
    expect(getToolCategoriesForRouting("standard", { category: "content", complexity: "simple" }, true)?.has("query")).toBe(true);
    expect(getToolCategoriesForRouting("standard", { category: "navigation", complexity: "simple" }, true)?.has("query")).toBe(true);
    expect(getToolCategoriesForRouting("standard", { category: "navigation", complexity: "simple" })?.has("query")).toBe(false);
    expect(getToolCategoriesForRouting("image", { category: "image", complexity: "simple" }, true)?.has("query")).toBe(false);
    expect(BASE_SYSTEM_PROMPT).toContain("When the user names a campaign, segment, product or customer, look it up before answering");
  });
});
