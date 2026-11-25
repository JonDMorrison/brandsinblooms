import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(__dirname, "../../supabase/functions/enhance-image-prompt/index.ts"), "utf8");
describe("image prompt migration source contract", () => {
  it("uses Luna with bounded output and no reasoning or storage", () => {
    expect(source).toContain('model: "gpt-6-luna"');
    expect(source).toContain('reasoning_effort: "none"');
    expect(source).toContain("max_completion_tokens: 200");
    expect(source).toContain("store: false");
  });
  it("validates an authenticated user before the provider request", () => {
    expect(source.indexOf("supabase.auth.getUser(token)")).toBeGreaterThan(0);
    expect(source.indexOf("supabase.auth.getUser(token)")).toBeLessThan(source.indexOf('fetch("https://api.openai.com/'));
    expect(source).toContain("authError || !user");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
  it("rejects incomplete or refused output and avoids prompt logging", () => {
    expect(source).toContain('finish_reason !== "stop"');
    expect(source).toContain("choice.message?.refusal");
    expect(source).not.toContain('console.log("Enhancing prompt:"');
    expect(source).not.toContain('console.log("Enhanced prompt:"');
  });
});
