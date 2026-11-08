export type SlackQuestionRoute = "ask" | "features" | "projects";

const QUESTION_CHANNELS: Record<string, SlackQuestionRoute> = {
  C0CFUG4LFLJ: "ask",
  C0CFWJDUQU9: "features",
  C0CFUHJ5ESW: "projects",
};

export function slackQuestionRoute(channel: unknown): SlackQuestionRoute | null {
  return typeof channel === "string" ? QUESTION_CHANNELS[channel] ?? null : null;
}

const clean = (value: unknown, max = 180) => String(value ?? "")
  .replace(/[<>&@\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const label = (value: unknown) => clean(value, 80).replace(/_/g, " ");

export function projectQuestionAnswer(rows: unknown): string {
  const projects = Array.isArray(rows) ? rows.slice(0, 10) as Array<Record<string, unknown>> : [];
  if (!projects.length) return "There are no active Major Projects in BloomSites right now. <https://bloomsites.app/dashboard/admin/major-projects|Open Major Projects>";
  const lines = projects.map((p) => {
    const id = typeof p.id === "string" && /^[0-9a-f-]{36}$/i.test(p.id) ? p.id : "";
    const name = clean(p.project_name) || "Untitled project";
    const stage = label(p.stage) || "stage not recorded";
    const next = clean(p.next_action, 240);
    const owner = clean(p.next_action_owner, 100);
    const detail = [next && `Next: ${next}`, owner && `Owner: ${owner}`].filter(Boolean).join(" · ");
    const link = id ? `https://bloomsites.app/dashboard/admin/major-projects?project=${id}` : "https://bloomsites.app/dashboard/admin/major-projects";
    return `• <${link}|${name}> — ${stage}${detail ? `\n  ${detail}` : ""}`;
  });
  return `*Active Major Projects (${projects.length})*\n${lines.join("\n")}`;
}

export function featureQuestionAnswer(rows: unknown): string {
  const features = Array.isArray(rows) ? rows.slice(0, 10) as Array<Record<string, unknown>> : [];
  if (!features.length) return "There are no current feature requests recorded in Bloom Support. <https://bloomsuite.app/support|Open Bloom Support>";
  const lines = features.map((f) => {
    const title = clean(f.title) || "Untitled feature request";
    const status = label(f.status) || "status not recorded";
    const product = label(f.product);
    return `• ${title} — ${status}${product ? ` (${product})` : ""}`;
  });
  return `*Latest feature requests (${features.length})*\n${lines.join("\n")}\nThese are recorded product decisions, not confirmation that a feature is released. <https://bloomsuite.app/support|Open Bloom Support>`;
}
