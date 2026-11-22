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
  it("offers a delayed popup without changing inline forms", async () => {
    const { buildJavaScriptEmbedCode } = await import("./share");
    const options = {embedKey: "test", origin: "https://forms.example.com", delaySeconds: 3};
    expect(buildJavaScriptEmbedCode({...options, displayMode: "modal"})).toContain('data-trigger="delay" data-delay="3000"');
    expect(buildJavaScriptEmbedCode({...options, displayMode: "slide-in"})).toContain('data-delay="3000"');
    expect(buildJavaScriptEmbedCode({...options, displayMode: "inline"})).not.toContain('data-trigger');
    expect(buildJavaScriptEmbedCode({...options, displayMode: "modal", delaySeconds: NaN})).not.toContain('data-trigger');
  });

});
