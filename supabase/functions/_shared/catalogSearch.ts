// Search matching for website catalogue items (connected-content).
//
// Pure module: no Deno or npm imports, so the browser tests can load it too.
// Matching is case-insensitive, accent-insensitive and partial-word, covers
// the title, description, category, subcategory and tags, and treats simple
// singular/plural forms as the same word ("hydrangea" finds "Hydrangeas",
// "hydrangeas" finds "Hydrangea", "lily" finds "Lilies").

const MAX_QUERY_LENGTH = 100;
const MAX_QUERY_WORDS = 8;

/** Lower-case, accents and markup removed, punctuation collapsed to spaces. */
export function normalizeSearchText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The words of a search box value, normalized. */
export function searchWords(query: string): string[] {
  const normalized = normalizeSearchText(query.slice(0, MAX_QUERY_LENGTH));
  return normalized ? normalized.split(" ").slice(0, MAX_QUERY_WORDS) : [];
}

/** "hydrangeas" -> "hydrangea", "lilies" -> "lily", "boxes" -> "box". */
export function singularWord(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(?:ch|sh|ss|x|z)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !/(?:ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

/** Every form of one search word that counts as a match. */
export function wordVariants(word: string): string[] {
  const singular = singularWord(word);
  // A substring match on the singular already covers its plural
  // ("hydrangea" is inside "hydrangeas"); "y" -> "ies" is the exception.
  const forms = new Set([word, singular]);
  if (singular.length > 2 && singular.endsWith("y")) forms.add(`${singular.slice(0, -1)}ies`);
  return [...forms];
}

/**
 * The query with each word in singular form, or "" when that is the same as
 * the query. Sent upstream as a second search so a catalogue that matches
 * whole words still finds "Hydrangea" for "hydrangeas".
 */
export function singularQuery(query: string): string {
  const words = searchWords(query);
  const singular = words.map(singularWord);
  return singular.join(" ") !== words.join(" ") ? singular.join(" ") : "";
}

function textValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry === "string") return [entry];
      if (entry && typeof entry === "object" && "name" in entry && typeof entry.name === "string") {
        return [entry.name];
      }
      return [];
    });
  }
  return [];
}

/** Searchable text of one catalogue item. */
export function catalogItemSearchText(item: Record<string, unknown>): string {
  const fields = [
    item.title,
    item.description,
    item.category,
    item.subcategory,
    item.categories,
    item.tags,
  ];
  return normalizeSearchText(fields.flatMap(textValues).join(" "));
}

/** True when every word of the query (in any listed form) is in the text. */
export function textMatchesSearch(text: string, query: string): boolean {
  const words = searchWords(query);
  if (words.length === 0) return true;
  const haystack = normalizeSearchText(text);
  return words.every((word) => wordVariants(word).some((form) => haystack.includes(form)));
}

/** True when every word of the query (in any listed form) is in the item. */
export function catalogItemMatches(item: Record<string, unknown>, query: string): boolean {
  return textMatchesSearch(catalogItemSearchText(item), query);
}

/**
 * Merges the catalogue's own search results with items matched here from an
 * unfiltered page of the same catalogue. Upstream matches keep their order
 * and come first; ids are de-duplicated; the result is capped at `limit`.
 */
export function mergeCatalogMatches<T extends { id: string; [key: string]: unknown }>(
  query: string,
  upstreamMatches: T[][],
  unfiltered: T[],
  limit: number,
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  const add = (item: T) => {
    if (seen.has(item.id) || merged.length >= limit) return;
    seen.add(item.id);
    merged.push(item);
  };
  for (const list of upstreamMatches) list.forEach(add);
  unfiltered
    .filter((item) => catalogItemMatches(item, query))
    .forEach(add);
  return merged;
}
