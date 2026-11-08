// Shared, deterministic read-only integration diagnosis for Bloom dashboard and Slack.
// A Slack mention is not permission to modify product data or launch a repair.
export interface DiagnosticAccount {
  id: string;
  name: string;
  links?: Array<{product: string; external_id: string}>;
}

export function isIntegrationDiagnosticQuestion(question: string): boolean {
  return /\b(verify|check|audit|diagnose|investigate|test)\b/i.test(question) &&
    /\b(counter\s?point|open plant data|opd|integrations?|sync|synchroni[sz]ation)\b/i.test(question);
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
      .map(link => ({account,siteId:link.external_id})))
    .map(candidate => {
      const name = normalize(candidate.account.name);
      const tokens = name.trim().split(" ").filter(word => word.length >= 4 && !generic.has(word));
      const score = name.trim().length >= 4 && normalizedQuestion.includes(name) ? 5
        : tokens.length > 0 && tokens.every(word => normalizedQuestion.includes(" " + word + " ")) ? 3
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
  typeof v === "string" && /^[a-z0-9_.-]{1,48}$/i.test(v) ? v.replaceAll("_"," ") : "unknown";
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
