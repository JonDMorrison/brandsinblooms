// "Use this photo": put a png/jpeg the person uploaded to this chat into a
// campaign draft that Bloom creates.
//
// The upload is checked against the conversation (conversation-uploads.ts),
// copied from the private bloom-uploads bucket into campaign-images under the
// person's own folder (the same place and path pattern the Campaign Studio
// uploader uses), and its public URL becomes the draft's main photo. This only
// shapes a draft: nothing is sent, scheduled or published.

import {
  type ConversationUpload,
  resolveConversationUpload,
} from "../../conversation-uploads.ts";
import type { JsonObject, PersistenceClient } from "../../types.ts";
import type { ToolExecutionContext, ToolResult } from "../types.ts";

export const CAMPAIGN_IMAGE_BUCKET = "campaign-images";
/** Same limit as the Campaign Studio uploader. */
export const CAMPAIGN_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_MIME_TYPES = new Set(["image/png", "image/jpeg"]);
const HERO_IMAGE_TEMPLATE_LIMIT = 6;

type StorageClient = Pick<PersistenceClient, "storage">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function readPhotoReference(params: JsonObject): string | null {
  return readString(params.photo_upload_id);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function altText(filename: string): string {
  return filename.replace(/^[0-9a-f-]{36}_/i, "").replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim() || "Campaign photo";
}

export class CampaignPhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignPhotoError";
  }
}

/** Finds the photo and checks it can be used in a campaign. */
export async function resolveCampaignPhoto(
  context: ToolExecutionContext,
  params: JsonObject,
): Promise<ConversationUpload> {
  const channel = readString(params.delivery_method) ?? "email";
  if (channel === "sms") {
    throw new CampaignPhotoError("Photos can only be added to email campaign drafts, not SMS.");
  }
  const upload = await resolveConversationUpload(context.serviceClient, {
    tenantId: context.tenantId,
    userId: context.userId,
    conversationId: context.conversationId,
    reference: readPhotoReference(params),
    kinds: ["image"],
  });
  if (!PHOTO_MIME_TYPES.has(upload.mimeType)) {
    throw new CampaignPhotoError("Campaign photos must be PNG or JPEG.");
  }
  if (upload.size > CAMPAIGN_PHOTO_MAX_BYTES) {
    throw new CampaignPhotoError("Campaign photos can be up to 5 MB. Upload a smaller version of this photo.");
  }
  return upload;
}

/**
 * The preview for a create_campaign call that names a photo: pins the exact
 * upload into the parameters the person approves and shows it on the card.
 */
export async function withCampaignPhotoPreview(
  confirmation: ToolResult,
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const upload = await resolveCampaignPhoto(context, params);
  const data = isRecord(confirmation.data) ? confirmation.data as JsonObject : {};
  return {
    ...confirmation,
    data: {
      ...data,
      pinned_tool_params: { ...params, photo_upload_id: upload.storagePath },
      task_plan: {
        field_diffs: [
          { field: "Photo", current_value: null, new_value: `${upload.filename} (from this chat)` },
          { field: "Status", current_value: null, new_value: "Draft only. Nothing is sent or scheduled." },
        ],
      },
    },
  };
}

/** Copies the upload into campaign-images and returns its public URL. */
export async function copyPhotoToCampaignImages(args: {
  source: StorageClient;
  destination: StorageClient;
  userId: string;
  upload: ConversationUpload;
  read?: (client: StorageClient, path: string) => Promise<Uint8Array>;
}): Promise<string> {
  // attachments.ts loads the spreadsheet parser; import it only when needed.
  const read = args.read ??
    (async (client: StorageClient, path: string) =>
      (await import("../../attachments.ts")).downloadAttachmentBytes(client as PersistenceClient, path));
  const bytes = await read(args.source, args.upload.storagePath);
  if (bytes.length > CAMPAIGN_PHOTO_MAX_BYTES) {
    throw new CampaignPhotoError("Campaign photos can be up to 5 MB. Upload a smaller version of this photo.");
  }
  const extension = args.upload.mimeType === "image/png" ? "png" : "jpg";
  const path = `${args.userId}/studio/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const bucket = args.destination.storage.from(CAMPAIGN_IMAGE_BUCKET);
  const { error } = await bucket.upload(path, new Blob([new Uint8Array(bytes)], { type: args.upload.mimeType }), {
    cacheControl: "3600",
    contentType: args.upload.mimeType,
    upsert: false,
  });
  if (error) throw new Error(`The photo could not be copied into campaign images: ${error.message}`);
  const { data } = bucket.getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("The copied photo has no public address.");
  return data.publicUrl;
}

/**
 * Puts the photo into the draft's parameters: the hero image of a designed
 * newsletter (or a supporting photo when a hero is already chosen), or the top
 * of a plain email body. Returns parameters without photo_upload_id.
 */
export function applyPhotoToCampaignParams(
  params: JsonObject,
  url: string,
  filename: string,
): JsonObject {
  const { photo_upload_id: _photo, ...rest } = params;
  const alt = altText(filename);
  if (rest.template_id !== undefined) {
    const brief = isRecord(rest.newsletter_brief) ? { ...rest.newsletter_brief } as JsonObject : null;
    if (!brief) return rest;
    if (!readString(brief.heroImageUrl)) {
      return { ...rest, newsletter_brief: { ...brief, heroImageUrl: url, heroImageAlt: readString(brief.heroImageAlt) ?? alt } };
    }
    const images = Array.isArray(brief.images) ? brief.images : [];
    if (images.length >= HERO_IMAGE_TEMPLATE_LIMIT) return rest;
    return { ...rest, newsletter_brief: { ...brief, images: [{ url, alt }, ...images] } };
  }
  const image = `<p><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" style="display:block;max-width:100%;height:auto;" /></p>`;
  const content = readString(rest.content);
  return { ...rest, content: content ? `${image}\n${content}` : image };
}

/** Resolves, copies and applies the photo for an approved create_campaign. */
export async function campaignParamsWithPhoto(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<JsonObject> {
  if (!readPhotoReference(params)) return params;
  if (!context.dataClient) throw new CampaignPhotoError("Bloom could not confirm your access to campaign images.");
  const upload = await resolveCampaignPhoto(context, params);
  const url = await copyPhotoToCampaignImages({
    source: context.serviceClient,
    destination: context.dataClient,
    userId: context.userId,
    upload,
  });
  return applyPhotoToCampaignParams(params, url, upload.filename);
}
