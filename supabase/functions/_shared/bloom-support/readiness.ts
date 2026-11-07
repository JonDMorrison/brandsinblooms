// Bloom Support — honest readiness. Five separate facts per capability:
//   implemented  code exists in this deployment
//   configured   every required secret/setting is present (names listed when not)
//   tested       which automated test covers it (local/CI; not a live check)
//   enabled      the switch that lets it act is on
//   live         evidence it actually worked in this environment (last success time)
import { type Caller, env, rpc } from "./runtime.ts";
import { emailConfig } from "./email.ts";
import { aiConfig } from "./ai.ts";
import {
  hasTicketFlowChecksForPolicy,
  verificationChecksForPolicy,
} from "./engineering.ts";
import {
  intakeEvidenceNote,
  LIVE_EVIDENCE_DESCRIPTION,
} from "./readiness-evidence.ts";

interface Facts {
  settings: Record<string, unknown>;
  release_policy_set: boolean | null;
  cron: { worker: boolean; watchdog: boolean };
  vault: { worker_token: boolean; alert_resend_key: boolean };
  worker: { last_started_at: string | null; last_finished_at: string | null; runs_24h: number; processed_24h: number };
  queue: { queued: number; running: number; oldest_ready_queued_at: string | null; dead_24h: number; failed_retrying: number };
  last_seen: Record<string, string | null>;
  staff: Array<{ name: string | null; email: string | null; role: string }>;
  open_alerts: unknown[];
  knowledge: { approved_client: number; internal: number };
}

interface OperationalTruth {
  queued: number;
  running: number;
  oldest_ready_queued_at: string | null;
  dead_jobs_24h: number;
  failed_retrying: number;
  test_jobs: number;
  open_escalations: number;
  acknowledged_escalations: number;
  stale_effect_claims: number;
  reconciliation_needed: number;
  last_claim_reconciled_at: string | null;
  last_repair_report_at: string | null;
  last_ticket_flow_verified_at: string | null;
}

export interface Capability {
  key: string;
  label: string;
  implemented: boolean;
  configured: boolean;
  missing: string[];
  tested: string;
  enabled: boolean | null;
  live: string | null;
  note?: string;
}

const need = (...names: string[]) => names.filter((n) => !env(n));
const recent = (iso: string | null | undefined, days = 7) => (iso && Date.now() - Date.parse(iso) < days * 86400_000 ? iso : null);

export function rollbackReadiness(
  releasePolicy: unknown,
  hasVercelToken: boolean,
): { configured: boolean; missing: string[]; repositories: string[] } {
  const policy = releasePolicy && typeof releasePolicy === "object"
    ? releasePolicy as Record<string, unknown>
    : {};
  const approved = policy.approvedPaths && typeof policy.approvedPaths === "object"
    ? policy.approvedPaths as Record<string, unknown>
    : {};
  const vercel = policy.vercel && typeof policy.vercel === "object"
    ? policy.vercel as Record<string, unknown>
    : {};
  const repositories = Object.entries(approved)
    .filter(([, paths]) => Array.isArray(paths) && paths.length > 0)
    .map(([repository]) => repository);
  const missingTargets = repositories.filter((repository) => {
    const target = vercel[repository];
    return !target || typeof target !== "object" ||
      typeof (target as Record<string, unknown>).projectId !== "string" ||
      !(target as Record<string, string>).projectId.trim();
  });
  const missing = [
    ...(hasVercelToken ? [] : ["BLOOM_VERCEL_TOKEN"]),
    ...missingTargets.map((repository) =>
      `settings.release_policy.vercel.${repository}.projectId`
    ),
  ];
  return {
    configured: missing.length === 0,
    missing,
    repositories,
  };
}

export async function readiness(caller: Caller) {
  const [f, operational] = await Promise.all([
    rpc<Facts>("readiness_facts", { actor: caller.principalId }),
    rpc<OperationalTruth>("queue_summary", { actor: caller.principalId }),
  ]);
  const s = f.settings ?? {};
  const ai = await aiConfig();
  const mail = emailConfig();
  const owners = (s.owners ?? {}) as { jon?: string[]; jeff?: string[] };
  const automation = s.automation_enabled === true;
  const rollback = rollbackReadiness(
    s.release_policy,
    !!env("BLOOM_VERCEL_TOKEN"),
  );
  const releasePolicy = s.release_policy && typeof s.release_policy === "object"
    ? s.release_policy as Record<string, unknown>
    : {};
  const verificationOrigins = releasePolicy.verificationOrigins && typeof releasePolicy.verificationOrigins === "object"
    ? releasePolicy.verificationOrigins as Record<string, unknown>
    : {};
  const verificationMissing = rollback.repositories.flatMap((repository) => {
    const origins = verificationOrigins[repository];
    if (!Array.isArray(origins) || origins.length === 0) {
      return [`settings.release_policy.verificationOrigins.${repository}`];
    }
    return verificationChecksForPolicy(releasePolicy, repository) === null
      ? [`settings.release_policy.verificationChecks.${repository}`]
      : [];
  });
  const ticketFlowMissing = rollback.repositories.filter((repository) =>
    !hasTicketFlowChecksForPolicy(releasePolicy, repository)
  );
  const releaseMissing = [
    ...need("BLOOM_GITHUB_RELEASE_TOKEN"),
    ...(f.release_policy_set ? [] : ["settings.release_policy"]),
    ...rollback.missing,
    ...verificationMissing,
  ];
  const workerLive = recent(f.worker.last_finished_at, 1 / 96);
  const repairLive = recent(operational.last_repair_report_at, 90);
  const ticketFlowLive = recent(operational.last_ticket_flow_verified_at, 90);
  const intakeCrmConfigured = true;
  const intakeCmsConfigured = !!env("BLOOM_INTAKE_SECRET_CMS");
  const intakePosConfigured = !!env("BLOOM_INTAKE_SECRET_POS");
  const intakeCrmLive = recent(f.last_seen.intake_crm, 30);
  const intakeCmsLive = recent(f.last_seen.intake_cms, 30);
  const intakePosLive = recent(f.last_seen.intake_pos, 30);
  const chatgptLive = recent(f.last_seen.mcp_or_api_key_used, 30);
  const caps: Capability[] = [
    { key: "worker", label: "Background worker (no chat needed)", implemented: true, configured: f.cron.worker && f.vault.worker_token,
      missing: [...(f.cron.worker ? [] : ["cron job bloom-support-worker"]), ...(f.vault.worker_token ? [] : ["vault secret bloom_support_worker_token"])],
      tested: "e2e: worker steps, crash recovery, kill switch", enabled: automation, live: workerLive,
      note: workerLive ? undefined : "No finished run in the last 15 minutes" },
    { key: "watchdog", label: "Independent failure alerts (pg_cron, no Edge Function)", implemented: true, configured: f.cron.watchdog,
      missing: [...(f.cron.watchdog ? [] : ["cron job bloom-support-watchdog"]), ...(f.vault.alert_resend_key ? [] : ["vault secret bloom_support_alert_resend_key (email delivery of alerts)"]), ...((owners.jon?.length || owners.jeff?.length) ? [] : ["settings.owners emails"])],
      tested: "SQL: watchdog, fallback alerts", enabled: true, live: null, note: f.vault.alert_resend_key ? undefined : "Alerts are recorded and shown in-app only until the Resend key is in Vault" },
    { key: "queue", label: "Job queue health", implemented: true, configured: true, missing: [],
      tested: "e2e: crash recovery, retries, scoped pauses", enabled: automation,
      live: operational.oldest_ready_queued_at && Date.now() - Date.parse(operational.oldest_ready_queued_at) > 15 * 60_000 ? null : workerLive,
      note: `${operational.queued} production queued, ${operational.running} running, ${operational.failed_retrying} retrying, ${operational.dead_jobs_24h} dead in 24h; ${operational.test_jobs} explicit test/preview jobs excluded` +
        (operational.oldest_ready_queued_at ? `; oldest ready production job waiting since ${operational.oldest_ready_queued_at}` : "") },
    { key: "desk", label: "Support desk (works without AI)", implemented: true, configured: true, missing: [],
      tested: "SQL: transitions, timers, merge, notifications, metrics; e2e: views, client actions, CC, bounces",
      enabled: true, live: recent(f.last_seen.intake_crm ?? f.last_seen.intake_email, 30),
      note: `Targets: ${JSON.stringify((s.sla as Record<string, unknown> | undefined)?.first_response_business_hours ?? {})} business hours (${(s.sla as Record<string, unknown> | undefined)?.contractual ? "contractual" : "internal"}); paused scopes: ${Object.entries((s.automation_scopes ?? {}) as Record<string, boolean>).filter(([, v]) => v === false).map(([k]) => k).join(", ") || "none"}` },
    { key: "intake_crm", label: "CRM Get help / Support page", implemented: true, configured: intakeCrmConfigured, missing: [], tested: "e2e: CRM intake + duplicate delivery", enabled: true,
      live: intakeCrmLive, note: intakeEvidenceNote({ configured: intakeCrmConfigured, lastObservedAt: intakeCrmLive, sourceLabel: "CRM", missingConfigurationNote: "CRM support intake is not configured" }) },
    { key: "intake_cms", label: "BloomSites Get help", implemented: true, configured: intakeCmsConfigured, missing: need("BLOOM_INTAKE_SECRET_CMS"),
      tested: "e2e: signed CMS intake", enabled: true, live: intakeCmsLive, note: intakeEvidenceNote({ configured: intakeCmsConfigured, lastObservedAt: intakeCmsLive, sourceLabel: "BloomSites", missingConfigurationNote: "Bloom Support is missing BLOOM_INTAKE_SECRET_CMS; BloomSites must use BLOOM_SUPPORT_INTAKE_URL and the matching intake secret." }) },
    { key: "intake_pos", label: "POS back office + till (offline queue)", implemented: true, configured: intakePosConfigured, missing: need("BLOOM_INTAKE_SECRET_POS"),
      tested: "e2e: signed POS intake; vitest: till queue", enabled: true, live: intakePosLive, note: intakeEvidenceNote({ configured: intakePosConfigured, lastObservedAt: intakePosLive, sourceLabel: "POS", missingConfigurationNote: "Bloom Support is missing BLOOM_INTAKE_SECRET_POS; POS must use BLOOM_SUPPORT_INTAKE_URL and the matching intake secret." }) },
    { key: "intake_public", label: "Can't-sign-in contact form", implemented: true, configured: true, missing: [], tested: "e2e: public intake", enabled: true, live: recent(f.last_seen.intake_public, 30) },
    { key: "email_in", label: "Email intake (Resend inbound)", implemented: true, configured: !!env("RESEND_INBOUND_WEBHOOK_SECRET"), missing: need("RESEND_INBOUND_WEBHOOK_SECRET"),
      tested: "e2e: threading, duplicates, autoresponders, reopen", enabled: true, live: recent(f.last_seen.intake_email, 30), note: "Needs a Resend receiving address and the email.received webhook" },
    { key: "email_out", label: "Email to clients", implemented: true, configured: mail.configured, missing: mail.missing, tested: "e2e: acknowledgement, replies, resolution, takeover suppression",
      enabled: s.client_email_enabled === true, live: recent(f.last_seen.email_sent, 30),
      note: [
        `Sends from ${mail.sendingAddress ?? "an unconfigured sending inbox"}; public replies go to ${mail.publicAddress}`,
        mail.allowlist.length ? `delivery restricted to verification recipients: ${mail.allowlist.join(", ")}` : null,
      ].filter(Boolean).join("; ") },
    { key: "ai", label: `Model (${ai.provider === "none" ? "rules only" : `${ai.model} via OpenAI API`})`, implemented: true, configured: ai.provider !== "none", missing: ai.missing,
      tested: "unit: classification merge; e2e runs the rules fallback", enabled: ai.provider !== "none", live: recent(f.last_seen.model_call, 7),
      note: "Billed to the OpenAI API account, not a ChatGPT subscription. Budgets: settings.limits.ai_calls_per_day_total and ai.max_calls_per_account_per_day" },
    { key: "knowledge", label: "Approved product knowledge", implemented: true, configured: f.knowledge.approved_client > 0, missing: f.knowledge.approved_client > 0 ? [] : ["approved client-audience articles"],
      tested: "SQL: only approved client articles are used", enabled: true, live: null, note: `${f.knowledge.approved_client} approved client articles, ${f.knowledge.internal} internal` },
    { key: "ops_campaigns", label: "Campaign operations", implemented: true, configured: true, missing: [], tested: "SQL + e2e: preview/execute/undo, cross-tenant, stale preview refused",
      enabled: true, live: recent(f.last_seen.operation_succeeded, 30) },
    { key: "ops_cms", label: "BloomSites operations", implemented: true, configured: !!(env("BLOOM_OPS_URL_CMS") && env("BLOOM_OPS_SECRET_CMS")), missing: need("BLOOM_OPS_URL_CMS", "BLOOM_OPS_SECRET_CMS"),
      tested: "SQL: per-product operation evidence; e2e: signed CMS reads and writes", enabled: true, live: recent(f.last_seen.operation_cms, 30) },
    { key: "ops_pos", label: "POS read-only operations", implemented: true, configured: !!(env("BLOOM_OPS_URL_POS") && env("BLOOM_OPS_SECRET_POS")), missing: need("BLOOM_OPS_URL_POS", "BLOOM_OPS_SECRET_POS"),
      tested: "SQL regression + signed handler tests: tenant guards, stock precision, completed sales and returns", enabled: true, live: recent(f.last_seen.operation_pos, 30), note: "Products, store inventory and sales summaries; dates use the store time zone" },
    { key: "repair", label: "Automatic investigation + repair PRs", implemented: true, configured: !!env("BLOOM_GITHUB_REPAIR_TOKEN"), missing: need("BLOOM_GITHUB_REPAIR_TOKEN"),
      tested: "e2e with GitHub stubbed", enabled: automation, live: repairLive,
      note: `${repairLive ? `Last accepted repair report: ${repairLive}` : "No successful repair report evidence in the last 90 days"}. Each repo also needs BLOOM_REPAIR_OPENAI_API_KEY, BLOOM_REPAIR_REPORT_KEY and the BLOOM_SUPPORT_API_URL variable` },
    { key: "ticket_flow", label: "Affected-flow verification before automatic closure", implemented: true,
      configured: ticketFlowMissing.length === 0, missing: ticketFlowMissing.map((repository) => `settings.release_policy.ticketFlowChecks.${repository}`),
      tested: "unit: trusted route selection and ticket binding; e2e: unverified flow remains open", enabled: s.auto_release_enabled === true,
      live: ticketFlowLive,
      note: ticketFlowMissing.length
        ? `No trusted flow rule for ${ticketFlowMissing.join(", ")}; releases may pass smoke checks, but affected tickets stay open for a person`
        : (ticketFlowLive ? `Last verified affected flow: ${ticketFlowLive}` : "Configured, with no successful affected-flow evidence in the last 90 days") },
    { key: "release", label: "Automatic release of eligible fixes", implemented: true, configured: releaseMissing.length === 0,
      missing: releaseMissing, tested: "unit: policy; e2e: eligible, sensitive, failed deploy",
      enabled: s.auto_release_enabled === true, live: recent(f.last_seen.fix_verified, 90) },
    { key: "rollback", label: "Automatic rollback (Vercel)", implemented: true, configured: rollback.configured, missing: rollback.missing,
      tested: "e2e: failed production verification restores the recorded previous Vercel deployment", enabled: s.auto_release_enabled === true,
      live: recent(f.last_seen.rollback_succeeded, 90),
      note: rollback.repositories.length
        ? `Rollback targets cover ${rollback.repositories.length} auto-release ${rollback.repositories.length === 1 ? "repository" : "repositories"}`
        : "No repositories currently have auto-approved release paths" },
    { key: "chatgpt", label: "ChatGPT / MCP (per-person OAuth or key)", implemented: true, configured: true, missing: [], tested: "e2e: MCP tools with per-person keys; SQL: OAuth codes/tokens",
      enabled: true, live: chatgptLive, note: chatgptLive ? "Connected access has been used successfully in this environment within the last 30 days." : "Configured; no OAuth or personal-key use has been observed in this environment within the last 30 days." },
  ];
  return {
    generated_at: new Date().toISOString(),
    live_evidence: LIVE_EVIDENCE_DESCRIPTION,
    summary: {
      continuous_automation: automation && !!workerLive ? "running" : automation ? "enabled but worker not seen in 15 min" : "paused",
      staff: f.staff,
      owners_configured: !!(owners.jon?.length && owners.jeff?.length),
      worker: f.worker,
      open_alerts: f.open_alerts,
      escalations: {
        open: operational.open_escalations,
        acknowledged: operational.acknowledged_escalations,
      },
      operation_claims: {
        stale: operational.stale_effect_claims,
        reconciliation_needed: operational.reconciliation_needed,
        last_reconciled_at: operational.last_claim_reconciled_at,
      },
    },
    capabilities: caps,
  };
}
