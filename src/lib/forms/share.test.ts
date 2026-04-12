import { afterEach, describe, expect, it, vi } from "vitest";

describe("form share runtime URLs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the app-hosted static embed runtime by default", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://udldmkqwnxhdeztyqcaa.supabase.co");

    const share = await import("./share");
    const origin = "https://forms.example.com";
    const expectedUrl = `${origin}/forms/embed.v${share.STATIC_EMBED_RUNTIME_VERSION}.js`;

    expect(share.getStaticEmbedScriptUrl(origin)).toBe(expectedUrl);
    expect(
      share.buildJavaScriptEmbedCode({
        embedKey: "embed_123",
        origin,
      }),
    ).toContain(expectedUrl);
    expect(
      share.buildReactEmbedCode({
        embedKey: "embed_123",
        origin,
      }),
    ).toContain(expectedUrl);
    expect(expectedUrl).not.toContain("qcaa");
  });
});
