// Bloom Support Slack notifications. Internal, non-PII summaries only.
// Slack is an optional delivery channel; tickets and permission checks stay in Bloom Support.
import { BloomError, env } from "./runtime.ts";
import { explainSupportEvent, explainGithubMilestone, githubMilestoneFromKind } from "./slack-language.ts";
import { isPublicReleaseCategory, publicReleaseNote } from "./release-notes.ts";

export type SlackRoute = "tickets" | "features" | "alerts" | "releases" | "projects" | "clients" | "finance";

/** Only known staff events are allowed into Slack; unrelated notifications stay in-app. */
export function slackRoute(kind: string): SlackRoute | null {
  if (/^(alert\.|escalation(?:\.|$)|job\.dead$|incident\.)/.test(kind)) return "alerts";
  if (/^feature\./.test(kind)) return "features";
  if (kind === "github.deployment_failed") return "alerts";
  if (githubMilestoneFromKind(kind)) return "releases";
  if (kind === "major_project.accepted" || kind === "major_project.onboarding") return "clients";
  if (kind === "major_project.stage_changed" || kind === "major_project.created" || kind === "major_project.review_ready") return "projects";
  if (kind === "finance.daily_payouts" || kind === "finance.payout_failed") return "finance";
  if (/^(ticket\.|engineering\.)/.test(kind)) return "tickets";
  return null;
}
export function slackChannelId(value: string | undefined): string | null {
  return value && /^C[A-Z0-9]{7,30}$/.test(value) ? value : null;
}
/** Only allow source links to three company GitHub repositories, never arbitrary links. */
export function githubSourceLink(value: string | undefined): string | null {
  if (!value || value.length > 250) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.username || url.password || url.search || url.hash) return null;
    const match = /^\/(JonDMorrison\/brandsinblooms|Brands-In-Blooms\/(?:cms-brandsinblooms|bloomtill))\/(?:pull\/[0-9]+|actions\/runs\/[0-9]+|deployments\/[0-9]+|commit\/[a-fA-F0-9]{40}\/checks)$/.exec(url.pathname);
    return match ? url.toString() : null;
  } catch { return null; }
}
/** Do not place ticket subjects, bodies, requester identities, or source details in Slack. */
export function slackSafeMessage(
  kind: string, ticketId: string | null, githubUrl?: string,
  projectId?: string, releaseCategory?: string,
): string {
  const route = slackRoute(kind);
  if (!route) throw new Error("unsupported event");
  const milestone = githubMilestoneFromKind(kind);
  const source = milestone ? githubSourceLink(githubUrl) : null;
  if (milestone === "pr_merged") {
    // Defense in depth for queued jobs created before the intake gate.
    // A missing useful category or validated PR link must never produce
    // a public filler announcement or an empty Slack post.
    if (!source || !isPublicReleaseCategory(releaseCategory) || releaseCategory === "other") return "";
    const note = publicReleaseNote(releaseCategory);
    // Title and body are untrusted, so only vetted category copy is public.
    // A merge does not establish production deployment or customer acceptance.
    return [
      "*" + note.area + "*",
      note.changed,
      "*Status:* Code merged. Live customer use has not been verified by this update.",
      "<" + source + "|See the change>",
    ].join("\n");
  }
  if (kind === "major_project.review_ready") {
    // Link only to authenticated CMS pages. Never embed draft tokens, customer
    // emails, source websites, raw QA findings, or unapproved preview URLs.
    if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) return "";
    const id=encodeURIComponent(projectId);
    return [
      "*Website draft ready for your review*",
      "Bloom has prepared a private draft and recorded its quality checks. Nothing has been sent to the client or published.",
      "*Project reviewers:* Review pages, photography, mobile layout and important links. Approve the exact draft in Major Projects when ready.",
      `<https://bloomsites.app/dashboard/admin/major-projects/review?projectId=${id}|Review draft and QA>`,
      `<https://bloomsites.app/dashboard/admin/major-projects?project=${id}|Open project and approve client preview>`,
    ].join("\n");
  }
  const state = milestone ? explainGithubMilestone(milestone) :
    kind === "major_project.accepted" ? {
      headline: "A new customer has accepted",
      whatItMeans: "A Major Project moved into the accepted stage; it is ready for a careful onboarding handoff.",
      nextStep: "Confirm the owner and the first onboarding task in Major Projects.",
    } : kind === "major_project.onboarding" ? {
      headline: "Customer onboarding has started",
      whatItMeans: "The existing Major Project is now being prepared for delivery.",
      nextStep: "Check the project checklist and next action.",
    } : kind.startsWith("major_project.") ? {
      headline: "A major project has progressed",
      whatItMeans: "The official BloomSites project record was updated.",
      nextStep: "Review the stage, owner and next action in Major Projects.",
    } : kind.startsWith("finance.") ? {
      headline: "Stripe payout update",
      whatItMeans: "The finance reporting system recorded a payout update.",
      nextStep: "Review the official amounts and payout status in Stripe.",
    } : explainSupportEvent(kind);
  if (milestone) {
    // Ordinary release milestones can be understood without opening GitHub.
    // Show a source link only when a problem actually needs the team's help.
    const lines = [
      "*" + state.headline + "*",
      state.whatItMeans,
      "*What happens next:* " + state.nextStep,
    ];
    if ((milestone === "checks_failed" || milestone === "deployment_failed") && source)
      lines.push("<" + source + "|Details for the team>");
    return lines.join("\n");
  }
  const base = "https://bloomsuite.app/support";
  const link = ticketId && /^[0-9a-f-]{36}$/i.test(ticketId) ? `${base}?ticket=${ticketId}` : base;
  const actionLink = route === "projects" || route === "clients"
    ? `<https://bloomsites.app/dashboard/admin/major-projects${projectId && /^[0-9a-f-]{36}$/i.test(projectId) ? `?project=${projectId}` : ""}|Open Major Projects>`
    : route === "finance"
      ? "<https://dashboard.stripe.com/payouts|Open Stripe payouts>"
      : `<${link}|Open in Bloom Support>`;
  return `*${state.headline}*\n${state.whatItMeans}\n*Next:* ${state.nextStep}\n${actionLink}${source ? ` · <${source}|See GitHub details>` : ""}`;
}
/** Trusted worker: returns the real Slack message timestamp for thread binding. */
export async function postSlackInternalMessage(
  route: SlackRoute | "ask", text: string, jobId: string, threadTs?: string,
): Promise<{delivery: string; ts: string}> {
  if (!/^[-\w.]{16,128}$/.test(jobId)) throw new Error("invalid job ID");
  const token = env("BLOOM_SUPPORT_SLACK_BOT_TOKEN");
  const channel = slackChannelId(env("BLOOM_SUPPORT_SLACK_CHANNEL_" + route.toUpperCase()));
  if (!token || !channel) throw new BloomError(503, "not_configured", "Slack bot or channel not configured");
  const payload: Record<string, unknown> = {
    channel, text: text.slice(0, 2400), client_msg_id: jobId, unfurl_links: false, unfurl_media: false,
  };
  if (threadTs && /^\d{10}\.\d{6}$/.test(threadTs)) payload.thread_ts = threadTs;
  let response: Response;
  try {
    response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new BloomError(502, "slack_network", "Slack notification network error");
  }
  if (response.status === 429) throw new BloomError(429, "slack_rate_limit", "Slack rate limit");
  if (!response.ok) throw new BloomError(502, "slack_http", "Slack API HTTP " + response.status);
  const result = await response.json().catch(() => null) as {ok?:boolean;error?:string;ts?:string}|null;
  if (!result?.ok) throw new BloomError(502, "slack_delivery", "Slack rejected notification: " + (result?.error ?? "unknown"));
  if (typeof result.ts !== "string" || !/^\d{10}\.\d{6}$/.test(result.ts)) {
    throw new BloomError(502, "slack_receipt", "Slack did not return a valid message timestamp");
  }
  return {delivery:"delivered to " + route + " (Slack ts: " + result.ts + ")", ts:result.ts};
}
export async function postSlackInternalText(
  route: SlackRoute | "ask", text: string, jobId: string, threadTs?: string,
): Promise<string> {
  return (await postSlackInternalMessage(route,text,jobId,threadTs)).delivery;
}
export async function postSlackSupportNotification(input: {
  kind: string; ticketId: string | null; jobId: string; githubUrl?: string; projectId?: string; releaseCategory?: string;
}): Promise<string> {
  const route = slackRoute(input.kind);
  if (!route) return "skipped: unsupported Slack event";
  const message = slackSafeMessage(input.kind,input.ticketId,input.githubUrl,input.projectId,input.releaseCategory);
  if (!message) return "skipped: no useful reviewed release summary";
  return await postSlackInternalText(route, message, input.jobId);
}
