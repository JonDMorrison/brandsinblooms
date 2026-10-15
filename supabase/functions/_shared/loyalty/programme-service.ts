import type { SupabaseClient } from "npm:@supabase/supabase-js@2.117.2";
import { readAllPages } from "../customer-intelligence/query-pages.ts";
import type { GrowthOrder } from "../customer-intelligence/customer-growth.ts";
import {
  parseProgrammeDraft,
  type ProgrammeDraft,
} from "./programme-planning.ts";
import {
  previewCalendarImport,
  sha256,
  strictRecord,
} from "./calendar-import.ts";
import {
  capturePeriod,
  captureProgrammeBaseline,
  compareProgrammePeriod,
  measurementDays,
  validateMeasurementSettings,
  type CoverageReview,
  type EnrollmentFact,
  type MeasurementCustomer,
  type MeasurementSettings,
  type MeasurementWindow,
  type MessageFact,
  type ProgrammeBaseline,
  type ProgrammeResult,
} from "./programme-measurement.ts";

export class ProgrammeError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export interface ProgrammeContext {
  tenantId: string;
  userId: string;
  userClient: SupabaseClient;
  serviceClient: SupabaseClient;
  now: Date;
}
interface Contact extends MeasurementCustomer {
  first_name: string | null;
  last_name: string | null;
  email: string;
  loyalty_member: boolean | null;
}
interface VersionRow {
  id: string;
  programme_id: string;
  version_number: number;
  definition: ProgrammeDraft;
  definition_hash: string;
  created_at: string;
}
interface BaselineRow {
  id: string;
  programme_id: string;
  programme_version_id: string;
  snapshot: ProgrammeBaseline;
  audience: AudienceSnapshot;
  source_cutoff: string;
  created_at: string;
}
interface AudienceSnapshot {
  kind: "all_customers" | "members" | "segment" | "bloom_set";
  id: string | null;
  name: string;
  definition: unknown;
  customerIds: string[];
  selectedAt: string;
  excludedCount: number;
  unknownCount: number;
  notes: string[];
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requiredUuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID.test(value))
    throw new ProgrammeError(400, `Choose a valid ${label}.`);
  return value.toLowerCase();
}
const optionalUuid = (v: unknown, label: string) =>
  v === null || v === undefined ? null : requiredUuid(v, label);
function page(value: unknown) {
  if (value === undefined) return 1;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 20000)
    throw new ProgrammeError(400, "Invalid page number.");
  return Number(value);
}
function fields(p: Record<string, unknown>, allowed: string[]) {
  const unknown = Object.keys(p).filter(
    (k) => !["action", "expectedTenantId", ...allowed].includes(k),
  );
  if (unknown.length)
    throw new ProgrammeError(400, `Unsupported fields: ${unknown.join(", ")}.`);
}
function confirmed(p: Record<string, unknown>) {
  if (p.confirmed !== true)
    throw new ProgrammeError(
      400,
      "Review and explicitly confirm this action first.",
    );
}
function text(value: unknown, label: string, max = 2000) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new ProgrammeError(
      400,
      `${label} is required (maximum ${max} characters).`,
    );
  return value.trim();
}
function digest(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new ProgrammeError(400, "Invalid review digest.");
  return value;
}
function coverage(value: unknown, cutoff: string): CoverageReview {
  const p = strictRecord(value, "Coverage review");
  if (
    Object.keys(p).some((k) => !["reviewedComplete", "evidence"].includes(k)) ||
    typeof p.reviewedComplete !== "boolean"
  )
    throw new ProgrammeError(400, "Choose a coverage review state.");
  const evidence = typeof p.evidence === "string" ? p.evidence.trim() : "";
  if (evidence.length > 2000 || (p.reviewedComplete && evidence.length < 8))
    throw new ProgrammeError(
      400,
      "Describe the source evidence used to review complete coverage.",
    );
  return {
    status: p.reviewedComplete ? "reviewed_complete" : "unverified",
    evidence,
    reviewedAt: p.reviewedComplete ? cutoff : null,
  };
}
function window(value: unknown): MeasurementWindow {
  const p = strictRecord(value, "Date window");
  if (
    Object.keys(p).some((k) => !["start", "end"].includes(k)) ||
    typeof p.start !== "string" ||
    typeof p.end !== "string"
  )
    throw new ProgrammeError(400, "Choose two dates.");
  const w = { start: p.start, end: p.end };
  measurementDays(w);
  return w;
}
function settings(value: unknown, draft: ProgrammeDraft): MeasurementSettings {
  const p = strictRecord(value, "Measurement weights");
  if (
    Object.keys(p).some(
      (k) => !["spendWeight", "transactionsWeight"].includes(k),
    )
  )
    throw new ProgrammeError(
      400,
      "Only explicit spending and transaction weights are supported.",
    );
  const s = {
    currency: draft.currency,
    timezone: draft.timezone,
    spendWeight: p.spendWeight as number,
    transactionsWeight: p.transactionsWeight as number,
  };
  validateMeasurementSettings(s);
  return s;
}
async function rpc(
  context: ProgrammeContext,
  name: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await context.serviceClient.rpc(name, {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    ...args,
  });
  if (error)
    throw new ProgrammeError(error.code === "42501" ? 403 : 409, error.message);
  return data;
}
export async function loadProgrammeContacts(
  c: ProgrammeContext,
  cutoff: string,
): Promise<Contact[]> {
  return readAllPages<Contact>((from, to) =>
    c.userClient
      .from("crm_customers")
      .select(
        "id,first_name,last_name,email,created_at,email_opt_in,opt_out,suppressed,loyalty_member,deleted_at,merged_into_customer_id",
      )
      .eq("tenant_id", c.tenantId)
      .is("deleted_at", null)
      .is("merged_into_customer_id", null)
      .lte("created_at", cutoff)
      .order("id")
      .range(from, to),
  );
}
async function orders(
  c: ProgrammeContext,
  cutoff: string,
): Promise<GrowthOrder[]> {
  return readAllPages<GrowthOrder>((from, to) =>
    c.userClient
      .from("pos_orders")
      .select(
        "id,tenant_id,crm_customer_id,order_date,created_at,total_amount,refund_amount,currency,status",
      )
      .eq("tenant_id", c.tenantId)
      .lte("created_at", cutoff)
      .order("id")
      .range(from, to),
  );
}
async function memberships(
  c: ProgrammeContext,
  cutoff: string,
): Promise<EnrollmentFact[]> {
  return readAllPages<EnrollmentFact>((from, to) =>
    c.userClient
      .from("customer_loyalty_metrics")
      .select("customer_id,tenant_id,perks_enrolled_at,is_perks_member")
      .eq("tenant_id", c.tenantId)
      .lte("created_at", cutoff)
      .order("customer_id")
      .range(from, to),
  );
}
async function version(
  c: ProgrammeContext,
  versionId: unknown,
): Promise<VersionRow> {
  const id = requiredUuid(versionId, "programme version");
  const { data, error } = await c.userClient
    .from("loyalty_programme_versions")
    .select(
      "id,programme_id,version_number,definition,definition_hash,created_at",
    )
    .eq("tenant_id", c.tenantId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data)
    throw new ProgrammeError(404, "Programme version not accessible.");
  return {
    ...data,
    definition: parseProgrammeDraft(data.definition),
  } as VersionRow;
}
async function baseline(
  c: ProgrammeContext,
  baselineId: unknown,
): Promise<BaselineRow> {
  const id = requiredUuid(baselineId, "baseline");
  const { data, error } = await c.userClient
    .from("loyalty_programme_baselines")
    .select(
      "id,programme_id,programme_version_id,snapshot,audience,source_cutoff,created_at",
    )
    .eq("tenant_id", c.tenantId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data)
    throw new ProgrammeError(404, "Programme baseline not accessible.");
  const b = data as BaselineRow;
  if (
    b.snapshot?.version !== 1 ||
    b.snapshot.period?.tenantId !== c.tenantId ||
    !Array.isArray(b.snapshot.period.customers)
  )
    throw new ProgrammeError(
      409,
      "The stored baseline requires reconciliation.",
    );
  return b;
}
async function resolveAudience(
  c: ProgrammeContext,
  value: unknown,
  contacts: Contact[],
  enrolments: EnrollmentFact[],
  cutoff: string,
): Promise<AudienceSnapshot> {
  const p = strictRecord(value, "Audience");
  if (Object.keys(p).some((k) => !["kind", "id"].includes(k)))
    throw new ProgrammeError(400, "Unsupported audience fields.");
  const available = new Set(contacts.map((x) => x.id));
  let customerIds: string[],
    name: string,
    definition: unknown = {},
    excludedCount = 0,
    unknownCount = 0;
  const notes: string[] = [
    "No marketing consent, deliverability or persona filters are hidden in this audience.",
  ];
  const id = optionalUuid(p.id, "audience");
  switch (p.kind) {
    case "all_customers":
      if (id)
        throw new ProgrammeError(
          400,
          "All customers does not use a segment identifier.",
        );
      customerIds = contacts.map((x) => x.id);
      name = "All active customer profiles";
      definition = { activeProfiles: true };
      break;
    case "members": {
      if (id)
        throw new ProgrammeError(
          400,
          "Members does not use a segment identifier.",
        );
      const enrolled = new Set(
        enrolments
          .filter((e) => e.is_perks_member === true)
          .map((e) => e.customer_id),
      );
      customerIds = contacts
        .filter((x) => x.loyalty_member === true || enrolled.has(x.id))
        .map((x) => x.id);
      unknownCount = contacts.filter(
        (x) => x.loyalty_member === null && !enrolled.has(x.id),
      ).length;
      excludedCount = contacts.length - customerIds.length - unknownCount;
      name = "Recorded loyalty members";
      definition = { recordedMembership: true };
      notes.push(
        "Membership is based on a recorded member flag or provider membership, not newsletter consent.",
      );
      break;
    }
    case "segment": {
      if (!id) throw new ProgrammeError(400, "Choose a saved segment.");
      const { data: s, error } = await c.userClient
        .from("crm_segments")
        .select("id,name,conditions,auto_update,updated_at,customer_count")
        .eq("tenant_id", c.tenantId)
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error || !s)
        throw new ProgrammeError(404, "Segment is not accessible.");
      const members = await readAllPages<{ customer_id: string }>((a, b) =>
        c.userClient
          .from("customer_segments")
          .select("customer_id")
          .eq("segment_id", id)
          .order("customer_id")
          .range(a, b),
      );
      customerIds = [...new Set(members.map((x) => x.customer_id))];
      name = s.name;
      definition = {
        rules: s.conditions,
        dynamic: s.auto_update,
        segmentUpdatedAt: s.updated_at,
      };
      notes.push(
        "This freezes the segment’s currently stored membership. Future dynamic updates do not rewrite this cohort.",
      );
      if (s.customer_count !== customerIds.length)
        notes.push(
          "The stored segment badge count differs; this review uses the actual member records.",
        );
      excludedCount = contacts.length - customerIds.length;
      break;
    }
    case "bloom_set": {
      if (!id)
        throw new ProgrammeError(400, "Choose the exact saved Bloom result.");
      const { data: s, error } = await c.userClient
        .from("bloom_customer_sets")
        .select("label,payload,conversation_id")
        .eq("tenant_id", c.tenantId)
        .eq("user_id", c.userId)
        .eq("id", id)
        .maybeSingle();
      if (error || !s)
        throw new ProgrammeError(404, "Bloom customer result not accessible.");
      const { data: conversation, error: conversationError } =
        await c.userClient
          .from("bloom_conversations")
          .select("id")
          .eq("tenant_id", c.tenantId)
          .eq("user_id", c.userId)
          .eq("id", s.conversation_id)
          .neq("status", "deleted")
          .maybeSingle();
      if (
        conversationError ||
        !conversation ||
        !Array.isArray(s.payload?.included_ids)
      )
        throw new ProgrammeError(
          409,
          "Bloom result ownership or format could not be verified.",
        );
      customerIds = s.payload.included_ids;
      name = s.label;
      definition = {
        setId: id,
        trail: s.payload.trail,
        capturedAt: s.payload.captured_at,
      };
      excludedCount = Array.isArray(s.payload.excluded_ids)
        ? s.payload.excluded_ids.length
        : 0;
      unknownCount = Array.isArray(s.payload.unknown_ids)
        ? s.payload.unknown_ids.length
        : 0;
      break;
    }
    default:
      throw new ProgrammeError(400, "Choose an explicit customer population.");
  }
  if (
    customerIds.length < 1 ||
    customerIds.length > 100000 ||
    customerIds.some((i) => !available.has(i)) ||
    new Set(customerIds).size !== customerIds.length
  ) {
    throw new ProgrammeError(
      409,
      "The audience is empty, oversized or contains customers needing identity reconciliation. No customers were silently removed.",
    );
  }
  return {
    kind: p.kind as AudienceSnapshot["kind"],
    id,
    name,
    definition,
    customerIds,
    selectedAt: cutoff,
    excludedCount,
    unknownCount,
    notes,
  };
}
async function persistPreview(
  c: ProgrammeContext,
  kind: string,
  payload: unknown,
  versionId: string | null,
) {
  const serialized = JSON.stringify(payload);
  if (serialized.length > 24_000_000)
    throw new ProgrammeError(
      413,
      "The evidence snapshot is too large. Use a smaller audience; no partial report was saved.",
    );
  const hash = await sha256(serialized),
    id = crypto.randomUUID(),
    created = c.now.toISOString(),
    expires = new Date(c.now.getTime() + 15 * 60000).toISOString();
  const { error } = await c.serviceClient
    .from("loyalty_operation_previews")
    .insert({
      id,
      tenant_id: c.tenantId,
      user_id: c.userId,
      kind,
      programme_version_id: versionId,
      digest: hash,
      payload,
      created_at: created,
      expires_at: expires,
    });
  if (error)
    throw new ProgrammeError(
      503,
      "The review could not be saved. No programme was activated.",
    );
  return { previewId: id, digest: hash, expiresAt: expires };
}
function contactName(c: Contact) {
  return (
    [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.id
  );
}
async function publicReport(
  c: ProgrammeContext,
  result: ProgrammeResult,
  page: number,
  contacts?: Contact[],
) {
  const known =
    contacts ?? (await loadProgrammeContacts(c, c.now.toISOString()));
  const names = new Map(
    known.map((person) => [person.id, contactName(person)]),
  );
  return {
    ...result,
    rows: result.rows
      .slice((page - 1) * 50, page * 50)
      .map((row) => ({
        ...row,
        displayName:
          names.get(row.customerId) ?? "Customer identity needs review",
      })),
    page,
    count: result.rows.length,
    hasMore: page * 50 < result.rows.length,
  };
}
export async function executeProgrammeCommand(
  value: unknown,
  c: ProgrammeContext,
): Promise<Record<string, unknown>> {
  const p = strictRecord(value, "Command");
  if (p.expectedTenantId !== c.tenantId)
    throw new ProgrammeError(
      409,
      "The selected company changed. Reload before continuing.",
    );
  const cutoff = c.now.toISOString();
  switch (p.action) {
    case "list": {
      fields(p, ["page"]);
      const n = page(p.page);
      const { data, error, count } = await c.userClient
        .from("loyalty_programmes")
        .select("id,name,status,current_version_id,created_at,updated_at", {
          count: "exact",
        })
        .eq("tenant_id", c.tenantId)
        .order("created_at", { ascending: false })
        .order("id")
        .range((n - 1) * 50, n * 50 - 1);
      if (error)
        throw new ProgrammeError(503, "Programme list could not be loaded.");
      return { programmes: data, count, page: n };
    }
    case "get": {
      fields(p, ["programmeId"]);
      const id = requiredUuid(p.programmeId, "programme");
      const { data: programme, error } = await c.userClient
        .from("loyalty_programmes")
        .select("id,name,status,current_version_id,created_at,updated_at")
        .eq("tenant_id", c.tenantId)
        .eq("id", id)
        .maybeSingle();
      if (error || !programme)
        throw new ProgrammeError(404, "Programme not accessible.");
      const current = await version(c, programme.current_version_id);
      const { data: baselines, error: bError } = await c.userClient
        .from("loyalty_programme_baselines")
        .select("id,programme_version_id,source_cutoff,created_at,audience")
        .eq("tenant_id", c.tenantId)
        .eq("programme_id", id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (bError)
        throw new ProgrammeError(503, "Saved baselines could not be loaded.");
      return {
        programme,
        version: current,
        baselines: (baselines ?? []).map((b) => ({
          ...b,
          audience: {
            name: b.audience?.name,
            count: b.audience?.customerIds?.length ?? null,
          },
        })),
        baselineLimit: 100,
      };
    }
    case "save_draft": {
      fields(p, [
        "definition",
        "requestKey",
        "programmeId",
        "expectedVersionId",
      ]);
      const definition = parseProgrammeDraft(p.definition);
      const data = await rpc(c, "save_loyalty_programme_v1", {
        p_definition: definition,
        p_request_key: requiredUuid(p.requestKey, "request key"),
        p_programme_id: optionalUuid(p.programmeId, "programme"),
        p_expected_version_id: optionalUuid(
          p.expectedVersionId,
          "previous version",
        ),
      });
      return {
        saved: data,
        note: "Saved a new immutable draft version. No benefit was issued and no message was sent.",
      };
    }
    case "audiences": {
      fields(p, []);
      const [segments, sets] = await Promise.all([
        readAllPages<{ id: string; name: string; auto_update: boolean }>(
          (a, b) =>
            c.userClient
              .from("crm_segments")
              .select("id,name,auto_update")
              .eq("tenant_id", c.tenantId)
              .is("deleted_at", null)
              .order("id")
              .range(a, b),
        ),
        c.userClient
          .from("bloom_customer_sets")
          .select("id,label,created_at")
          .eq("tenant_id", c.tenantId)
          .eq("user_id", c.userId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (sets.error)
        throw new ProgrammeError(
          503,
          "Saved Bloom results could not be loaded.",
        );
      return { segments, bloomSets: sets.data, bloomSetLimit: 50 };
    }
    case "preview_baseline": {
      fields(p, ["versionId", "audience", "window", "coverage", "weights"]);
      const v = await version(c, p.versionId),
        w = window(p.window),
        s = settings(p.weights, v.definition),
        review = coverage(p.coverage, cutoff);
      const [contacts, ledger, enrolled] = await Promise.all([
        loadProgrammeContacts(c, cutoff),
        orders(c, cutoff),
        memberships(c, cutoff),
      ]);
      const audience = await resolveAudience(
        c,
        p.audience,
        contacts,
        enrolled,
        cutoff,
      );
      const snapshot = capturePeriod(
        ledger,
        audience.customerIds,
        contacts.map((x) => x.id),
        c.tenantId,
        w,
        s,
        cutoff,
        review,
      );
      const captured = captureProgrammeBaseline(snapshot, contacts, enrolled);
      const saved = await persistPreview(
        c,
        "baseline",
        { baseline: captured, audience },
        v.id,
      );
      const names = new Map(contacts.map((x) => [x.id, contactName(x)]));
      return {
        ...saved,
        versionId: v.id,
        baseline: {
          ...captured,
          period: {
            ...snapshot,
            customers: snapshot.customers
              .slice(0, 50)
              .map((x) => ({ ...x, name: names.get(x.customerId) })),
          },
        },
        audience: {
          ...audience,
          customerIds: undefined,
          customerCount: audience.customerIds.length,
        },
        page: 1,
        hasMore: audience.customerIds.length > 50,
        note: "Review freezes this exact audience and recorded baseline. Complete history is a human-reviewed assertion, never inferred by Bloom.",
      };
    }
    case "preview_page": {
      fields(p, ["previewId", "page"]);
      const n = page(p.page),
        id = requiredUuid(p.previewId, "preview");
      const { data, error } = await c.userClient
        .from("loyalty_operation_previews")
        .select("id,kind,digest,payload,expires_at")
        .eq("tenant_id", c.tenantId)
        .eq("user_id", c.userId)
        .eq("id", id)
        .maybeSingle();
      if (error || !data)
        throw new ProgrammeError(404, "Review is not accessible.");
      const rows =
        data.kind === "baseline"
          ? data.payload?.baseline?.period?.customers
          : data.payload?.rows;
      if (!Array.isArray(rows))
        throw new ProgrammeError(409, "Review format is invalid.");
      return {
        previewId: id,
        kind: data.kind,
        digest: data.digest,
        expiresAt: data.expires_at,
        rows: rows.slice((n - 1) * 50, n * 50),
        count: rows.length,
        page: n,
        hasMore: n * 50 < rows.length,
      };
    }
    case "confirm_baseline": {
      fields(p, ["previewId", "digest", "confirmed"]);
      confirmed(p);
      return {
        saved: await rpc(c, "confirm_loyalty_baseline_v1", {
          p_preview_id: requiredUuid(p.previewId, "preview"),
          p_digest: digest(p.digest),
        }),
        note: "Baseline saved. This does not issue rewards or send messages.",
      };
    }
    case "run_report": {
      fields(p, [
        "baselineId",
        "requestKey",
        "window",
        "coverage",
        "normalizeDaily",
        "campaignId",
      ]);
      const b = await baseline(c, p.baselineId),
        w = window(p.window),
        review = coverage(p.coverage, cutoff);
      if (typeof p.normalizeDaily !== "boolean")
        throw new ProgrammeError(400, "Choose whether to compare daily rates.");
      const campaignId = optionalUuid(p.campaignId, "campaign");
      const [contacts, ledger, enrolled] = await Promise.all([
        loadProgrammeContacts(c, cutoff),
        orders(c, cutoff),
        memberships(c, cutoff),
      ]);
      let sent: MessageFact[] = [];
      if (campaignId) {
        const { data, error } = await c.userClient
          .from("crm_campaigns")
          .select("id")
          .eq("id", campaignId)
          .eq("tenant_id", c.tenantId)
          .maybeSingle();
        if (error || !data)
          throw new ProgrammeError(404, "Campaign not accessible.");
        sent = await readAllPages<MessageFact>((a, z) =>
          c.userClient
            .from("email_messages")
            .select("id,tenant_id,customer_id,campaign_id,sent_at")
            .eq("tenant_id", c.tenantId)
            .eq("campaign_id", campaignId)
            .not("sent_at", "is", null)
            .lte("created_at", cutoff)
            .order("id")
            .range(a, z),
        );
      }
      const period = capturePeriod(
        ledger,
        b.snapshot.period.customers.map((x) => x.customerId),
        contacts.map((x) => x.id),
        c.tenantId,
        w,
        b.snapshot.period.settings,
        cutoff,
        review,
      );
      const result = compareProgrammePeriod(
        b.snapshot,
        period,
        contacts,
        enrolled,
        sent,
        p.normalizeDaily,
      );
      const saved = await rpc(c, "save_loyalty_run_v1", {
        p_baseline_id: b.id,
        p_request_key: requiredUuid(p.requestKey, "request key"),
        p_result: result,
        p_period: period,
        p_campaign_id: campaignId,
      });
      return {
        runId: saved.runId,
        result: await publicReport(c, saved.result, 1, contacts),
      };
    }
    case "runs": {
      fields(p, ["baselineId", "page"]);
      const id = requiredUuid(p.baselineId, "baseline"),
        n = page(p.page);
      const { data, error, count } = await c.userClient
        .from("loyalty_programme_runs")
        .select(
          "id,baseline_id,campaign_id,created_at,result->summary,result->currentWindow",
          { count: "exact" },
        )
        .eq("tenant_id", c.tenantId)
        .eq("baseline_id", id)
        .order("created_at", { ascending: false })
        .order("id")
        .range((n - 1) * 25, n * 25 - 1);
      if (error)
        throw new ProgrammeError(503, "Saved results could not be loaded.");
      return { runs: data, count, page: n };
    }
    case "get_run": {
      fields(p, ["runId", "page"]);
      const n = page(p.page),
        id = requiredUuid(p.runId, "result");
      const { data, error } = await c.userClient
        .from("loyalty_programme_runs")
        .select("id,result,baseline_id")
        .eq("tenant_id", c.tenantId)
        .eq("id", id)
        .maybeSingle();
      if (error || !data || !Array.isArray(data.result?.rows))
        throw new ProgrammeError(404, "Programme result not accessible.");
      return {
        runId: id,
        baselineId: data.baseline_id,
        result: await publicReport(c, data.result, n),
      };
    }
    case "evidence": {
      fields(p, ["runId", "customerId"]);
      const id = requiredUuid(p.runId, "result"),
        customer = requiredUuid(p.customerId, "customer");
      const { data, error } = await c.userClient
        .from("loyalty_programme_runs")
        .select("id,baseline_id,result,period_snapshot")
        .eq("tenant_id", c.tenantId)
        .eq("id", id)
        .maybeSingle();
      if (error || !data)
        throw new ProgrammeError(404, "Programme result not accessible.");
      const b = await baseline(c, data.baseline_id),
        result = data.result as ProgrammeResult;
      const comparison = result.rows.find((r) => r.customerId === customer);
      if (!comparison)
        throw new ProgrammeError(404, "Customer was not in this result.");
      return {
        customerId: customer,
        comparison,
        baseline: b.snapshot.period.customers.find(
          (r) => r.customerId === customer,
        ),
        current: data.period_snapshot.customers.find(
          (r: { customerId: string }) => r.customerId === customer,
        ),
        note: "These are immutable recorded values at each source cutoff, not a newly inferred purchase history.",
      };
    }
    case "save_result_segment": {
      fields(p, ["runId", "states", "name", "expectedCount", "confirmed"]);
      confirmed(p);
      if (
        !Array.isArray(p.states) ||
        !p.states.every((s) => typeof s === "string") ||
        !Number.isInteger(p.expectedCount)
      )
        throw new ProgrammeError(
          400,
          "Review states and exact customer count.",
        );
      return {
        saved: await rpc(c, "save_loyalty_result_segment_v1", {
          p_run_id: requiredUuid(p.runId, "result"),
          p_states: p.states,
          p_name: text(p.name, "Segment name", 120),
          p_expected_count: p.expectedCount,
        }),
        note: "Saved a static audience. Sending eligibility is checked separately by the existing campaign tools.",
      };
    }
    case "calendar_preview": {
      fields(p, ["rows", "mapping", "options"]);
      const fingerprints = await readAllPages<{ fingerprint: string }>((a, b) =>
        c.userClient
          .from("calendar_import_rows")
          .select("fingerprint")
          .eq("tenant_id", c.tenantId)
          .order("fingerprint")
          .range(a, b),
      );
      const preview = await previewCalendarImport(
        p.rows,
        p.mapping,
        p.options,
        new Set(fingerprints.map((x) => x.fingerprint)),
      );
      const saved = await persistPreview(c, "calendar", preview, null);
      return {
        ...saved,
        preview: {
          ...preview,
          rows: preview.rows.slice(0, 50),
          page: 1,
          hasMore: preview.rows.length > 50,
        },
      };
    }
    case "calendar_confirm": {
      fields(p, ["previewId", "digest", "acceptRejected", "confirmed"]);
      confirmed(p);
      if (typeof p.acceptRejected !== "boolean")
        throw new ProgrammeError(
          400,
          "Explicitly choose how to handle rejected rows.",
        );
      return {
        saved: await rpc(c, "commit_calendar_import_v1", {
          p_preview_id: requiredUuid(p.previewId, "calendar preview"),
          p_digest: digest(p.digest),
          p_accept_rejected: p.acceptRejected,
        }),
        note: "Imported planned tasks. No email, text or push notification was scheduled.",
      };
    }
    case "calendar_history": {
      fields(p, ["page"]);
      const n = page(p.page);
      const { data, error, count } = await c.userClient
        .from("calendar_import_batches")
        .select("id,preview_id,name,timezone,result,created_at", {
          count: "exact",
        })
        .eq("tenant_id", c.tenantId)
        .order("created_at", { ascending: false })
        .order("id")
        .range((n - 1) * 25, n * 25 - 1);
      if (error)
        throw new ProgrammeError(
          503,
          "Calendar import history could not be loaded.",
        );
      return { batches: data, count, page: n };
    }
    default:
      throw new ProgrammeError(400, "Unknown programme operation.");
  }
}

export interface ProgrammeHandlerDependencies {
  userClient: (authorization: string) => SupabaseClient;
  serviceClient: () => SupabaseClient;
  now?: () => Date;
}
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export function createProgrammeHandler(deps: ProgrammeHandlerDependencies) {
  return async (req: Request): Promise<Response> => {
    const reply = (status: number, value: Record<string, unknown>) =>
      new Response(JSON.stringify(value), {
        status,
        headers: {
          ...cors,
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST")
      return reply(405, { error: "Method not allowed." });
    try {
      const authorization = req.headers.get("Authorization");
      if (!authorization?.startsWith("Bearer ") || authorization.length < 30)
        return reply(401, { error: "Sign in to your CRM workspace." });
      const userClient = deps.userClient(authorization);
      const { data: auth, error: authError } = await userClient.auth.getUser();
      if (authError || !auth.user)
        return reply(401, { error: "Your sign-in could not be verified." });
      const { data: access, error: accessError } = await userClient.rpc(
        "get_current_crm_access",
      );
      if (
        accessError ||
        !access ||
        !UUID.test(access.tenantId ?? "") ||
        !["owner_admin", "marketing"].includes(access.role) ||
        !Array.isArray(access.permissions) ||
        !["customers.read", "reports.read", "loyalty.write"].every((p) =>
          access.permissions.includes(p),
        )
      ) {
        return reply(403, {
          error:
            "Company-wide customer, reporting and loyalty management access is required.",
        });
      }
      const reader = req.body?.getReader();
      if (!reader) return reply(400, { error: "A request body is required." });
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 2_200_000) {
            await reader.cancel();
            return reply(413, { error: "Request is too large." });
          }
          chunks.push(part.value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = new Uint8Array(size);
      let at = 0;
      for (const part of chunks) {
        bytes.set(part, at);
        at += part.byteLength;
      }
      let input: unknown;
      try {
        input = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        );
      } catch {
        return reply(400, { error: "Invalid JSON request." });
      }
      // Construct the privileged client only after the authenticated company/role is resolved.
      const context = {
        tenantId: access.tenantId,
        userId: auth.user.id,
        userClient,
        serviceClient: deps.serviceClient(),
        now: deps.now?.() ?? new Date(),
      };
      const result = await executeProgrammeCommand(input, context);
      return reply(200, { tenantId: context.tenantId, ...result });
    } catch (e) {
      return reply(e instanceof ProgrammeError ? e.status : 400, {
        error: e instanceof Error ? e.message : "Programme operation failed.",
      });
    }
  };
}
