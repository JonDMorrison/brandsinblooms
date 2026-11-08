// Shared, deterministic read-only integration diagnosis for Bloom dashboard and Slack.
// A Slack mention is not permission to modify product data or launch a repair.
export interface DiagnosticAccount {
  id: string;
  name: string;
  links?: Array<{product: string; external_id: string;label?: string|null}>;
}

export function slackDiagnosticUserFromLane(lane: unknown): string | null {
  return typeof lane === "string" ?
    /^slack:ask:projects:([UW][A-Z0-9]{8,24})$/.exec(lane)?.[1] ?? null : null;
}

export function isIntegrationDiagnosticQuestion(question: string): boolean {
  return /\b(verify|check|audit|diagnose|investigate|test)\b/i.test(question) &&
    /\b(counter\s?point|open plant data|opd|heartland|shipstation|integrations?|sync|synchroni[sz]ation)\b/i.test(question);
}

/** Extract the named customer next to the requested integration, not arbitrary
 * words in the surrounding Slack message or connector attribution. */
export function diagnosticClientHint(question: string): string | null {
  if (question.length > 1000) return null;
  const pattern = /\b(?:verify|check|audit|diagnose|investigate|test)\s+([a-z][a-z0-9&.'\-]*(?:\s+[a-z][a-z0-9&.'\-]*){0,5}?)\s+(?:counter\s?point|open plant data|opd|heartland|shipstation|integrations?|sync|synchroni[sz]ation)\b/gi;
  const matches = [...question.matchAll(pattern)];
  const label = matches.at(-1)?.[1]
    ?.replace(/^(?:the|that|our|a|an)\s+/i, "")
    .replace(/['’]s$/i, "").trim();
  // "Check CounterPoint integration for Lacoste" names the integration
  // first: "CounterPoint" is not a customer. Prefer the explicit for/at name.
  if (label && label.length >= 3 && label.length <= 80 &&
      !/^(?:counter\s?point|open plant data|opd|heartland|shipstation|integrations?|sync)\b/i.test(label)) return label;
  // Support "check CounterPoint for Lacoste" without guessing a company from
  // the unrelated words around the request.
  const after = /\b(?:counter\s?point|open plant data|opd|heartland|shipstation|integrations?|sync)\b[^\n.!?]{0,80}?\b(?:for|at)\s+([a-z][a-z0-9'.\-]{2,90})\b/i.exec(question)?.[1];
  return after && after.length >= 3 ? after : null;
}

export function providerHealthScope(question: string): "heartland" | "shipstation" | "both" | null {
  const heartland = /\bheartland\b/i.test(question);
  const shipstation = /\bshipstation\b/i.test(question);
  return heartland && shipstation ? "both" : heartland ? "heartland" : shipstation ? "shipstation" : null;
}

const normalize = (value: string): string => " " + value.toLowerCase()
  .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim() + " ";
const generic = new Set(["garden","gardens","centre","center","nursery","nurseries","the","ltd","inc","store","flower","plants"]);
const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function findDiagnosticAccount(question: string, accounts: DiagnosticAccount[]):
  {account: DiagnosticAccount;siteId:string} | null {
  const normalizedQuestion = normalize(question);
  const candidates = accounts
    .flatMap(account => (account.links ?? [])
      .filter(link => link.product === "cms" && isUuid(link.external_id))
      .map(link => ({account,siteId:link.external_id,label:link.label??""})))
    .map(candidate => {
      const name = normalize(candidate.account.name);
      const tokens = name.trim().split(" ").filter(word => word.length >= 4 && !generic.has(word));
      const domain = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b/i.exec(question)?.[0]?.toLowerCase();
      const linkedDomain = /(?:^|\s|·)([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})(?:\s|$)/i.exec(candidate.label)?.[1]?.toLowerCase();
      const score = domain && linkedDomain === domain ? 10
        : name.trim().length >= 4 && normalizedQuestion.includes(name) ? 5
        : tokens.some(word => normalizedQuestion.includes(" " + word + " ")) ? 1 : 0;
      return {...candidate,score};
    }).filter(c => c.score > 0).sort((a,b) => b.score - a.score);
  // Ambiguous customer names or multiple sites require a clearer request.
  if (!candidates.length || (candidates[1] && candidates[1].score === candidates[0].score))
    return null;
  const {account,siteId} = candidates[0];
  return {account,siteId};
}

const asObj = (value: unknown): Record<string,unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
const yes = (v: unknown): boolean => v === true;
const count = (v: unknown): number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : 0;
const field = (v: unknown): string =>
  typeof v === "string" && /^[a-z0-9_.-]{1,48}$/i.test(v) && !/^(?:sk_|rk_|xox|ghp_)/i.test(v) ? v.replaceAll("_"," ") : "unknown";
const safeName = (v: unknown): string =>
  typeof v === "string" && v.length <= 80 && /^[a-z0-9 &'-]+$/i.test(v) ? v : "this garden centre";
const time = (v: unknown): string =>
  typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString().slice(0,16).replace("T"," ")+" UTC" : "not recorded";

/** No raw provider errors, customer names from sync rows, or uncontrolled strings reach Slack. */
export function formatIntegrationEvidence(name: string, value: unknown): string {
  const report = asObj(value);
  const cp = asObj(report.counterpoint);
  const opd = asObj(report.opd);
  const assessed = report.assessment === "needs_attention";
  const header = assessed ? "Needs attention" : "Not fully verified";
  const connection = yes(cp.configured) ? field(cp.connection_status) : "not configured";
  const healthy = yes(cp.configured) ? field(cp.connection_health) : "not available";
  const catalogue = yes(cp.configured) ? field(cp.catalogue_sync_status) : "not available";
  const rows = Array.isArray(cp.recent_batches) ? cp.recent_batches.slice(0,5) : [];
  const staged = rows.filter(item => asObj(item).status === "staged").length;
  const caveat = assessed ? "At least one recorded status needs investigation." :
    "There is no recorded failure in this summary, but the customer's actual workflow still requires verification.";
  return [
    "*Integration check: " + safeName(name) + "*",
    "*Overall:* " + header + ". " + caveat,
    "",
    "*CounterPoint*",
    "• Connection: " + connection + " (reported health: " + healthy + ")",
    "• Latest successful receipt: " + time(cp.last_success_at),
    "• Catalogue synchronization: " + catalogue,
    "• Recent staged batches (last " + rows.length + " checked): " + staged + ". Staged is not proof of import.",
    "",
    "*Open Plant Data*",
    "• Enabled: " + (yes(opd.enabled) ? "yes" : "no or not configured"),
    "• Product links: " + count(opd.imported_links) + " imported; " +
      count(opd.approved_links) + " approved; " + count(opd.failed_links) + " failed",
    "• Latest link update: " + time(opd.latest_link_update_at),
    "",
    "*Next:* Review the sync errors in BloomSites. If the original customer workflow fails, open or update a Bloom Support ticket before requesting a repair.",
    "<https://bloomsites.app/dashboard/integrations|Open integrations> · <https://bloomsuite.app/admin/bloom-support|Open Bloom Support>",
    "_Read-only evidence. No settings, orders, customer records or integrations were changed._",
  ].join("\n");
}

/** Heartland/ShipStation status comes from the same signed, site-scoped CMS read. */
export function formatProviderEvidence(name: string, value: unknown): string {
  const report=asObj(value);
  const heartland=asObj(report.heartland);
  const shipstation=asObj(report.shipstation);
  const scope=report.scope;
  const showHeartland=scope==="heartland"||scope==="both";
  const showShipstation=scope==="shipstation"||scope==="both";
  const concerned=report.assessment==="needs_attention";
  const out=[
    "*Integration check: " + safeName(name) + "*",
    "*Overall:* " + (concerned?"Needs attention":"Not fully verified") + ".",
    "_Read-only provider evidence. No live order or customer checkout was changed or proven working._",
  ];
  if(showHeartland) {
    const runs=Array.isArray(heartland.recent_runs) ? heartland.recent_runs.slice(0,5) : [];
    out.push("","*Heartland*",
      "• Connection: "+(yes(heartland.configured)?field(heartland.connection_status):"not configured"),
      "• Last successful sync: "+time(heartland.last_success_at),
      "• Automatic sync: "+(yes(heartland.auto_sync)?"enabled":"not enabled"),
      "• Stock publication: "+(yes(heartland.stock_publication_enabled)?"enabled":"not enabled"),
      "• Recent runs (last "+runs.length+" checked): "+runs.filter(r=>["failed","error","dead"].includes(String(asObj(r).status))).length+" failures recorded.",
    );
  }
  if(showShipstation) {
    const events=Array.isArray(shipstation.recent_order_events)?shipstation.recent_order_events.slice(0,5):[];
    out.push("","*ShipStation*",
      "• Connection: "+(yes(shipstation.configured)?field(shipstation.connection_status):"not configured"),
      "• Last successful delivery: "+time(shipstation.last_success_at),
      "• Latest recorded error: "+time(shipstation.last_error_at),
      "• Recent order events (last "+events.length+" checked): "+events.filter(e=>["failed","error","dead"].includes(String(asObj(e).status))).length+" failures recorded.",
    );
  }
  const findings=Array.isArray(report.findings)
    ? report.findings.filter((f):f is string=>typeof f==="string").slice(0,4)
    : [];
  if(findings.length)out.push("","*Needs review:* "+findings.map(x=>x.replace(/[<>@*\r\n]/g," ").slice(0,130)).join(" · "));
  out.push("","*Next:* Open the integration dashboard, check the original customer order or catalogue workflow, and request a separately authorized repair if it fails.",
    "<https://bloomsites.app/dashboard/integrations|Open integrations> · <https://bloomsuite.app/admin/bloom-support|Open Bloom Support>");
  return out.join("\n");
}
