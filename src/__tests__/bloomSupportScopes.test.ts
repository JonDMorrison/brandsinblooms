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
    for (const fn of ["saveView(", "deleteView("]) {
      const body = service.slice(service.indexOf(fn), service.indexOf("},", service.indexOf(fn)));
      expect(body).toContain("requireWriteScope(c)");
    }
  });

  it("a draft campaign edit records no undo it cannot perform", () => {
    const ops = read("_shared/bloom-support/operations.ts");
    expect(ops).not.toContain('undo: before ? { kind: "campaign.update_draft"');
  });
});
