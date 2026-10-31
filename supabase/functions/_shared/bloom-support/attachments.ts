// Bloom Support — attachments in the private `bloom-support` bucket.
import { BloomError, db, rpc } from "./runtime.ts";
import { sha256Hex, toHex } from "./crypto.ts";

const ALLOWED = /^(image\/(png|jpe?g|gif|webp|heic)|application\/pdf|text\/(plain|csv)|application\/json|video\/(mp4|quicktime|webm))$/i;
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

function safeName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "-").slice(-120) || "file";
}

export async function storeAttachment(actor: string, ticketId: string, file: { name: string; type: string; bytes: Uint8Array }, opts: { messageId?: string | null; visibility?: "public" | "internal" } = {}) {
  if (!ALLOWED.test(file.type)) throw new BloomError(415, "unsupported", `File type ${file.type} is not accepted`);
  if (file.bytes.byteLength === 0 || file.bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new BloomError(413, "too_large", "Files must be under 15 MB");
  // Authorize against the ticket before writing any bytes.
  if ((await rpc<boolean>("can_attach", { actor, ticket_id: ticketId })) !== true) throw new BloomError(403, "forbidden", "You cannot add files to this ticket");
  const digest = toHex(await crypto.subtle.digest("SHA-256", file.bytes as BufferSource));
  const path = `${ticketId}/${digest.slice(0, 16)}-${safeName(file.name)}`;
  const { error } = await db().storage.from("bloom-support").upload(path, file.bytes, { contentType: file.type, upsert: false });
  if (error && !/exists|duplicate/i.test(error.message)) throw new BloomError(502, "storage_error", error.message);
  return await rpc("add_attachment", {
    actor, ticket_id: ticketId, message_id: opts.messageId ?? null, storage_path: path, file_name: file.name.slice(0, 200),
    content_type: file.type, size_bytes: file.bytes.byteLength, sha256: digest, visibility: opts.visibility ?? "public",
  });
}

export async function attachmentUrl(actor: string, attachmentId: string): Promise<{ url: string; file_name: string }> {
  const a = await rpc<{ storage_bucket: string; storage_path: string; file_name: string }>("get_attachment", { actor, attachment_id: attachmentId });
  const { data, error } = await db().storage.from(a.storage_bucket).createSignedUrl(a.storage_path, 300, { download: a.file_name });
  if (error || !data) throw new BloomError(502, "storage_error", error?.message ?? "could not sign URL");
  return { url: data.signedUrl, file_name: a.file_name };
}

export function decodeBase64File(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  const bin = atob(clean);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export { sha256Hex };
