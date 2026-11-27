/**
 * First name for the dashboard greeting, from the signed-in user's metadata.
 * Takes the first word of the first/display/full name and capitalizes its
 * first letter. Returns null when no name is set, so the caller can show a
 * greeting without a name. Never reads or changes stored data beyond this.
 */
export function greetingFirstName(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  for (const key of ["first_name", "given_name", "display_name", "full_name", "name"]) {
    const value = record[key];
    if (typeof value !== "string") continue;
    const first = value.trim().split(/\s+/)[0];
    if (first) return first.charAt(0).toLocaleUpperCase() + first.slice(1);
  }
  return null;
}
