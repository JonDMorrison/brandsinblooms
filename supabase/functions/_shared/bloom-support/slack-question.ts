/** Remove transport attribution before searching approved help, not after retrieval. */
export function slackQuestionText(text: unknown): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/\s+\*Sent using\*\s+<@[UW][A-Z0-9]+(?:\|[^>]+)?>\s*$/, "")
    .replace(/<@[UW][A-Z0-9]+(?:\|[^>]+)?>/g, "")
    .trim()
    .slice(0, 1000);
}
