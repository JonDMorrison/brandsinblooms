import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const inbound = readFileSync("supabase/functions/bloom-support-email/index.ts", "utf8");

describe("Bloom Support accepts real forwarded email evidence within safe limits", () => {
  it("has a separate bounded provider-response limit for long HTML and quoted conversations", () => {
    // A real forwarded customer thread with eight images exceeded the old 1 MB API-response cap.
    expect(inbound).toContain("readResponseText(res, 4 * 1024 * 1024)");
    expect(inbound).toContain("readBodyText(req, 256 * 1024)");
    expect(inbound).not.toContain("readResponseText(res, 1_000_000)");
  });
  it("preserves up to ten emailed screenshots without lifting the per-file or total caps", () => {
    expect(inbound).toContain("if (index >= 10)");
    expect(inbound).toContain("MAX_ATTACHMENT_BYTES");
    expect(inbound).toContain("MAX_ATTACHMENT_TOTAL_BYTES");
    expect(inbound).toContain("validateAttachmentFile(file)");
  });
});
