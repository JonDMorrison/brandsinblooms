/** Plain-English formatting for stored data shown to non-technical staff. */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** "scheduled_at" -> "Scheduled at", "pr_url" -> "PR url", "campaignId" -> "Campaign id". */
export function labelFor(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_.-]+/g, " ").trim().toLowerCase();
  const words = spaced.split(" ").map((w) => (["id", "url", "pr", "pos", "crm", "cms", "sms", "ip", "os"].includes(w) ? w.toUpperCase() : w));
  const out = words.join(" ");
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export function plainValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "string") {
    if (ISO_DATE.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    }
    return v;
  }
  if (Array.isArray(v)) return v.every((x) => typeof x !== "object" || x === null) ? v.map(plainValue).join(", ") || "—" : `${v.length} item${v.length === 1 ? "" : "s"}`;
  return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${labelFor(k)}: ${plainValue(x)}`).join(" · ");
}

/** One-line summary, e.g. for a risk object shown inside a sentence. */
export const plainSummary = (v: unknown) => (typeof v === "string" ? v : plainValue(v));

