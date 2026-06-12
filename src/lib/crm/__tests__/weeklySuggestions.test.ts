import { describe, expect, it } from "vitest";
import {
  rankWeeklySuggestions,
  type RecentCampaignLite,
} from "@/lib/crm/weeklySuggestions";
import type { WeeklyTheme } from "@/hooks/useWeeklyThemes";

function theme(overrides: Partial<WeeklyTheme>): WeeklyTheme {
  return {
    id: overrides.id ?? `t-${Math.random()}`,
    title: overrides.title ?? "Untitled theme",
    description: overrides.description ?? "",
    teaser: overrides.teaser ?? "",
    category: overrides.category ?? "plant_care",
    tags: overrides.tags ?? [],
    difficulty: overrides.difficulty ?? "intermediate",
    timeToComplete: overrides.timeToComplete ?? "1 hour",
    weekNumber: overrides.weekNumber ?? 1,
    label: overrides.label,
    isCurrentWeek: overrides.isCurrentWeek ?? false,
    campaignId: overrides.campaignId,
  };
}

function recentCampaign(
  name: string,
  daysAgo: number,
  now: Date,
): RecentCampaignLite {
  const sentAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return { name, sentAt: sentAt.toISOString() };
}

const APRIL_TUESDAY = new Date("2026-04-28T12:00:00Z"); // mid-April Tuesday

describe("rankWeeklySuggestions", () => {
  it("returns up to three suggestions when themes are abundant", () => {
    const ranked = rankWeeklySuggestions({
      themes: [
        theme({ id: "a", title: "Mother's Day Promotion", isCurrentWeek: true }),
        theme({ id: "b", title: "Spring Sale", weekNumber: 18, label: "Future" }),
        theme({ id: "c", title: "Workshop Series", weekNumber: 19, label: "Future" }),
        theme({ id: "d", title: "Lapsed customer win-back", weekNumber: 25, label: "Future" }),
      ],
      recentCampaigns: [],
      now: APRIL_TUESDAY,
    });

    expect(ranked.length).toBe(3);
    expect(ranked[0].title).toBe("Mother's Day Promotion");
    expect(ranked[0].themeId).toBe("a");
  });

  it("puts the current-week theme first, even if other themes come earlier in the array", () => {
    const ranked = rankWeeklySuggestions({
      themes: [
        theme({ id: "future-1", title: "Spring Sale", weekNumber: 18, label: "Future" }),
        theme({ id: "now", title: "Mother's Day Promotion", isCurrentWeek: true }),
      ],
      recentCampaigns: [],
      now: APRIL_TUESDAY,
    });

    expect(ranked[0].title).toBe("Mother's Day Promotion");
  });

  it("drops Past themes", () => {
    const ranked = rankWeeklySuggestions({
      themes: [
        theme({ id: "past", title: "Easter Promotion", label: "Past" }),
        theme({ id: "now", title: "Mother's Day Promotion", isCurrentWeek: true }),
      ],
      recentCampaigns: [],
      now: APRIL_TUESDAY,
    });

    expect(ranked.map((s) => s.title)).not.toContain("Easter Promotion");
  });

  it("excludes themes whose title overlaps a recently sent campaign (within 30 days)", () => {
    const ranked = rankWeeklySuggestions({
      themes: [
        theme({ id: "now", title: "Mother's Day Promotion", isCurrentWeek: true }),
        theme({ id: "soon", title: "Spring Sale", weekNumber: 18, label: "Future" }),
      ],
      recentCampaigns: [
        recentCampaign("Mothers Day Promotion - Final Call", 12, APRIL_TUESDAY),
      ],
      now: APRIL_TUESDAY,
    });

    expect(ranked.map((s) => s.title)).not.toContain("Mother's Day Promotion");
    expect(ranked.map((s) => s.title)).toContain("Spring Sale");
  });

  it("still allows a similar-title theme if the matching send was over 30 days ago", () => {
    const ranked = rankWeeklySuggestions({
      themes: [
        theme({ id: "now", title: "Mother's Day Promotion", isCurrentWeek: true }),
      ],
      recentCampaigns: [
        recentCampaign("Mother's Day Promotion (last year)", 400, APRIL_TUESDAY),
      ],
      now: APRIL_TUESDAY,
    });

    expect(ranked[0].title).toBe("Mother's Day Promotion");
  });

  it("tops up with evergreen fallbacks when fewer than two themes remain", () => {
    const ranked = rankWeeklySuggestions({
      themes: [
        theme({ id: "now", title: "Mother's Day Promotion", isCurrentWeek: true }),
      ],
      recentCampaigns: [],
      now: APRIL_TUESDAY,
    });

    expect(ranked.length).toBeGreaterThanOrEqual(2);
    expect(ranked[0].isEvergreen).toBe(false);
    expect(ranked.slice(1).some((s) => s.isEvergreen)).toBe(true);
  });

  it("never returns an empty list when there are no themes at all", () => {
    const ranked = rankWeeklySuggestions({
      themes: [],
      recentCampaigns: [],
      now: APRIL_TUESDAY,
    });

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((s) => s.isEvergreen)).toBe(true);
  });

  it("respects the limit argument", () => {
    const ranked = rankWeeklySuggestions({
      themes: [
        theme({ id: "a", title: "Mother's Day Promotion", isCurrentWeek: true }),
        theme({ id: "b", title: "Spring Sale", weekNumber: 18, label: "Future" }),
      ],
      recentCampaigns: [],
      now: APRIL_TUESDAY,
      limit: 1,
    });

    expect(ranked.length).toBe(1);
  });

  it("each returned suggestion carries a friendly why-now line and a non-empty seed prompt", () => {
    const ranked = rankWeeklySuggestions({
      themes: [
        theme({ id: "now", title: "Mother's Day Promotion", isCurrentWeek: true }),
      ],
      recentCampaigns: [],
      now: APRIL_TUESDAY,
    });

    expect(ranked[0].whyNow).toMatch(/.+/);
    expect(ranked[0].seedPrompt.length).toBeGreaterThan(40);
    expect(ranked[0].seedPrompt).toContain("Mother's Day Promotion");
  });
});
