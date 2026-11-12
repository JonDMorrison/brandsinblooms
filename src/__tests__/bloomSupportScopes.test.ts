import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../supabase/functions", p), "utf8");

describe("Read-only Bloom Support keys stay read-only", () => {
  it("MCP refuses a write tool call from a read-only key before running it", () => {
    const mcp = read("bloom-support-mcp/index.ts");
    const call = mcp.slice(mcp.indexOf('case "tools/call"'));
    const guard = call.indexOf("if (!tool.readOnly && readOnlyCaller)");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(call.indexOf("await tool.run("));
  });

  it("saving and deleting views need write scope", () => {
    const service = read("_shared/bloom-support/service.ts");
    for (const fn of ["saveView(", "deleteView(", "sendAndSolve(", "reconcileTicketLinks("]) {
      const body = service.slice(service.indexOf(fn), service.indexOf("},", service.indexOf(fn)));
      expect(body).toContain("requireWriteScope(c)");
    }
  });

  it("a draft campaign edit records no undo it cannot perform", () => {
    const ops = read("_shared/bloom-support/operations.ts");
    expect(ops).not.toContain('undo: before ? { kind: "campaign.update_draft"');
  });
});


describe("Guarded ticket-link reconciliation", () => {
  it("uses a staff-only action and a non-read-only MCP tool", () => {
    const service = read("_shared/bloom-support/service.ts");
    const action = service.slice(service.indexOf("reconcileTicketLinks("), service.indexOf("  setSpam("));
    expect(action).toContain("requireWriteScope(c)");
    expect(action).toContain('["platform_admin", "platform_operator", "support"].includes(c.role)');
    expect(action).toContain('directRpc("bloom_support_reconcile_ticket_links"');
    const mcp = read("bloom-support-mcp/index.ts");
    const tool = mcp.slice(mcp.indexOf('name: "reconcile_ticket_links"'), mcp.indexOf('name: "related_tickets"'));
    expect(tool).toContain("readOnly: false");
    expect(tool).toContain('["ticket_id", "version", "expected", "clear_inherited", "reason", "next_action", "idempotency_key"]');
    expect(tool).toContain("actions.reconcileTicketLinks(c, String(ticket_id), request)");
    expect(read("bloom-support-api/index.ts")).toContain('"/tickets/:id/reconcile-links"');
  });

  it("pins the tuple and preserves independent associations in the database", () => {
    const sql = fs.readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261112151238_bloom_support_reconcile_ticket_links.sql"), "utf8");
    expect(sql).toContain("bloom_support.require_permission(p_actor, 'tickets.write')");
    expect(sql).toContain("bloom_support.is_staff(p_actor)");
    expect(sql).toContain("ORDER BY id FOR UPDATE");
    expect(sql).toContain("actual IS DISTINCT FROM expected");
    expect(sql).toContain("receipt.request IS DISTINCT FROM p_request");
    expect(sql).toContain("bloom_support.feature_evidence");
    expect(sql).toContain("bloom_support.feature_shipment_subscriptions");
    expect(sql).toContain("selected link has independent evidence");
    expect(sql).toContain("FROM PUBLIC, anon, authenticated");
    expect(sql).not.toMatch(/UPDATE bloom_support\.(feature_requests|messages|engineering_issues)/);
    expect(sql).not.toContain("enqueue_job");
  });
});
