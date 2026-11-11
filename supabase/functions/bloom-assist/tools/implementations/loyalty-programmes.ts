import {
  analysisResult,
  requireAnalysisAccess,
} from "./customer-exploration.ts";
import type { ToolImplementation } from "../types.ts";
import { PROGRAMME_TEMPLATES } from "../../../_shared/loyalty/programme-templates.ts";
const uuid = (value: unknown) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const pageNumber = (value: unknown) => {
  if (value === undefined) return 1;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 20000)
    throw new Error("Choose a valid result page.");
  return Number(value);
};
export const listLoyaltyProgrammeTemplates: ToolImplementation = async (
  _params,
  context,
) => {
  await requireAnalysisAccess(context);
  return analysisResult(
    {
      kind: "loyalty_templates",
      rows: PROGRAMME_TEMPLATES,
      note: "These are configurable programme templates, not issued benefits. Review and approve programme terms and customer eligibility in the loyalty workspace.",
    },
    PROGRAMME_TEMPLATES.length,
    "Available rewards-led programme templates.",
  );
};
export const listLoyaltyProgrammes: ToolImplementation = async (
  params,
  context,
) => {
  const client = await requireAnalysisAccess(context),
    page = pageNumber(params.page);
  if (params.programme_id !== undefined) {
    if (!uuid(params.programme_id))
      throw new Error("Use a programme ID returned by the list.");
    const { data: programme, error } = await client
      .from("loyalty_programmes")
      .select("id,name,status,current_version_id,created_at,updated_at")
      .eq("tenant_id", context.tenantId)
      .eq("id", params.programme_id)
      .maybeSingle();
    if (error || !programme) throw new Error("Programme is not accessible.");
    const { data: version, error: versionError } = await client
      .from("loyalty_programme_versions")
      .select("id,version_number,definition,definition_hash,created_at")
      .eq("tenant_id", context.tenantId)
      .eq("id", programme.current_version_id)
      .maybeSingle();
    const {
      data: baselines,
      error: baselineError,
      count,
    } = await client
      .from("loyalty_programme_baselines")
      .select("id,programme_version_id,source_cutoff,audience,created_at", {
        count: "exact",
      })
      .eq("tenant_id", context.tenantId)
      .eq("programme_id", programme.id)
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 25, page * 25 - 1);
    if (versionError || baselineError)
      throw new Error("Stored programme evidence could not be read.");
    return analysisResult(
      {
        kind: "loyalty_programme",
        programme,
        version,
        page,
        total_baselines: count,
        baselines: (baselines ?? []).map((b) => ({
          id: b.id,
          programme_version_id: b.programme_version_id,
          source_cutoff: b.source_cutoff,
          audience_name: b.audience?.name,
          customer_count: b.audience?.customerIds?.length,
          audience_definition: b.audience?.definition,
        })),
        open_path: "/crm/intelligence?programme=" + programme.id,
        note: "A stored programme version and baseline do not establish issuance or POS redemption.",
      },
      1,
      "Saved programme terms and exact cohort baselines.",
    );
  }
  const { data, error, count } = await client
    .from("loyalty_programmes")
    .select("id,name,status,current_version_id,created_at", { count: "exact" })
    .eq("tenant_id", context.tenantId)
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 25, page * 25 - 1);
  if (error) throw new Error(error.message);
  return analysisResult(
    {
      kind: "loyalty_programmes",
      rows: data ?? [],
      page,
      total_count: count,
      has_more: page * 25 < (count ?? 0),
      note: "Ready means a baseline was saved, not that rewards are live.",
    },
    count ?? 0,
    "These are the company’s saved loyalty programmes.",
  );
};
export const readLoyaltyProgrammeResults: ToolImplementation = async (
  params,
  context,
) => {
  const client = await requireAnalysisAccess(context),
    page = pageNumber(params.page);
  if (Boolean(params.run_id) === Boolean(params.baseline_id))
    throw new Error("Choose exactly one baseline ID or report ID.");
  if (params.run_id) {
    if (!uuid(params.run_id)) throw new Error("Use an exact report ID.");
    const { data, error } = await client
      .from("loyalty_programme_runs")
      .select("id,baseline_id,result,created_at")
      .eq("tenant_id", context.tenantId)
      .eq("id", params.run_id)
      .maybeSingle();
    if (
      error ||
      !data ||
      data.result?.tenantId !== context.tenantId ||
      !Array.isArray(data.result.rows)
    )
      throw new Error("Saved result is not accessible.");
    return analysisResult(
      {
        ...data.result,
        run_id: data.id,
        baseline_id: data.baseline_id,
        rows: data.result.rows.slice((page - 1) * 50, page * 50),
        page,
        total_count: data.result.rows.length,
        has_more: page * 50 < data.result.rows.length,
      },
      data.result.rows.length,
      "Saved customer-over-customer results. Unknown history is unscored; post-message purchases do not establish causal marketing impact.",
    );
  }
  if (!uuid(params.baseline_id))
    throw new Error("Use a baseline ID returned by the programme.");
  const { data, error, count } = await client
    .from("loyalty_programme_runs")
    .select(
      "id,baseline_id,created_at,campaign_id,result->summary,result->currentWindow",
      { count: "exact" },
    )
    .eq("tenant_id", context.tenantId)
    .eq("baseline_id", params.baseline_id)
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 25, page * 25 - 1);
  if (error) throw new Error(error.message);
  return analysisResult(
    {
      kind: "loyalty_programme_runs",
      rows: data ?? [],
      page,
      total_count: count,
      has_more: page * 25 < (count ?? 0),
    },
    count ?? 0,
    "Saved comparisons for this exact baseline.",
  );
};
