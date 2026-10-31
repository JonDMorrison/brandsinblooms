// Bloom Support — deterministic rules. No I/O, no Deno globals: unit-tested
// with `deno test` and safe to import anywhere.
//
// The model may *recommend* (classification, draft answers, fix plans). These
// rules decide what is *allowed*: sanitization, routing, release eligibility.

export type Product = "cms" | "crm" | "pos" | "platform" | "unknown";
export type Kind = "unknown" | "bug" | "question" | "request" | "feature" | "operation" | "account";
export type Priority = "low" | "normal" | "high" | "urgent";

// ---------------------------------------------------------------------------
// Sanitizing captured context
// ---------------------------------------------------------------------------
const SECRET_KEY = /pass(word)?|secret|token|api[-_]?key|authorization|cookie|session|card|cvv|cvc|pan|iban|account[-_]?number|routing|ssn|sin\b|pin\b|otp|private[-_]?key|bearer|refresh/i;
const ALLOWED_CONTEXT_KEYS = new Set([
  "page_url", "route", "record_refs", "app_version", "deployment_id", "release", "user_agent", "browser", "os", "device",
  "viewport", "locale", "timezone", "error_ids", "trace_ids", "error_message", "online", "queued_at", "saved_locally_at",
  "register_id", "store_id", "screen", "site_id", "site_domain", "tenant_id", "product_area", "steps", "expected", "actual",
]);

/** Masks card numbers, bearer tokens, JWTs, API keys and emails embedded in free text. */
export function redactText(input: string): string {
  return input
    // Payment card numbers (13–19 digits, optional separators) that pass Luhn.
    .replace(/\b(?:\d[ -]?){13,19}\b/g, (m) => (luhn(m.replace(/\D/g, "")) ? "[redacted card]" : m))
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g, "[redacted token]")
    .replace(/\b(?:sk|pk|rk|sb_secret|sb_publishable|ghp|gho|ghs|github_pat|xox[abp]|re|bsk)_[A-Za-z0-9_-]{8,}\b/g, "[redacted key]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [redacted]")
    .replace(/([?&](?:token|key|code|secret|signature|sig|password|access_token|refresh_token)=)[^&\s#]+/gi, "$1[redacted]");
}

function luhn(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/** Keeps only allow-listed, bounded context fields and strips secrets. */
export function sanitizeContext(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED_CONTEXT_KEYS.has(key) || SECRET_KEY.test(key)) continue;
    const clean = sanitizeValue(value, 0);
    if (clean !== undefined) out[key] = clean;
  }
  if (typeof out.page_url === "string") out.page_url = stripUrlSecrets(out.page_url);
  return out;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return redactText(value).slice(0, 2000);
  if (depth >= 2) return undefined;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitizeValue(v, depth + 1)).filter((v) => v !== undefined);
  if (typeof value === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 30)) {
      if (SECRET_KEY.test(k)) continue;
      const c = sanitizeValue(v, depth + 1);
      if (c !== undefined) o[k.slice(0, 60)] = c;
    }
    return o;
  }
  return undefined;
}

export function stripUrlSecrets(url: string): string {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) {
      if (SECRET_KEY.test(k) || /^(code|state|sig|signature|key)$/i.test(k)) u.searchParams.set(k, "[redacted]");
    }
    u.username = "";
    u.password = "";
    u.hash = "";
    return u.toString().slice(0, 1000);
  } catch {
    return redactText(url).slice(0, 1000);
  }
}

// ---------------------------------------------------------------------------
// Deterministic classification (the fallback when no model is configured,
// and the floor that model output is checked against)
// ---------------------------------------------------------------------------
export interface Classification {
  kind: Kind;
  priority: Priority;
  impact: "unknown" | "single_user" | "account" | "multi_account" | "platform";
  category: string;
  missing: string[];
  confidence: number;
  source: "rules" | "model";
}

const BUG = /\b(bug|broken|error|crash|fail(s|ed|ing)?|not working|doesn'?t work|won'?t|can'?t|cannot|stuck|blank|500|404|wrong|missing|disappeared|frozen|spinning|offline)\b/i;
const FEATURE = /\b(feature request|would be (nice|great)|could you add|can you add|wish|suggest(ion)?|it would help if|please add|roadmap|ability to)\b/i;
const QUESTION = /(\?\s*$|\b(how (do|can|to)|where (is|do|can)|what (is|does)|is it possible|can i)\b)/im;
const REQUEST = /\b(please (update|change|create|publish|send|schedule|set up|add|remove)|can you (update|change|create|publish|send|schedule|set up)|need (you )?to (update|change|publish))\b/i;
const URGENT = /\b(urgent|asap|emergency|down for everyone|site is down|can'?t take payments?|cannot (take|process) (payments?|sales)|checkout (is )?(broken|down)|lost (orders|sales))\b/i;
const HIGH = /\b(today|before (the )?(weekend|event|sale)|customers? (can'?t|cannot)|all (our )?(customers|staff))\b/i;
const ACCOUNT = /\b(password|log ?in|sign ?in|locked out|invite|access|2fa|mfa|billing|invoice|subscription|cancel my)\b/i;

const CATEGORIES: Array<[RegExp, string]> = [
  [/\b(checkout|cart|payment|stripe|refund|tax|payout|card reader|terminal)\b/i, "payments"],
  [/\b(campaign|newsletter|email blast|audience|segment|unsubscribe|sms)\b/i, "campaigns"],
  [/\b(page|website|site|publish|domain|menu|navbar|seo|blog)\b/i, "website"],
  [/\b(event|ticket(s)? for|workshop|booking|class)\b/i, "events"],
  [/\b(fundrais|donation|school order)\b/i, "fundraising"],
  [/\b(printer|receipt|register|till|barcode|scanner|drawer)\b/i, "pos-hardware"],
  [/\b(inventory|stock|product|price|catalogue|catalog|sku)\b/i, "catalogue"],
  [/\b(sync|import|lightspeed|shopify|clover|square|integration)\b/i, "integrations"],
  [/\b(log ?in|password|access|invite|permission)\b/i, "access"],
];

export function classify(subject: string, body: string, product: Product): Classification {
  const text = `${subject}\n${body}`;
  let kind: Kind = "unknown";
  if (FEATURE.test(text)) kind = "feature";
  else if (BUG.test(text)) kind = "bug";
  else if (REQUEST.test(text)) kind = "request";
  else if (ACCOUNT.test(text)) kind = "account";
  else if (QUESTION.test(text)) kind = "question";

  const priority: Priority = URGENT.test(text) ? "urgent" : HIGH.test(text) ? "high" : "normal";
  const category = CATEGORIES.find(([re]) => re.test(text))?.[1] ?? "general";
  const missing: string[] = [];
  if (kind === "bug") {
    if (body.length < 60) missing.push("what happened, step by step");
    if (!/\b(expected|should|supposed to)\b/i.test(body)) missing.push("what you expected to happen");
    if (product === "unknown") missing.push("which product (website, CRM or POS)");
  }
  if (kind === "request" && product === "unknown") missing.push("which product (website, CRM or POS)");
  return {
    kind,
    priority,
    impact: /\b(all (our )?customers|everyone|every (site|store))\b/i.test(text) ? "multi_account" : "unknown",
    category,
    missing,
    confidence: kind === "unknown" ? 0.2 : 0.6,
    source: "rules",
  };
}

/** Accepts a model classification only if every field is in-vocabulary; otherwise keeps the rules result. */
export function mergeModelClassification(rules: Classification, model: unknown): Classification {
  if (!model || typeof model !== "object") return rules;
  const m = model as Record<string, unknown>;
  const kinds = ["unknown", "bug", "question", "request", "feature", "operation", "account"];
  const priorities = ["low", "normal", "high", "urgent"];
  const impacts = ["unknown", "single_user", "account", "multi_account", "platform"];
  if (!kinds.includes(String(m.kind)) || !priorities.includes(String(m.priority))) return rules;
  // Urgency floor: the model may raise priority but never lower an explicit outage signal.
  const order = { low: 0, normal: 1, high: 2, urgent: 3 } as const;
  const priority = order[m.priority as Priority] >= order[rules.priority] ? (m.priority as Priority) : rules.priority;
  return {
    kind: m.kind as Kind,
    priority,
    impact: impacts.includes(String(m.impact)) ? (m.impact as Classification["impact"]) : rules.impact,
    category: typeof m.category === "string" && /^[a-z-]{2,30}$/.test(m.category) ? m.category : rules.category,
    missing: Array.isArray(m.missing) ? m.missing.filter((x): x is string => typeof x === "string").slice(0, 5).map((s) => s.slice(0, 200)) : rules.missing,
    confidence: typeof m.confidence === "number" ? Math.max(0, Math.min(1, m.confidence)) : 0.5,
    source: "model",
  };
}

// ---------------------------------------------------------------------------
// Email helpers
// ---------------------------------------------------------------------------
export interface InboundHeaders {
  [name: string]: string | undefined;
}

/** True for autoresponders, bounces, mailing lists and our own outbound mail. */
export function isAutomatedEmail(from: string, subject: string, headers: InboundHeaders, ownDomains: string[]): string | null {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), (v ?? "").toLowerCase()]));
  const sender = from.toLowerCase();
  if (h["auto-submitted"] && h["auto-submitted"] !== "no") return "auto-submitted";
  if (h["x-autoreply"] || h["x-autorespond"] || h["x-auto-response-suppress"]?.includes("all")) return "autoreply-header";
  if (h["precedence"] && /bulk|junk|list|auto_reply/.test(h["precedence"])) return "precedence";
  if (h["list-id"] || h["list-unsubscribe"]) return "mailing-list";
  if (/^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounce)/.test(sender)) return "system-sender";
  if (/^(auto(matic)? ?reply|out of (the )?office|undeliverable|delivery status notification|mail delivery failed|returned mail)/i.test(subject.trim())) return "autoreply-subject";
  const domain = sender.split("@")[1] ?? "";
  if (ownDomains.some((d) => domain === d.toLowerCase())) return "own-domain";
  if (h["x-bloom-support"]) return "own-message";
  return null;
}

/** Removes quoted history and common signatures so a reply contains only new text. */
export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .{5,200} wrote:\s*$/.test(line) || /^-{2,}\s*Original Message\s*-{2,}/i.test(line) || /^From: .+/.test(line) && out.length > 0) break;
    if (/^_{5,}\s*$/.test(line)) break;
    if (line.startsWith(">")) continue;
    if (/^--\s*$/.test(line)) break;
    out.push(line);
  }
  return out.join("\n").trim();
}

/** "[Bloom #1234]" in a subject identifies the ticket for clients whose mail client drops headers. */
export function ticketNumberFromSubject(subject: string): number | null {
  const m = subject.match(/\[Bloom #(\d{1,12})\]/i);
  return m ? Number(m[1]) : null;
}

export function parseReferences(headers: InboundHeaders): string[] {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v ?? ""]));
  const ids = `${h["in-reply-to"] ?? ""} ${h["references"] ?? ""}`.match(/<[^<>\s]+>/g) ?? [];
  return [...new Set(ids)].slice(0, 50);
}

export function parseAddress(value: string): { email: string; name: string | null } {
  const m = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { email: m[2].trim().toLowerCase(), name: m[1].trim() || null };
  return { email: value.trim().toLowerCase(), name: null };
}

/** Detects "it's still broken" style replies that should reopen a resolved ticket. */
export function indicatesStillBroken(text: string): boolean {
  return /\b(still (broken|not working|happening|an issue|the same)|not (fixed|resolved)|didn'?t (fix|work)|same (problem|issue)|happening again|it'?s back)\b/i.test(text);
}

// ---------------------------------------------------------------------------
// Release policy
// ---------------------------------------------------------------------------
export interface ReleasePolicy {
  /** Globs of paths an automatic release may touch, per repository. */
  approvedPaths: Record<string, string[]>;
  /** Globs that always require human review. */
  sensitivePaths: string[];
  maxChangedFiles: number;
  maxChangedLines: number;
  requiredChecks: Record<string, string[]>;
  autoReleaseEnabled: boolean;
}

export const DEFAULT_SENSITIVE_PATHS = [
  "**/migrations/**", "supabase/migrations/**", "**/*.sql",
  "**/auth/**", "**/*auth*", "**/*permission*", "**/*rbac*", "**/*role*", "**/middleware.ts", "**/rls*",
  "**/*payment*", "**/*stripe*", "**/*checkout*", "**/*tax*", "**/*payout*", "**/*refund*", "**/*billing*", "**/*price*", "**/*invoice*",
  ".github/**", "**/.env*", "**/vercel.json", "**/Dockerfile*", "**/docker-compose*", "supabase/config.toml", "**/deno.json",
  "**/package.json", "**/pnpm-lock.yaml", "**/package-lock.json", "**/bun.lock*",
  "**/*release-policy*", "**/bloom-support/policy.ts", "**/CODEOWNERS", "**/*.test.*", "**/__tests__/**", "**/tests/**", "**/e2e/**",
  "**/vitest.config.*", "**/jest.config.*", "**/playwright.config.*", "**/eslint.config.*", "**/tsconfig*.json",
];

export interface PullRequestFacts {
  repository: string;
  files: Array<{ path: string; additions: number; deletions: number; status: string }>;
  checks: Array<{ name: string; conclusion: string | null; status: string }>;
  reviews: Array<{ state: string; author: string; independent: boolean }>;
  unresolvedThreads: number;
  mergeable: boolean | null;
  baseBranch: string;
  /** Tests added by the fix (new or modified test files) — allowed only as additions. */
  testFilesAdded: string[];
  testFilesModifiedOrDeleted: string[];
}

export interface IssueFacts {
  kind: Kind;
  reproduced: boolean;
  intendedBehaviourEstablished: boolean;
  productsTouched: number;
  labels: string[];
  hasProductionVerification: boolean;
  hasRollback: boolean;
}

export interface Eligibility {
  eligible: boolean;
  reasons: string[];
  sensitive: string[];
  evaluatedAt: string;
}

export function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
        i += glob[i + 2] === "/" ? 2 : 1;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "i");
}

export function matchesAny(path: string, globs: string[]): boolean {
  return globs.some((g) => globToRegExp(g).test(path));
}

/**
 * Release eligibility. Deterministic; the coding worker never evaluates it and
 * cannot change it (the policy file itself is a sensitive path).
 */
export function evaluateRelease(policy: ReleasePolicy, issue: IssueFacts, pr: PullRequestFacts, now = new Date()): Eligibility {
  const reasons: string[] = [];
  const sensitive: string[] = [];
  if (!policy.autoReleaseEnabled) reasons.push("automatic release is switched off");
  if (issue.kind !== "bug") reasons.push("only bugs are eligible; features and behaviour changes need review");
  if (!issue.reproduced) reasons.push("bug was not reproduced");
  if (!issue.intendedBehaviourEstablished) reasons.push("intended behaviour is not established");
  if (issue.productsTouched > 1) reasons.push("change spans more than one product");
  if (issue.labels.some((l) => /security|payment|tax|payout|migration|auth|data-repair|infra/i.test(l))) reasons.push("issue carries a sensitive label");
  if (!issue.hasProductionVerification) reasons.push("no production verification is defined");
  if (!issue.hasRollback) reasons.push("no supported rollback");
  if (pr.baseBranch === "main" && !policy.approvedPaths[pr.repository]) reasons.push("repository has no approved automatic-release areas");

  const approved = policy.approvedPaths[pr.repository] ?? [];
  let lines = 0;
  for (const f of pr.files) {
    lines += f.additions + f.deletions;
    const isNewTest = pr.testFilesAdded.includes(f.path) && f.status === "added";
    if (matchesAny(f.path, policy.sensitivePaths) && !isNewTest) sensitive.push(f.path);
    else if (!isNewTest && !matchesAny(f.path, approved)) reasons.push(`outside approved areas: ${f.path}`);
  }
  if (sensitive.length) reasons.push(`touches review-required paths: ${sensitive.slice(0, 5).join(", ")}`);
  if (pr.testFilesModifiedOrDeleted.length) reasons.push("modifies or deletes existing tests");
  if (pr.files.length === 0) reasons.push("empty change");
  if (pr.files.length > policy.maxChangedFiles) reasons.push(`changes ${pr.files.length} files (limit ${policy.maxChangedFiles})`);
  if (lines > policy.maxChangedLines) reasons.push(`changes ${lines} lines (limit ${policy.maxChangedLines})`);

  const required = policy.requiredChecks[pr.repository] ?? [];
  if (required.length === 0) reasons.push("repository has no required checks configured");
  for (const name of required) {
    const c = pr.checks.find((x) => x.name === name);
    if (!c) reasons.push(`required check missing: ${name}`);
    else if (c.status !== "completed" || c.conclusion !== "success") reasons.push(`required check not green: ${name}`);
  }
  if (pr.checks.some((c) => c.status === "completed" && ["failure", "timed_out", "cancelled", "action_required"].includes(c.conclusion ?? ""))) {
    reasons.push("a check failed");
  }
  if (!pr.reviews.some((r) => r.independent && r.state === "APPROVED")) reasons.push("no independent approving review");
  if (pr.reviews.some((r) => r.state === "CHANGES_REQUESTED")) reasons.push("review requested changes");
  if (pr.unresolvedThreads > 0) reasons.push(`${pr.unresolvedThreads} unresolved review thread(s)`);
  if (pr.mergeable === false) reasons.push("pull request is not mergeable");

  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)], sensitive, evaluatedAt: now.toISOString() };
}

export const DEFAULT_RELEASE_POLICY: ReleasePolicy = {
  approvedPaths: {},
  sensitivePaths: DEFAULT_SENSITIVE_PATHS,
  maxChangedFiles: 6,
  maxChangedLines: 200,
  requiredChecks: {},
  autoReleaseEnabled: false,
};

/** Merges the stored policy over defaults; sensitive paths can only be added to, never removed. */
export function resolvePolicy(stored: unknown, autoReleaseEnabled: boolean): ReleasePolicy {
  const s = (stored && typeof stored === "object" ? stored : {}) as Partial<ReleasePolicy>;
  return {
    approvedPaths: s.approvedPaths && typeof s.approvedPaths === "object" ? s.approvedPaths : {},
    sensitivePaths: [...new Set([...DEFAULT_SENSITIVE_PATHS, ...(Array.isArray(s.sensitivePaths) ? s.sensitivePaths : [])])],
    maxChangedFiles: Math.min(Number(s.maxChangedFiles) || DEFAULT_RELEASE_POLICY.maxChangedFiles, 20),
    maxChangedLines: Math.min(Number(s.maxChangedLines) || DEFAULT_RELEASE_POLICY.maxChangedLines, 600),
    requiredChecks: s.requiredChecks && typeof s.requiredChecks === "object" ? s.requiredChecks : {},
    autoReleaseEnabled,
  };
}

// ---------------------------------------------------------------------------
// Repository map
// ---------------------------------------------------------------------------
export const PRODUCT_REPOSITORIES: Record<Exclude<Product, "unknown" | "platform">, { repository: string; base: string; deployCheck: string }> = {
  cms: { repository: "Brands-In-Blooms/cms-brandsinblooms", base: "dev", deployCheck: "Vercel" },
  crm: { repository: "JonDMorrison/brandsinblooms", base: "main", deployCheck: "Vercel" },
  pos: { repository: "Brands-In-Blooms/bloomtill", base: "main", deployCheck: "Vercel" },
};

// ---------------------------------------------------------------------------
// Permissions mirrored for UI hints (the database is authoritative)
// ---------------------------------------------------------------------------
export const OPERATION_PERMISSIONS: Record<string, string> = {
  "client.lookup": "accounts.read_all",
  "site.read": "ops.site.read",
  "site.page.update": "ops.site.edit",
  "site.create_draft": "ops.site.create",
  "site.publish": "ops.site.publish",
  "campaign.read": "ops.campaign.edit",
  "campaign.create_draft": "ops.campaign.edit",
  "campaign.update_draft": "ops.campaign.edit",
  "campaign.schedule": "ops.campaign.send",
  "campaign.unschedule": "ops.campaign.send",
  "event.read": "ops.site.read",
  "event.update": "ops.event.manage",
  "pos.products": "ops.pos.read",
  "pos.inventory": "ops.pos.read",
  "pos.sales_summary": "ops.pos.read",
};

/** Status labels shown to people. */
export const STATUS_LABEL: Record<string, string> = {
  new: "New",
  working: "Working",
  waiting: "Waiting",
  needs_owner: "Needs Jon/Jeff",
  resolved: "Resolved",
};
