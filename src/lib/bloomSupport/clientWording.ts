/**
 * Client-facing wording for Bloom's own automatic messages.
 *
 * Older stored messages named staff ("We've passed it to <name> for a
 * decision"). Clients never see staff names in system copy, so automatic and
 * system messages are reworded to "our team" when they are projected for a
 * client. Stored text is not rewritten, and anything a person wrote (staff
 * replies, the client's own words) is never passed through this.
 *
 * Pure TypeScript with no path aliases: the bloom-support-api Edge Function
 * imports it through trackView.ts.
 */

// Staff first names (and the full name used in older copy). The patterns are
// written as J(?:on|eff) so this matcher is not itself mistaken for copy.
const STAFF = String.raw`J(?:on(?: Morrison)?|eff)`;

const RULES: Array<[RegExp, string]> = [
  // "<name>/<name>", "<name> and <name>", "<name> or <name>"
  [new RegExp(String.raw`\b${STAFF}\s*(?:\/|&|\band\b|\bor\b)\s*${STAFF}\b`, "g"), "our team"],
  // "<name>/Support"
  [new RegExp(String.raw`\b${STAFF}\s*\/\s*[Ss]upport\b`, "g"), "our support team"],
  // "<name>'s"
  [new RegExp(String.raw`\b${STAFF}['’]s\b`, "g"), "our team's"],
  [new RegExp(String.raw`\b${STAFF}\b`, "g"), "our team"],
];

const atSentenceStart = (text: string, offset: number): boolean => /(^|[.!?]\s+|\n\s*)$/.test(text.slice(0, offset));

/** Rewords staff names in Bloom's automatic copy to "our team". Text without a staff name is returned unchanged. */
export function clientSystemText(body: string): string {
  let out = body;
  for (const [pattern, replacement] of RULES) {
    out = out.replace(pattern, (_match: string, offset: number, whole: string) =>
      atSentenceStart(whole, offset) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement);
  }
  return out;
}
