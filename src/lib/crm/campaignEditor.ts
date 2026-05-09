import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  CAMPAIGN_STATUS,
  isCampaignStatus,
  type CampaignStatus,
} from "@/constants/campaignStatuses";
import type { StudioBlock } from "@/types/studioBlocks";
import {
  persistCampaignRecord,
  type CampaignDraftConflictError,
} from "@/lib/crm/campaignDraftPersistence";

type CampaignRow = Database["public"]["Tables"]["crm_campaigns"]["Row"];
type SegmentRow = Database["public"]["Tables"]["crm_segments"]["Row"];
type PersonaRow = Database["public"]["Tables"]["crm_personas"]["Row"];
type CampaignSegmentRow =
  Database["public"]["Tables"]["campaign_segments"]["Row"];
type CampaignPersonaRow =
  Database["public"]["Tables"]["campaign_personas"]["Row"];
type CampaignBlockBackupRow =
  Database["public"]["Tables"]["campaign_blocks"]["Row"];

export type CampaignChannel = "email" | "sms" | "newsletter";
export type EditorCampaignType = "email" | "sms";

export interface CampaignSegmentSummary {
  id: string;
  name: string;
  description?: string | null;
  customer_count: number;
}

export interface CampaignPersonaSummary {
  id: string;
  name: string;
  description?: string | null;
}

export interface CampaignCatalogItem {
  id: string;
  name: string;
  subjectLine: string;
  preheaderText: string;
  status: CampaignStatus;
  channel: CampaignChannel;
  queuedAt: string | null;
  queueStartedAt: string | null;
  queueCompletedAt: string | null;
  sentAt: string | null;
  sendStartedAt: string | null;
  sendCompletedAt: string | null;
  scheduledAt: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  sendBlockedReason: string | null;
  totalRecipients: number;
  totalBatches: number;
  messagesSent: number;
  messagesFailed: number;
  messagesSkipped: number;
  totalOpens: number;
  totalClicks: number;
  openRate: number;
  clickRate: number;
  workerHeartbeatAt: string | null;
  estimatedCompletionAt: string | null;
  senderName: string;
  senderEmail: string;
  sourceContentTaskId: string | null;
  syncedFrom: string | null;
}

export interface CampaignEditorRecord extends CampaignCatalogItem {
  content: string;
  deliveryMethod: string | null;
  fromEmailDomainId: string | null;
  replyTo: string;
  contentBlocks: StudioBlock[];
  smsMessage: string;
  includeAllCustomers: boolean;
  additionalCustomerIds: string[];
  segments: CampaignSegmentSummary[];
  personas: CampaignPersonaSummary[];
  metadata: Record<string, unknown>;
}

export interface PersistCampaignDraftInput {
  campaignId?: string | null;
  expectedUpdatedAt?: string | null;
  campaignType: EditorCampaignType;
  status?: CampaignStatus;
  name: string;
  subjectLine: string;
  preheaderText: string;
  senderName: string;
  senderEmail: string;
  fromEmailDomainId?: string | null;
  replyTo?: string;
  contentBlocks: StudioBlock[];
  smsMessage: string;
  sendAt: Date | null;
  sendImmediately: boolean;
  includeAllCustomers?: boolean;
  additionalCustomerIds?: string[];
  segments: CampaignSegmentSummary[];
  personas: CampaignPersonaSummary[];
  sourceContentTaskId?: string | null;
  sourceSegmentId?: string | null;
  sourcePersonaId?: string | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function extractAudienceExpansion(
  campaignRow: CampaignRow,
  metadata: Record<string, unknown>,
) {
  return {
    includeAllCustomers:
      typeof metadata.includeAllCustomers === "boolean"
        ? metadata.includeAllCustomers
        : Boolean(campaignRow.include_all_customers),
    additionalCustomerIds: Array.isArray(metadata.additionalCustomerIds)
      ? toStringArray(metadata.additionalCustomerIds)
      : toStringArray(campaignRow.additional_customer_ids),
  };
}

function toStatus(value: string | null | undefined): CampaignStatus {
  return isCampaignStatus(value) ? value : CAMPAIGN_STATUS.DRAFT;
}

function coerceNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function extractChannel(row: CampaignRow): CampaignChannel {
  const metadata = toRecord(row.metadata);
  const metadataType = String(metadata.campaignType ?? "").toLowerCase();
  const deliveryMethod = String(row.delivery_method ?? "").toLowerCase();
  const syncedFrom = String(row.synced_from ?? "").toLowerCase();

  if (metadataType === "newsletter" || syncedFrom === "newsletter") {
    return "newsletter";
  }

  if (metadataType === "sms" || deliveryMethod === "sms") {
    return "sms";
  }

  return "email";
}

function extractReplyTo(row: CampaignRow) {
  const metadata = toRecord(row.metadata);
  const metadataReplyTo = metadata.replyTo;
  return typeof metadataReplyTo === "string"
    ? metadataReplyTo
    : (row.sender_email ?? "");
}

function extractSmsMessage(row: CampaignRow) {
  const metadata = toRecord(row.metadata);
  const smsMessage = metadata.smsMessage;
  return typeof smsMessage === "string" ? smsMessage : (row.content ?? "");
}

export function mapCampaignCatalogItem(row: CampaignRow): CampaignCatalogItem {
  return {
    id: row.id,
    name: row.name,
    subjectLine: row.subject_line ?? "",
    preheaderText: row.preheader_text ?? row.preheader ?? "",
    status: toStatus(row.status),
    channel: extractChannel(row),
    queuedAt: row.queued_at,
    queueStartedAt: row.queue_started_at,
    queueCompletedAt: row.queue_completed_at,
    sentAt: row.sent_at,
    sendStartedAt: row.send_started_at,
    sendCompletedAt: row.send_completed_at,
    scheduledAt: row.scheduled_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    sendBlockedReason: row.send_blocked_reason,
    totalRecipients:
      row.total_recipients ??
      row.total_sent ??
      coerceNumber(toRecord(row.metrics).sent),
    totalBatches: row.total_batches ?? 0,
    messagesSent: row.messages_sent ?? 0,
    messagesFailed:
      row.messages_failed ?? coerceNumber(toRecord(row.metrics).failed),
    messagesSkipped: row.messages_skipped ?? 0,
    totalOpens: row.total_opens ?? coerceNumber(toRecord(row.metrics).opened),
    totalClicks:
      row.total_clicks ?? coerceNumber(toRecord(row.metrics).clicked),
    openRate: row.open_rate ?? 0,
    clickRate: row.click_rate ?? 0,
    workerHeartbeatAt: row.worker_heartbeat_at,
    estimatedCompletionAt: row.estimated_completion_at,
    senderName:
      row.sender_display_name ??
      row.sender_name ??
      toRecord(row.metadata).senderName?.toString() ??
      "",
    senderEmail: row.actual_sender_email ?? row.sender_email ?? "",
    sourceContentTaskId: row.source_content_task_id,
    syncedFrom: row.synced_from,
  };
}

function mapSegmentSummary(row: SegmentRow): CampaignSegmentSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    customer_count: row.customer_count ?? 0,
  };
}

function mapPersonaSummary(row: PersonaRow): CampaignPersonaSummary {
  return {
    id: row.id,
    name: row.persona_name,
    description: row.persona_description,
  };
}

function normalizeLegacyProductGalleryBlock(block: StudioBlock): StudioBlock {
  const record = block as StudioBlock & { galleryItems?: unknown };

  return block.type === "image-gallery" && record.galleryItems !== undefined
    ? {
        ...block,
        type: "product-gallery",
      }
    : block;
}

export function normalizeLoadedContentBlocks(
  blocks: StudioBlock[],
): StudioBlock[] {
  return blocks.map(normalizeLegacyProductGalleryBlock);
}

function toContentBlocks(value: unknown): StudioBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return normalizeLoadedContentBlocks(value as StudioBlock[]);
}

function toContentBlockFromBackupRow(
  row: CampaignBlockBackupRow,
): StudioBlock | null {
  const content = toRecord(row.content);
  const type =
    typeof content.type === "string" && content.type.length > 0
      ? content.type
      : row.block_type;

  if (!type) {
    return null;
  }

  return {
    ...content,
    id:
      typeof content.id === "string" && content.id.length > 0
        ? content.id
        : row.id,
    type,
    headline:
      typeof content.headline === "string"
        ? content.headline
        : (row.headline ?? undefined),
    imageUrl:
      typeof content.imageUrl === "string"
        ? content.imageUrl
        : (row.image_url ?? undefined),
    ctaText:
      typeof content.ctaText === "string"
        ? content.ctaText
        : (row.cta_text ?? undefined),
    ctaUrl:
      typeof content.ctaUrl === "string"
        ? content.ctaUrl
        : (row.cta_url ?? undefined),
    source:
      typeof content.source === "string" && content.source.length > 0
        ? content.source
        : (row.source ?? "manual"),
    personaTag:
      typeof content.personaTag === "string"
        ? content.personaTag
        : (row.persona_tag ?? undefined),
    order: typeof content.order === "number" ? content.order : row.order_index,
    visible: content.visible !== false,
  } as StudioBlock;
}

async function fetchCampaignBlocksFromBackup(campaignId: string) {
  const { data, error } = await supabase
    .from("campaign_blocks")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("order_index", { ascending: true });

  if (error) {
    throw error;
  }

  return normalizeLoadedContentBlocks(
    (data ?? [])
      .map(toContentBlockFromBackupRow)
      .filter((block): block is StudioBlock => block !== null),
  );
}

export async function fetchCampaignCatalog(tenantId: string) {
  const { data, error } = await supabase
    .from("crm_campaigns")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapCampaignCatalogItem);
}

export async function fetchCampaignEditorRecord(campaignId: string) {
  const { data: campaignRow, error: campaignError } = await supabase
    .from("crm_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (campaignError) {
    throw campaignError;
  }

  const [{ data: campaignSegments }, { data: campaignPersonas }] =
    await Promise.all([
      supabase
        .from("campaign_segments")
        .select("segment_id")
        .eq("campaign_id", campaignId),
      supabase
        .from("campaign_personas")
        .select("persona_id")
        .eq("campaign_id", campaignId),
    ]);

  const segmentIds = Array.from(
    new Set(
      [
        campaignRow.segment_id,
        ...(campaignSegments ?? []).map((row) => row.segment_id),
      ]
        .filter(Boolean)
        .map(String),
    ),
  );
  const personaIds = Array.from(
    new Set(
      [
        ...(campaignRow.persona_ids ?? []),
        ...(campaignPersonas ?? []).map((row) => row.persona_id),
      ]
        .filter(Boolean)
        .map(String),
    ),
  );

  const [{ data: segments }, { data: personas }] = await Promise.all([
    segmentIds.length
      ? supabase.from("crm_segments").select("*").in("id", segmentIds)
      : Promise.resolve({ data: [] as SegmentRow[] }),
    personaIds.length
      ? supabase.from("crm_personas").select("*").in("id", personaIds)
      : Promise.resolve({ data: [] as PersonaRow[] }),
  ]);

  const mapped = mapCampaignCatalogItem(campaignRow);
  const metadata = toRecord(campaignRow.metadata);
  const audienceExpansion = extractAudienceExpansion(campaignRow, metadata);
  const metadataContentBlocks = toContentBlocks(metadata.contentBlocks);
  const contentBlocks =
    metadataContentBlocks.length > 0
      ? metadataContentBlocks
      : await fetchCampaignBlocksFromBackup(campaignId);

  return {
    ...mapped,
    content: campaignRow.content ?? "",
    deliveryMethod: campaignRow.delivery_method,
    fromEmailDomainId: campaignRow.from_email_domain_id,
    replyTo: extractReplyTo(campaignRow),
    contentBlocks,
    smsMessage: extractSmsMessage(campaignRow),
    includeAllCustomers: audienceExpansion.includeAllCustomers,
    additionalCustomerIds: audienceExpansion.additionalCustomerIds,
    segments: (segments ?? []).map(mapSegmentSummary),
    personas: (personas ?? []).map(mapPersonaSummary),
    metadata,
  } satisfies CampaignEditorRecord;
}

async function syncCampaignSegments(
  campaignId: string,
  segments: CampaignSegmentSummary[],
) {
  await supabase
    .from("campaign_segments")
    .delete()
    .eq("campaign_id", campaignId);

  if (segments.length > 1) {
    const rows: CampaignSegmentRow["Insert"][] = segments.map((segment) => ({
      campaign_id: campaignId,
      segment_id: segment.id,
    }));
    const { error } = await supabase.from("campaign_segments").insert(rows);
    if (error) {
      throw error;
    }
  }
}

async function syncCampaignPersonas(
  campaignId: string,
  personas: CampaignPersonaSummary[],
) {
  await supabase
    .from("campaign_personas")
    .delete()
    .eq("campaign_id", campaignId);

  if (personas.length > 0) {
    const rows: CampaignPersonaRow["Insert"][] = personas.map((persona) => ({
      campaign_id: campaignId,
      persona_id: persona.id,
    }));
    const { error } = await supabase.from("campaign_personas").insert(rows);
    if (error) {
      throw error;
    }
  }
}

export async function persistCampaignDraft(input: PersistCampaignDraftInput) {
  const {
    campaignId,
    expectedUpdatedAt = null,
    campaignType,
    status = "draft",
    name,
    subjectLine,
    preheaderText,
    senderName,
    senderEmail,
    fromEmailDomainId = null,
    replyTo,
    contentBlocks,
    smsMessage,
    sendAt,
    sendImmediately,
    includeAllCustomers = false,
    additionalCustomerIds = [],
    segments,
    personas,
    sourceContentTaskId = null,
    sourceSegmentId = null,
    sourcePersonaId = null,
  } = input;

  const savedCampaign = await persistCampaignRecord({
    campaignId,
    expectedUpdatedAt,
    campaignType,
    status,
    name,
    subjectLine,
    preheaderText,
    senderName,
    senderEmail,
    fromEmailDomainId,
    replyTo: replyTo ?? senderEmail,
    contentBlocks: campaignType === "email" ? contentBlocks : [],
    smsMessage,
    sendAt: sendImmediately ? null : (sendAt?.toISOString() ?? null),
    sendImmediately,
    includeAllCustomers,
    additionalCustomerIds,
    sourceContentTaskId,
    sourceSegmentId,
    sourcePersonaId,
    segmentIds: segments.map((segment) => segment.id),
    personaIds: personas.map((persona) => persona.id),
  });

  await Promise.all([
    syncCampaignSegments(savedCampaign.campaign.id, segments),
    syncCampaignPersonas(savedCampaign.campaign.id, personas),
  ]);

  return mapCampaignCatalogItem(savedCampaign.campaign);
}

export async function deleteCampaignById(campaignId: string) {
  const { error } = await supabase
    .from("crm_campaigns")
    .delete()
    .eq("id", campaignId);
  if (error) {
    throw error;
  }
}

export async function updateCampaignStatus(
  campaignId: string,
  status: CampaignStatus,
  extra: Database["public"]["Tables"]["crm_campaigns"]["Update"] = {},
) {
  const { data, error } = await supabase
    .from("crm_campaigns")
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...extra,
    })
    .eq("id", campaignId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapCampaignCatalogItem(data);
}
