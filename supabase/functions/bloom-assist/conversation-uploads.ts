// Files a person uploaded into an Ask Bloom conversation, looked up for tools.
//
// A tool never trusts an upload reference from the model. The reference must
// be a storage path this person attached to one of their own messages in the
// conversation the request is running in, inside this tenant's folder of the
// bloom-uploads bucket. Everything used for that check (tenant, user,
// conversation) comes from the server-side tool context.

import { type AttachmentKind, fileKind } from "./attachment-kinds.ts";
import type { PersistenceClient } from "./types.ts";

type UploadClient = Pick<PersistenceClient, "from">;

export type ConversationUpload = {
  storagePath: string;
  filename: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
};

export class UploadAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadAccessError";
  }
}

/** The reference value meaning "the most recent matching upload". */
export const LATEST_UPLOAD = "latest";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readUpload(value: unknown): ConversationUpload | null {
  if (!isRecord(value)) return null;
  const storagePath = readString(value.storage_path) ?? readString(value.storagePath);
  const mimeType = (readString(value.mime_type) ?? readString(value.mimeType) ?? readString(value.type))
    ?.toLowerCase() ?? null;
  const size = typeof value.size === "number" ? value.size : typeof value.file_size === "number" ? value.file_size : null;
  if (!storagePath || !mimeType || size === null) return null;
  const kind = fileKind(mimeType);
  if (!kind) return null;
  return {
    storagePath,
    filename: (readString(value.original_filename) ?? readString(value.filename) ?? "upload").slice(0, 180),
    mimeType,
    size,
    kind,
  };
}

/** The storage path must sit in this tenant's and conversation's folder. */
export function pathBelongsTo(storagePath: string, tenantId: string, conversationId: string): boolean {
  if (storagePath.includes("..") || storagePath.includes("\\")) return false;
  const parts = storagePath.split("/");
  return parts.length === 3 && parts[0] === tenantId && parts[1] === conversationId && parts[2].length > 0;
}

export type ResolveUploadArgs = {
  tenantId: string;
  userId: string;
  conversationId: string | null | undefined;
  reference: string | null;
  kinds: AttachmentKind[];
};

/**
 * Finds the upload the reference names (or the latest upload of the given
 * kinds when the reference is empty or "latest"). Throws UploadAccessError when
 * the reference is not this person's upload in this conversation.
 */
export async function resolveConversationUpload(
  client: UploadClient,
  args: ResolveUploadArgs,
): Promise<ConversationUpload> {
  const conversationId = args.conversationId;
  if (!conversationId) {
    throw new UploadAccessError("Files can only be used from the conversation they were uploaded to.");
  }
  const reference = args.reference && args.reference !== LATEST_UPLOAD ? args.reference : null;
  if (reference && !pathBelongsTo(reference, args.tenantId, conversationId)) {
    throw new UploadAccessError("That file was not uploaded to this conversation.");
  }

  const { data: conversation, error: conversationError } = await client
    .from("bloom_conversations")
    .select("id, tenant_id, user_id, status")
    .eq("id", conversationId)
    .maybeSingle();
  if (conversationError) throw new Error(`Failed to check the conversation: ${conversationError.message}`);
  if (
    !isRecord(conversation) || conversation.tenant_id !== args.tenantId ||
    conversation.user_id !== args.userId || conversation.status === "deleted"
  ) {
    throw new UploadAccessError("That file was not uploaded to this conversation.");
  }

  const { data, error } = await client
    .from("bloom_messages")
    .select("attachments, created_at")
    .eq("conversation_id", conversationId)
    .eq("tenant_id", args.tenantId)
    .eq("user_id", args.userId)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Failed to read the conversation's files: ${error.message}`);

  for (const row of Array.isArray(data) ? data : []) {
    const attachments = isRecord(row) && Array.isArray(row.attachments) ? row.attachments : [];
    for (const attachment of [...attachments].reverse()) {
      const upload = readUpload(attachment);
      if (!upload || !pathBelongsTo(upload.storagePath, args.tenantId, conversationId)) continue;
      if (reference && upload.storagePath !== reference) continue;
      if (!args.kinds.includes(upload.kind)) {
        if (reference) throw new UploadAccessError(`"${upload.filename}" is not the right kind of file for this.`);
        continue;
      }
      return upload;
    }
  }

  throw new UploadAccessError(
    reference
      ? "That file was not uploaded to this conversation."
      : "No matching file has been uploaded to this conversation yet.",
  );
}
