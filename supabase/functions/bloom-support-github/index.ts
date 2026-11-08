// Verified GitHub events -> the existing Bloom Support notification queue.
// No PR title/body, email address or confidential commit detail is sent to Slack.
import { db, env } from "../_shared/bloom-support/runtime.ts";
import { verifyGithubWebhook } from "../_shared/bloom-support/webhook-auth.ts";
import { githubMilestoneFromKind } from "../_shared/bloom-support/slack-language.ts";
import { githubSourceLink } from "../_shared/bloom-support/slack.ts";
import { failedMainCheckSuite } from "../_shared/bloom-support/github-events.ts";
import { classifyPublicReleaseTitle } from "../_shared/bloom-support/release-notes.ts";

const ALLOWED = new Set([
  "JonDMorrison/brandsinblooms",
  "Brands-In-Blooms/cms-brandsinblooms",
  "Brands-In-Blooms/bloomtill",
]);
const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return respond({error:"POST only"},405);
  const secret = env("BLOOM_SUPPORT_GITHUB_WEBHOOK_SECRET");
  if (!secret) return respond({error:"not configured"},503);
  if (Number(req.headers.get("content-length") ?? 0) > 262144) return respond({error:"too large"},413);
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > 262144) return respond({error:"too large"},413);
  if (!(await verifyGithubWebhook(raw, req.headers.get("x-hub-signature-256"), secret)))
    return respond({error:"unauthenticated"},401);
  const delivery = req.headers.get("x-github-delivery") ?? "";
  if (!/^[0-9a-f-]{30,50}$/i.test(delivery)) return respond({error:"invalid"},400);
  const event = req.headers.get("x-github-event") ?? "";
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw Error("invalid");
  } catch { return respond({error:"invalid"},400); }
  const repoInfo = payload.repository as {full_name?:unknown} | undefined;
  const fullName = typeof repoInfo?.full_name === "string" ? repoInfo.full_name : "";
  if (!ALLOWED.has(fullName)) return respond({ok:true, ignored:"other repository"});

  let kind: string | null = null;
  let source: string | null = null;
  let eventId = delivery;
  let releaseCategory = "other";
  if (event === "pull_request" && payload.action === "closed") {
    const pr = payload.pull_request as {merged?:boolean;html_url?:string;title?:unknown} | undefined;
    if (pr) {
      kind = pr.merged === true ? "github.pr_merged" : "github.pr_closed";
      source = githubSourceLink(pr.html_url);
      // Only a fixed, public-safe category is passed downstream.
      // The raw PR title/body are never logged, queued or posted to Slack.
      if (pr.merged === true) releaseCategory = classifyPublicReleaseTitle(pr.title);
    }
  } else if (event === "check_suite" && payload.action === "completed") {
    // Pull-request checks remain in GitHub; Slack focuses on main-branch failures.
    const suite = failedMainCheckSuite(payload.check_suite);
    if (suite) {
      kind = "github.checks_failed";
      source = githubSourceLink(`https://github.com/${fullName}/commit/${suite.sha}/checks`);
      // One message per failing suite + commit, even if GitHub redelivers it.
      eventId = `check_suite_${suite.id}_${suite.sha}`;
    }
  } else if (event === "deployment_status") {
    const d = payload.deployment as {ref?:string;environment?:string;id?:number} | undefined;
    const status = payload.deployment_status as {state?:string} | undefined;
    if (d?.ref === "main" && d?.environment?.toLowerCase() === "production") {
      kind = status?.state === "success" ? "github.deployment_succeeded" :
        status?.state === "failure" || status?.state === "error" ? "github.deployment_failed" : null;
      if (kind && Number.isSafeInteger(d.id))
        source = githubSourceLink("https://github.com/" + fullName + "/deployments/" + d.id);
    }
  }
  if (!kind || !githubMilestoneFromKind(kind)) return respond({ok:true,ignored:true});
  // Source URL is optional; the public-facing release description is a
  // reviewed fixed category, never the untrusted title or PR description.
  const {data,error} = await db().rpc("bloom_support_enqueue_slack_github",{
    p_event_id:eventId, p_kind:kind, p_url:source,
    p_category:releaseCategory,
  });
  if (error) {
    console.error("GitHub notification queue failed",error.code);
    return respond({error:"queue unavailable"},503);
  }
  return respond({ok:true,queued:data?.queued === true});
});