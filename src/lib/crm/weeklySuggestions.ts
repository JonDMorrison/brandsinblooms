/**
 * Weekly suggestion ranker for the dashboard.
 *
 * Inputs: the tenant's weekly themes, their recent campaigns, the current date.
 * Output: 2-3 suggestions to seed a Bloom conversation with, each one click
 * away from a drafted campaign.
 *
 * Rules — kept deliberately small so the ranking is easy to read and to test:
 *
 *  1. Drop themes labelled "Past". Past themes are over; they're noise here.
 *  2. Demote themes whose title (or close variant) matches a campaign the
 *     tenant has sent in the last 30 days. Repeating yourself two weeks later
 *     is the wrong nudge.
 *  3. "Current week" themes rank highest. "Future" themes within the next two
 *     weeks rank next, ordered by how soon they're current.
 *  4. If after filtering we have fewer than two suggestions, append an
 *     evergreen fallback ("New arrivals" / "Plant care tip") so the card never
 *     reads as empty.
 *  5. Return at most three.
 *
 * Bloom does the drafting and the follow-up — this helper only decides what to
 * suggest and writes the seed prompt for the conversation.
 */

import type { WeeklyTheme } from "@/hooks/useWeeklyThemes";

export interface RecentCampaignLite {
  /** Campaign name as it was sent. */
  name: string;
  /** ISO timestamp of when it left the queue (sentAt / sendCompletedAt). */
  sentAt: string | null;
}

export interface WeeklySuggestion {
  id: string;
  /** Headline shown on the card. */
  title: string;
  /** One short line explaining why this is the right nudge right now. */
  whyNow: string;
  /** Seed message written into bloom_proactive_insights.action_prompt. */
  seedPrompt: string;
  /** Underlying theme id when this suggestion came from a theme. */
  themeId: string | null;
  /** Flagged true when this is the evergreen fallback (no matching theme). */
  isEvergreen: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_SEND_WINDOW_DAYS = 30;
const FUTURE_WEEK_WINDOW = 2;

/**
 * Normalise titles so "Mother's Day Promotion" and "mothers day promotion"
 * count as the same recent send.
 */
function normaliseTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlap(a: string, b: string): number {
  const aTokens = new Set(normaliseTitle(a).split(" ").filter(Boolean));
  const bTokens = new Set(normaliseTitle(b).split(" ").filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let shared = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) shared += 1;
  }
  return shared / Math.min(aTokens.size, bTokens.size);
}

function wasRecentlySent(
  themeTitle: string,
  recent: RecentCampaignLite[],
  now: Date,
): boolean {
  const cutoff = now.getTime() - RECENT_SEND_WINDOW_DAYS * DAY_MS;
  for (const campaign of recent) {
    if (!campaign.sentAt) continue;
    const sentAt = new Date(campaign.sentAt).getTime();
    if (Number.isNaN(sentAt) || sentAt < cutoff) continue;
    if (tokenOverlap(themeTitle, campaign.name) >= 0.6) return true;
  }
  return false;
}

function whyNowForTheme(theme: WeeklyTheme): string {
  if (theme.isCurrentWeek) {
    return "This week's theme — perfect timing.";
  }
  if (theme.label === "Future") {
    return `Coming up — week ${theme.weekNumber}, worth getting ahead of.`;
  }
  return "A good one to send soon.";
}

function seedPromptForTheme(theme: WeeklyTheme): string {
  const teaser = theme.teaser?.trim() || theme.description?.trim() || "";
  return `Help me put together a campaign for "${theme.title}". ${teaser ? `Here's the angle: ${teaser}. ` : ""}Draft the subject line and the body in a friendly garden-centre voice. When you're ready, I'll review it before anything sends.`;
}

const EVERGREEN_FALLBACKS: ReadonlyArray<WeeklySuggestion> = [
  {
    id: "evergreen-new-arrivals",
    title: "New arrivals this week",
    whyNow: "An easy win whenever the shelves change.",
    seedPrompt:
      "Help me put together a 'new arrivals this week' campaign. Ask me which plants or products are new, then draft a friendly subject line and a short body that highlights two or three of them. I'll review before anything sends.",
    themeId: null,
    isEvergreen: true,
  },
  {
    id: "evergreen-care-tip",
    title: "Plant care tip of the week",
    whyNow: "Builds trust and keeps you in the inbox between sales.",
    seedPrompt:
      "Help me put together a quick plant-care tip campaign. Pick a topic that's seasonal for this part of the year, draft a friendly subject line, and write a short, practical tip with one or two follow-up suggestions. I'll review before anything sends.",
    themeId: null,
    isEvergreen: true,
  },
];

export interface RankWeeklySuggestionsInput {
  themes: WeeklyTheme[];
  recentCampaigns: RecentCampaignLite[];
  now?: Date;
  /** How many suggestions to return at most. Defaults to 3. */
  limit?: number;
}

export function rankWeeklySuggestions({
  themes,
  recentCampaigns,
  now = new Date(),
  limit = 3,
}: RankWeeklySuggestionsInput): WeeklySuggestion[] {
  const ranked: WeeklySuggestion[] = [];

  // 1 + 2: drop past + recently-sent themes; keep current and near-future only.
  const candidates = themes.filter((theme) => {
    if (theme.label === "Past") return false;
    if (wasRecentlySent(theme.title, recentCampaigns, now)) return false;
    if (theme.label === "Future" || !theme.isCurrentWeek) {
      // Reject far-future themes; keep the next two weeks worth of nudges.
      // The hook supplies weekNumber relative to today's week — we cap by
      // distance.
      const currentWeek = getCurrentWeekNumberFromDate(now);
      const weeksAhead = theme.weekNumber - currentWeek;
      if (weeksAhead > FUTURE_WEEK_WINDOW) return false;
    }
    return true;
  });

  // 3: sort by current first, then by how soon they're current.
  candidates.sort((left, right) => {
    if (left.isCurrentWeek && !right.isCurrentWeek) return -1;
    if (right.isCurrentWeek && !left.isCurrentWeek) return 1;
    return left.weekNumber - right.weekNumber;
  });

  for (const theme of candidates) {
    ranked.push({
      id: `theme-${theme.id}`,
      title: theme.title,
      whyNow: whyNowForTheme(theme),
      seedPrompt: seedPromptForTheme(theme),
      themeId: theme.id,
      isEvergreen: false,
    });
    if (ranked.length >= limit) break;
  }

  // 4: top up with evergreens if the list is thin.
  if (ranked.length < Math.min(2, limit)) {
    for (const fallback of EVERGREEN_FALLBACKS) {
      if (ranked.length >= limit) break;
      // Avoid duplicating a real campaign-title match the tenant just sent.
      if (wasRecentlySent(fallback.title, recentCampaigns, now)) continue;
      ranked.push(fallback);
    }
  }

  return ranked.slice(0, limit);
}

/**
 * Mirrors src/utils/dateUtils#getCurrentWeekNumber but accepts a date so the
 * ranker is deterministic in tests. ISO-style week of year (1-53).
 */
function getCurrentWeekNumberFromDate(date: Date): number {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * DAY_MS));
}
