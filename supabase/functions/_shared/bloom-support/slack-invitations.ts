/**
 * Read-only Slack handoff for Major Project invitations.
 * The signed, staff-allowlisted Slack mention finds ONE project. The user then
 * signs into BloomSites to authorize the send. Slack never grants access.
 */
export type InvitationProject = {
  id?: unknown;
  project_code?: unknown;
  project_name?: unknown;
  stage?: unknown;
  invite_owner_configured?: unknown;
  invite_site_linked?: unknown;
  invite_sent?: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE = /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?:\/\/|sk_(?:live|test)_|xox[baprs]-|gh[pousr]_)/i;
const normalize = (value: string): string => value.toLowerCase()
  .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const safeLabel = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > 100 || SENSITIVE.test(raw)) return "this Major Project";
  return raw.replace(/[<>&@*_\x60~\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
};

export function isMajorProjectInviteRequest(question: unknown): boolean {
  if (typeof question !== "string" || question.length > 1000) return false;
  const first = question.trim();
  if (!/^(?:(?:hey|hi)\s+bloom[,:\s]+)?(?:(?:please|could you|can you)\s+)?(?:send|invite|prepare|trigger|start)\b/i.test(first)) return false;
  return /\b(?:invite|invitation|welcome\s+email|onboarding\s+email|welcome\s+message)\b/i.test(first);
}

/** Require a clearly named client, never infer a project from broad instructions. */
export function requestedInvitationProject(question: string): string | null {
  if (!isMajorProjectInviteRequest(question)) return null;
  const raw = question.trim().replace(/[.!?\s]+$/g, "");
  const patterns = [
    /\b(?:for|to)\s+(.+)$/i,
    /^(?:(?:please|could you|can you)\s+)?invite\s+(.+)$/i,
    /^(?:send|prepare|trigger)\s+(.+?)\s+(?:an?\s+)?(?:welcome\s+)?(?:invitation|invite|onboarding\s+email)$/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(raw);
    if (!match) continue;
    const name = match[1].replace(/^(?:the\s+)?(?:new\s+)?(?:major\s+)?project\s+/i, "")
      .replace(/\b(?:right now|now|please)$/i, "").trim();
    const normalized = normalize(name);
    if (name.length < 4 || name.length > 90 || SENSITIVE.test(name) ||
        /^(?:all|any|new|every|major projects?|client|clients|customers?|everyone)$/i.test(normalized)) return null;
    return normalized;
  }
  return null;
}

function projectMatches(hint: string, project: InvitationProject): boolean {
  const name = normalize(String(project.project_name ?? ""));
  const code = normalize(String(project.project_code ?? ""));
  if (hint === name || hint === code) return true;
  // Two distinctive words permit "Triple Tree" for "Triple Tree Nurseryland".
  // Single-word matches need >=7 letters, avoiding guesses from "Garden".
  if (hint.split(" ").length >= 2 && name.includes(hint)) return true;
  if (hint.length >= 7 && !hint.includes(" ") &&
      (name.split(" ").includes(hint) || code.split(" ").includes(hint))) return true;
  return false;
}

export function projectInvitationHandoff(question: string, rows: unknown): string {
  const hub = "https://bloomsites.app/dashboard/admin/major-projects";
  const hint = requestedInvitationProject(question);
  if (!hint) return "Which Major Project should I invite? Name one garden centre, for example: @Bloom send the welcome invitation for Triple Tree. No invitation has been sent.";
  const source = Array.isArray(rows) ? rows.slice(0, 100) as InvitationProject[] : [];
  const matches = source.filter(p => UUID.test(String(p.id ?? "")) && projectMatches(hint, p));
  if (matches.length !== 1) {
    return matches.length > 1
      ? "I found more than one Major Project matching that name. Please use its exact project name or code. <" + hub + "|Open Major Projects>. No invitation has been sent."
      : "I couldn't verify a single Major Project matching that name. <" + hub + "|Open Major Projects> to check its record. No invitation has been sent.";
  }
  const selected = matches[0];
  const name = safeLabel(selected.project_name);
  const link = hub + "?project=" + selected.id + "&onboarding=invite";
  const owner = selected.invite_owner_configured === true ? "Saved for review" : "Needs the client's own login email";
  const site = selected.invite_site_linked === true ? "Linked" : "Needs the correct BloomSites site";
  const previouslySent = selected.invite_sent === true ? "\nA previous invitation is recorded. Check before sending again." : "";
  return [
    "*Welcome invitation: " + name + "*",
    "Owner: " + owner + " · Website: " + site,
    "",
    "<" + link + "|Review & send invitation>",
    "This opens the secure Major Project screen. Confirm the client and site, then use Send secure invitation. Only an authorized account creator can send it.",
    "_Nothing has been emailed or changed in Slack._" + previouslySent,
  ].join("\n");
}
