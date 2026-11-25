import { describe, expect, it } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { renderFooterBlockToEmailHtml } from "@/lib/studio/emailHtmlGenerator";
import type { StudioBlock } from "@/types/studioBlocks";

const hours = "Mon–Fri 9am–6pm\nSat–Sun 10am–5pm (Dec 1–24: open until 8pm)";

describe("footer hours of operation", () => {
  it.each(["standard-dark", "light-minimal", "centered-branded"])("sit on their own lines in the %s layout", (layout) => {
    const footer = {
      ...createStudioBlock("footer"),
      layout,
      address: "36492 Lester Pearson Way\nAbbotsford, BC",
      hoursOfOperation: hours,
    } as StudioBlock;
    const html = renderFooterBlockToEmailHtml(footer, {}, null);
    const block = html.match(/<span data-footer-hours="true" style="display:block;">([\s\S]*?)<\/span>/)?.[1];
    expect(block).toBe("Mon–Fri 9am–6pm<br>Sat–Sun 10am–5pm (Dec 1–24: open until 8pm)");
    // Never run into the address with a middle dot.
    expect(html).not.toMatch(/Abbotsford, BC &middot; Mon/);
    expect(html).not.toMatch(/6pm &middot;/);
  });

  it("a footer without hours renders no hours line", () => {
    const html = renderFooterBlockToEmailHtml({ ...createStudioBlock("footer"), hoursOfOperation: "" } as StudioBlock, {}, null);
    expect(html).not.toContain("data-footer-hours");
  });
});
