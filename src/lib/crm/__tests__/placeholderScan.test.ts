import { describe, expect, it } from "vitest";

import {
  formatHeaderDate,
  formatPlaceholderFindings,
  refreshHeaderDates,
  scanBlocksForPlaceholders,
} from "@/lib/crm/placeholderScan";

describe("scanBlocksForPlaceholders", () => {
  it("detects the exact Flowerhouse incident scaffolds", () => {
    // Real block shapes from tenant 19c15e83…, campaign 5727e21b… — the
    // scaffold newsletter that reached 244 recipients.
    const blocks = [
      {
        label: "Image + Text",
        title: "Focus Headline",
        body: "<p>new things + reminder about blueberries if still available</p>",
      },
      {
        label: "Call to Action",
        title: "Voting Headline",
        content: "<p>(edit) tell customers to vote for their favourite</p>",
      },
    ];

    const findings = scanBlocksForPlaceholders(blocks);
    const phrases = findings.map((finding) => finding.phrase);

    expect(phrases).toContain("Focus Headline");
    expect(phrases).toContain("Voting Headline");
    expect(
      phrases.some((phrase) => phrase.toLowerCase().startsWith("(edit)")),
    ).toBe(true);
  });

  it("returns nothing for finished, real content (no false-positive friction)", () => {
    const blocks = [
      {
        label: "Newsletter Header",
        title: "The Flowerhouse",
        tagline: "Curated release",
      },
      {
        label: "Image + Text",
        title: "Fresh dahlias have landed",
        body: "<p>Our first dahlia crop of the season is in the shop today. Come see the full range before the weekend rush.</p>",
        ctaText: "Shop dahlias",
      },
      {
        label: "Call to Action",
        title: "Weekend workshop: hand-tied bouquets",
        content: "<p>Saturday 10am. Editing your garden beds? Bring photos and our team will help you plan.</p>",
        buttonText: "Reserve a spot",
      },
    ];

    expect(scanBlocksForPlaceholders(blocks)).toEqual([]);
  });

  it("matches scaffold headings exactly, not as substrings", () => {
    const blocks = [
      { label: "Text", title: "Our Focus This Month: Roses" },
      { label: "Text", headline: "Voting is open for bloom of the year" },
    ];
    expect(scanBlocksForPlaceholders(blocks)).toEqual([]);
  });

  it("detects TODO / TBD / lorem ipsum / bracketed notes", () => {
    const blocks = [
      { label: "Text", body: "<p>TODO write the intro paragraph</p>" },
      { label: "Text", content: "Pricing TBD after supplier call" },
      { label: "Hero", subtitle: "Lorem ipsum dolor sit amet" },
      { label: "Gallery", body: "[add photo of the new arrivals]" },
    ];

    const phrases = scanBlocksForPlaceholders(blocks).map((f) => f.phrase);
    expect(phrases.some((p) => p.startsWith("TODO"))).toBe(true);
    expect(phrases.some((p) => p.startsWith("TBD"))).toBe(true);
    expect(phrases.some((p) => p.toLowerCase().startsWith("lorem ipsum"))).toBe(
      true,
    );
    expect(phrases.some((p) => p.startsWith("[add photo"))).toBe(true);
  });

  it("does not fire on lowercase tk/tbd inside ordinary words", () => {
    const blocks = [
      {
        label: "Text",
        body: "<p>Stop by the deskt bkiosk — we restock tbdaily favourites and tkitchen herbs.</p>",
      },
    ];
    expect(scanBlocksForPlaceholders(blocks)).toEqual([]);
  });

  it("skips hidden blocks — they don't send", () => {
    const blocks = [
      { label: "Text", title: "Focus Headline", visible: false },
    ];
    expect(scanBlocksForPlaceholders(blocks)).toEqual([]);
  });

  it("deduplicates repeated phrases and caps the findings list", () => {
    const blocks = Array.from({ length: 20 }, (_, index) => ({
      label: `Block ${index}`,
      title: "Focus Headline",
      body: `<p>TODO item ${index}</p>`,
    }));

    const findings = scanBlocksForPlaceholders(blocks);
    const phrases = findings.map((f) => f.phrase);
    expect(new Set(phrases).size).toBe(phrases.length);
    expect(findings.length).toBeLessThanOrEqual(8);
  });

  it("strips HTML before matching so tags don't hide notes", () => {
    const blocks = [
      { label: "Text", body: "<p><strong>(edit)</strong> finish this section</p>" },
    ];
    const findings = scanBlocksForPlaceholders(blocks);
    expect(findings.length).toBe(1);
    expect(findings[0].phrase.toLowerCase()).toContain("(edit)");
  });
});

describe("formatPlaceholderFindings", () => {
  it("produces one user-facing line per finding with the block label", () => {
    const lines = formatPlaceholderFindings([
      { phrase: "Focus Headline", blockLabel: "Image + Text" },
    ]);
    expect(lines).toEqual(["“Focus Headline” in Image + Text"]);
  });
});

describe("refreshHeaderDates", () => {
  const NOW = new Date("2026-07-31T12:00:00Z");

  it("refreshes populated dateLabel and publishDate on cloned header blocks", () => {
    // The Flowerhouse July 31 send carried "July 24 2026" in its visible
    // header because clone copied metadata verbatim.
    const blocks = [
      {
        type: "newsletter-header",
        dateLabel: "July 24 2026",
        publishDate: "July 24 2026",
        title: "The Flowerhouse",
      },
      { type: "image-text", title: "Fresh stems" },
    ];

    const refreshed = refreshHeaderDates(blocks, NOW);
    const expected = formatHeaderDate(NOW);

    expect(refreshed[0].dateLabel).toBe(expected);
    expect(refreshed[0].publishDate).toBe(expected);
    // Untouched fields and blocks pass through.
    expect(refreshed[0].title).toBe("The Flowerhouse");
    expect(refreshed[1]).toBe(blocks[1]);
  });

  it("leaves empty date fields empty — never invents a date", () => {
    const blocks = [{ type: "newsletter-header", dateLabel: "", title: "x" }];
    const refreshed = refreshHeaderDates(blocks, NOW);
    expect(refreshed[0].dateLabel).toBe("");
    expect(refreshed[0]).toBe(blocks[0]);
  });

  it("passes through blocks with no date fields unchanged (same reference)", () => {
    const blocks = [{ type: "cta", title: "Shop now" }];
    expect(refreshHeaderDates(blocks, NOW)[0]).toBe(blocks[0]);
  });
});
