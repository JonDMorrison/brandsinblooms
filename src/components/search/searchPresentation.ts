import type { RecentSearchItemEntry } from "@/components/search/searchHistory";
import type { SearchResultGroup } from "@/components/search/types";

export type SearchHighlightSegment = {
  matched: boolean;
  text: string;
};

type BuildSearchSuggestionsParams = {
  query: string;
  recentItems: RecentSearchItemEntry[];
  recentSearches: string[];
  results: SearchResultGroup[];
  limit?: number;
};

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenizeSearchValue(value: string) {
  return Array.from(new Set(normalizeSearchValue(value).match(/[a-z0-9]+/g) ?? []));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildHighlightedTextSegments(
  text: string,
  query: string,
): SearchHighlightSegment[] {
  const tokens = tokenizeSearchValue(query).sort((left, right) => right.length - left.length);

  if (!text || tokens.length === 0) {
    return [{ matched: false, text }];
  }

  const matcher = new RegExp(`(${tokens.map((token) => escapeRegExp(token)).join("|")})`, "ig");
  const segments: SearchHighlightSegment[] = [];
  let currentIndex = 0;

  for (const match of text.matchAll(matcher)) {
    const matchText = match[0] ?? "";
    const matchIndex = match.index ?? -1;

    if (!matchText || matchIndex < 0) {
      continue;
    }

    if (matchIndex > currentIndex) {
      segments.push({
        matched: false,
        text: text.slice(currentIndex, matchIndex),
      });
    }

    segments.push({
      matched: true,
      text: matchText,
    });
    currentIndex = matchIndex + matchText.length;
  }

  if (currentIndex < text.length) {
    segments.push({
      matched: false,
      text: text.slice(currentIndex),
    });
  }

  return segments.length > 0 ? segments : [{ matched: false, text }];
}

export function buildSearchSuggestions({
  query,
  recentItems,
  recentSearches,
  results,
  limit = 4,
}: BuildSearchSuggestionsParams) {
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery || normalizedQuery.length < 2) {
    return [] as string[];
  }

  const seenSuggestions = new Set<string>();
  const suggestions: string[] = [];
  const candidates = [
    ...recentSearches,
    ...recentItems.map((entry) => entry.item.title),
    ...results.flatMap((group) => group.results.map((item) => item.title)),
  ];

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeSearchValue(candidate);

    if (
      !normalizedCandidate ||
      normalizedCandidate === normalizedQuery ||
      seenSuggestions.has(normalizedCandidate)
    ) {
      continue;
    }

    if (
      normalizedCandidate.startsWith(normalizedQuery) ||
      normalizedCandidate.includes(normalizedQuery)
    ) {
      seenSuggestions.add(normalizedCandidate);
      suggestions.push(candidate);
    }

    if (suggestions.length >= limit) {
      break;
    }
  }

  return suggestions;
}