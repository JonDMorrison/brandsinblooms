// Bloom Support — attachments in the private `bloom-support` bucket.
import { BloomError, db, directRpc, rpc } from "./runtime.ts";
import { sha256Hex, toHex } from "./crypto.ts";

const ALLOWED = /^(image\/(png|jpe?g|gif|webp|heic)|application\/pdf|text\/(plain|csv)|application\/json|video\/(mp4|quicktime|webm))$/i;
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_ATTACHMENT_TOTAL_BYTES = 12 * 1024 * 1024;
const EXTENSIONS: Record<string, Set<string>> = {
  "image/png": new Set(["png"]),
  "image/jpeg": new Set(["jpg", "jpeg"]),
  "image/gif": new Set(["gif"]),
  "image/webp": new Set(["webp"]),
  "image/heic": new Set(["heic"]),
  "application/pdf": new Set(["pdf"]),
  "text/plain": new Set(["txt", "log"]),
  "text/csv": new Set(["csv"]),
  "application/json": new Set(["json"]),
  "video/mp4": new Set(["mp4"]),
  "video/quicktime": new Set(["mov"]),
  "video/webm": new Set(["webm"]),
};

export interface AttachmentFile {
  name: string;
  type: string;
  bytes: Uint8Array;
}

function containsControlCharacter(value: string, allowWhitespace = false): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (
      codePoint === 0x7f ||
      (codePoint < 0x20 && (!allowWhitespace || ![0x09, 0x0a, 0x0d].includes(codePoint)))
    ) {
      return true;
    }
  }
  return false;
}

/** Keep stored/downloaded names display-only: never accept a path or controls. */
export function validateAttachmentName(name: string): string {
  const normalized = name.trim();
  if (
    !normalized ||
    normalized.length > 200 ||
    normalized === "." ||
    normalized === ".." ||
    normalized.includes("/") ||
    normalized.includes("\\") ||
    containsControlCharacter(normalized)
  ) {
    throw new BloomError(
      400,
      "invalid",
      "Attachment names must be 1 to 200 characters and cannot contain paths or control characters",
    );
  }
  return normalized;
}

const startsWith = (bytes: Uint8Array, signature: number[]) =>
  bytes.length >= signature.length &&
  signature.every((value, index) => bytes[index] === value);
const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.slice(start, start + length));
const hasIsoBrand = (bytes: Uint8Array, brands: string[]) =>
  bytes.length >= 12 &&
  ascii(bytes, 4, 4) === "ftyp" &&
  brands.some((brand) =>
    ascii(bytes, 8, Math.min(bytes.length - 8, 56)).includes(brand)
  );

function validText(bytes: Uint8Array): string | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return containsControlCharacter(text, true)
      ? null
      : text;
  } catch {
    return null;
  }
}

/** Validate filename, declared media type and their extension relationship. */
export function validateAttachmentMetadata(name: string, type: string): { fileName: string; contentType: string } {
  const fileName = validateAttachmentName(name);
  const contentType = type.split(";", 1)[0].trim().toLowerCase();
  if (!ALLOWED.test(contentType)) {
    throw new BloomError(415, "unsupported", `File type ${type} is not accepted`);
  }
  const extension = fileName.match(/\.([A-Za-z0-9]+)$/)?.[1].toLowerCase();
  if (!extension || !EXTENSIONS[contentType]?.has(extension)) {
    throw new BloomError(
      415,
      "unsupported",
      "The file extension does not match its type",
    );
  }
  return { fileName, contentType };
}

export function validateAttachmentFile(file: {
  name: string;
  type: string;
  bytes: Uint8Array;
}): string {
  const { contentType } = validateAttachmentMetadata(file.name, file.type);
  if (
    file.bytes.byteLength === 0 ||
    file.bytes.byteLength > MAX_ATTACHMENT_BYTES
  ) {
    throw new BloomError(413, "too_large", "Files must be 8 MB or smaller");
  }

  const bytes = file.bytes;
  let valid = false;
  switch (contentType) {
    case "image/png":
      valid = bytes.length >= 24 &&
        startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) &&
        ascii(bytes, 12, 4) === "IHDR";
      break;
    case "image/jpeg":
      valid = bytes.length >= 4 &&
        startsWith(bytes, [0xff, 0xd8, 0xff]) &&
        bytes.at(-2) === 0xff &&
        bytes.at(-1) === 0xd9;
      break;
    case "image/gif":
      valid = bytes.length >= 13 &&
        (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a");
      break;
    case "image/webp":
      valid = ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
      break;
    case "image/heic":
      valid = hasIsoBrand(bytes, ["heic", "heix", "hevc", "hevx", "mif1", "msf1"]);
      break;
    case "application/pdf":
      valid = ascii(bytes, 0, 5) === "%PDF-" &&
        ascii(bytes, Math.max(0, bytes.length - 1024), Math.min(1024, bytes.length))
          .includes("%%EOF");
      break;
    case "video/mp4":
      valid = hasIsoBrand(bytes, ["isom", "iso2", "mp41", "mp42", "avc1", "M4V ", "3gp4"]);
      break;
    case "video/quicktime":
      valid = hasIsoBrand(bytes, ["qt  "]);
      break;
    case "video/webm":
      valid = startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
      break;
    case "application/json": {
      const text = validText(bytes);
      try {
        if (text !== null && text.trim()) {
          JSON.parse(text);
          valid = true;
        }
      } catch {
        valid = false;
      }
      break;
    }
    case "text/plain":
    case "text/csv":
      valid = validText(bytes) !== null;
      break;
  }
  if (!valid) {
    throw new BloomError(
      415,
      "unsupported",
      "The file contents do not match its type",
    );
  }
  return contentType;
}

function safeName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "-").slice(-120) || "file";
}

export async function storeAttachment(actor: string, ticketId: string, file: AttachmentFile, opts: { messageId?: string | null; visibility?: "public" | "internal" } = {}) {
  const fileName = validateAttachmentName(file.name);
  const contentType = validateAttachmentFile(file);
  // Authorize against the ticket before writing any bytes.
  if ((await rpc<boolean>("can_attach", { actor, ticket_id: ticketId })) !== true) throw new BloomError(403, "forbidden", "You cannot add files to this ticket");
  const digest = toHex(await crypto.subtle.digest("SHA-256", file.bytes as BufferSource));
  const attachmentScope = opts.messageId ?? "ticket";
  const path = `${ticketId}/${attachmentScope}/${digest.slice(0, 16)}-${safeName(fileName)}`;
  const { error } = await db().storage.from("bloom-support").upload(path, file.bytes, { contentType, upsert: false });
  if (error && !/exists|duplicate/i.test(error.message)) throw new BloomError(502, "storage_error", error.message);
  const args = {
    actor, ticket_id: ticketId, message_id: opts.messageId ?? null, storage_path: path, file_name: fileName,
    content_type: contentType, size_bytes: file.bytes.byteLength, sha256: digest, visibility: opts.visibility ?? "public",
  };
  const recorded = await rpc("add_attachment", args);
  if (recorded) return recorded;

  // The gateway intentionally de-duplicates by deterministic storage path.
  // A retry must count an existing row only after the database proves it is
  // the same ticket and exact attachment metadata, never because an INSERT
  // happened to return no row.
  return await directRpc("bloom_support_confirm_attachment", {
    p_actor: actor,
    p_ticket: ticketId,
    p_message_id: opts.messageId ?? null,
    p_storage_path: path,
    p_file_name: fileName,
    p_content_type: contentType,
    p_size_bytes: file.bytes.byteLength,
    p_sha256: digest,
    p_visibility: opts.visibility ?? "public",
  });
}

export async function attachmentUrl(actor: string, attachmentId: string): Promise<{ url: string; file_name: string }> {
  const a = await rpc<{ storage_bucket: string; storage_path: string; file_name: string }>("get_attachment", { actor, attachment_id: attachmentId });
  const { data, error } = await db().storage.from(a.storage_bucket).createSignedUrl(a.storage_path, 300, { download: a.file_name });
  if (error || !data) throw new BloomError(502, "storage_error", error?.message ?? "could not sign URL");
  return { url: data.signedUrl, file_name: a.file_name };
}

export function decodeBase64File(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^,]*;base64,/i, "");
  if (
    !clean ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      clean,
    )
  ) {
    throw new BloomError(400, "invalid", "Attachment data must be valid base64");
  }
  try {
    const bin = atob(clean);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    throw new BloomError(400, "invalid", "Attachment data must be valid base64");
  }
}

export { sha256Hex };
