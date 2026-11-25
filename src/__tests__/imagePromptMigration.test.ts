import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { requestEnhancedImagePrompt } from "../../supabase/functions/enhance-image-prompt/provider";
import { SpendCapReachedError, type SpendMeter } from "../../supabase/functions/bloom-assist/security/spend-cap";

const source = fs.readFileSync(path.resolve(__dirname, "../../supabase/functions/enhance-image-prompt/index.ts"), "utf8");
const response = (choice: Record<string, unknown>) => new Response(JSON.stringify({
  choices: [choice], usage: { prompt_tokens: 30, completion_tokens: 10 },
}));
function mockMeter(block = false) {
  const settle = vi.fn(async () => {});
  const release = vi.fn(async () => {});
  const reserve = vi.fn(async () => {
    if (block) throw new SpendCapReachedError();
    return { settle, release };
  });
  const meter: SpendMeter = { tenantId: "verified-tenant", reserve, isOverCap: async () => block };
  return { meter, reserve, settle, release };
}
const prompts = { key: "mock", systemPrompt: "Botanical accuracy", userPrompt: "Spring garden" };
describe("image prompt migration", () => {
  it("uses Luna with bounded output and a tenant reservation before the provider", async () => {
    const { meter, reserve, settle } = mockMeter();
    const fetchImpl = vi.fn(async (_url: unknown, init: RequestInit) => {
      expect(reserve).toHaveBeenCalledTimes(1);
      expect(JSON.parse(init.body as string)).toMatchObject({
        model: "gpt-6-luna", reasoning_effort: "none", max_completion_tokens: 200, store: false,
      });
      return response({ finish_reason: "stop", message: { content: "  Garden scene  " } });
    });
    await expect(requestEnhancedImagePrompt({ ...prompts, meter }, fetchImpl as unknown as typeof fetch)).resolves.toBe("Garden scene");
    expect(reserve).toHaveBeenCalledWith("enhance-image-prompt", "gpt-6-luna", expect.any(Number));
    expect(settle).toHaveBeenCalledWith({ inputTokens: 30, outputTokens: 10 });
  });
  it("does not call the provider when the tenant cannot reserve spend", async () => {
    const { meter } = mockMeter(true);
    const fetchImpl = vi.fn();
    await expect(requestEnhancedImagePrompt({ ...prompts, meter }, fetchImpl as unknown as typeof fetch)).rejects.toBeInstanceOf(SpendCapReachedError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it.each([
    { finish_reason: "length", message: { content: "partial" } },
    { finish_reason: "stop", message: { refusal: "refused", content: "" } },
    { finish_reason: "stop", message: { content: " " } },
  ])("rejects incomplete or refused output while settling usage", async choice => {
    const { meter, settle } = mockMeter();
    await expect(requestEnhancedImagePrompt({ ...prompts, meter }, async () => response(choice))).rejects.toThrow("Image prompt enhancement unavailable");
    expect(settle).toHaveBeenCalledWith({ inputTokens: 30, outputTokens: 10 });
  });
  it("authenticates and derives the company server-side before reserving", () => {
    const auth = source.indexOf("supabase.auth.getUser(token)");
    const membership = source.indexOf('.from("users").select("tenant_id").eq("id", user.id)');
    const reserve = source.indexOf("const meter = createSpendMeter");
    const call = source.indexOf("const enhancedPrompt = await requestEnhancedImagePrompt");
    expect(auth).toBeGreaterThan(0);
    expect(membership).toBeGreaterThan(auth);
    expect(reserve).toBeGreaterThan(membership);
    expect(call).toBeGreaterThan(reserve);
    expect(source).toContain("resolveAdminWorkspaceTenant(supabase, user.id)");
    expect(source).toContain("tenantId, userId: user.id");
    expect(source).not.toContain('console.log("Enhancing prompt:"');
    expect(source).not.toContain('console.log("Enhanced prompt:"');
  });
});
