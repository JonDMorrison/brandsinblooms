import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

import { corsJsonResponse, handleCorsPreflight } from "../_shared/cors.ts";
import {
  createOpenAIEmbeddings,
  OPENAI_EMBEDDING_BATCH_SIZE,
  type OpenAIEmbeddingVector,
} from "../_shared/openaiEmbeddings.ts";

const BLOOM_UPLOADS_BUCKET = "bloom-uploads";
const CORS_OPTIONS = { allowMethods: "POST, OPTIONS" };
const CHUNK_TARGET_TOKENS = 500;
const CHUNK_OVERLAP_TOKENS = 50;
const MAX_CHUNKS_PER_DOCUMENT = 1_000;

type DocumentFileType = "pdf" | "txt" | "docx";

type EnvConfig = {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  openAiApiKey: string;
};

type IngestRequest = {
  documentId: string;
  tenantId: string;
  storagePath: string | null;
  fileType: DocumentFileType | null;
};

type PublicUserRow = {
  tenant_id: string | null;
};

type KnowledgeDocumentRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  source_file: string;
  file_type: DocumentFileType;
  status: string;
};

type TextExtractionResult = {
  text: string;
  metadata: Record<string, string | number | null>;
};

type TextToken = {
  text: string;
  tokenStart: number;
  tokenEnd: number;
};

type KnowledgeChunk = {
  chunkIndex: number;
  content: string;
  tokenStart: number;
  tokenEnd: number;
};

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

function readEnvConfig(): EnvConfig | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !openAiApiKey) {
    return null;
  }

  return { supabaseUrl, anonKey, serviceRoleKey, openAiApiKey };
}

function normalizeFileType(value: unknown): DocumentFileType | null {
  const normalized = readString(value)?.toLowerCase();
  switch (normalized) {
    case "pdf":
    case "application/pdf":
      return "pdf";
    case "txt":
    case "text":
    case "text/plain":
      return "txt";
    case "docx":
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    default:
      return null;
  }
}

function parseRequestBody(value: unknown): IngestRequest {
  if (!isRecord(value)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const documentId =
    readString(value.document_id) ?? readString(value.documentId);
  const tenantId = readString(value.tenant_id) ?? readString(value.tenantId);
  if (!documentId || !tenantId) {
    throw new HttpError(400, "document_id and tenant_id are required.");
  }

  return {
    documentId,
    tenantId,
    storagePath:
      readString(value.storage_path) ?? readString(value.storagePath) ?? null,
    fileType: normalizeFileType(value.file_type ?? value.fileType),
  };
}

function parsePublicUserRow(value: unknown): PublicUserRow | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    tenant_id: typeof value.tenant_id === "string" ? value.tenant_id : null,
  };
}

function parseKnowledgeDocumentRow(
  value: unknown,
): KnowledgeDocumentRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  const tenantId = readString(value.tenant_id);
  const userId = readString(value.user_id);
  const title = readString(value.title);
  const sourceFile = readString(value.source_file);
  const fileType = normalizeFileType(value.file_type);
  const status = readString(value.status);

  if (
    !id ||
    !tenantId ||
    !userId ||
    !title ||
    !sourceFile ||
    !fileType ||
    !status
  ) {
    return null;
  }

  return {
    id,
    tenant_id: tenantId,
    user_id: userId,
    title,
    source_file: sourceFile,
    file_type: fileType,
    status,
  };
}

async function authenticateRequest(
  req: Request,
  envConfig: EnvConfig,
): Promise<{ userId: string; client: SupabaseClient }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HttpError(401, "Authentication required.");
  }

  const client = createClient(envConfig.supabaseUrl, envConfig.anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new HttpError(401, "Invalid session.");
  }

  return { userId: user.id, client };
}

async function resolveTenantMembership(args: {
  serviceClient: SupabaseClient;
  userId: string;
  tenantId: string;
}): Promise<void> {
  const { data, error } = await args.serviceClient
    .from("users")
    .select("tenant_id")
    .eq("id", args.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve tenant membership: ${error.message}`);
  }

  const userRow = parsePublicUserRow(data);
  if (!userRow || userRow.tenant_id !== args.tenantId) {
    throw new HttpError(403, "Tenant membership required.");
  }
}

async function loadKnowledgeDocument(args: {
  serviceClient: SupabaseClient;
  documentId: string;
}): Promise<KnowledgeDocumentRow> {
  const { data, error } = await args.serviceClient
    .from("bloom_knowledge_documents")
    .select("id, tenant_id, user_id, title, source_file, file_type, status")
    .eq("id", args.documentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load knowledge document: ${error.message}`);
  }

  const document = parseKnowledgeDocumentRow(data);
  if (!document) {
    throw new HttpError(404, "Knowledge document not found.");
  }

  return document;
}

function validateDocumentRequest(
  request: IngestRequest,
  document: KnowledgeDocumentRow,
): { storagePath: string; fileType: DocumentFileType } {
  if (document.tenant_id !== request.tenantId) {
    throw new HttpError(403, "Document tenant mismatch.");
  }

  const storagePath = request.storagePath ?? document.source_file;
  if (storagePath !== document.source_file) {
    throw new HttpError(
      400,
      "storage_path does not match the document record.",
    );
  }

  const fileType = request.fileType ?? document.file_type;
  if (fileType !== document.file_type) {
    throw new HttpError(400, "file_type does not match the document record.");
  }

  const expectedPrefix = `${document.tenant_id}/knowledge/${document.id}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    throw new HttpError(400, "Knowledge document storage path is invalid.");
  }

  return { storagePath, fileType };
}

async function updateDocumentStatus(args: {
  serviceClient: SupabaseClient;
  documentId: string;
  status: "uploading" | "processing" | "ready" | "failed";
  progress: number;
  content?: string | null;
  chunkCount?: number;
  errorMessage?: string | null;
  metadata?: Record<string, string | number | null>;
  processedAt?: string | null;
}): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    status: args.status,
    processing_progress: args.progress,
  };

  if (args.content !== undefined) {
    updatePayload.content = args.content;
  }
  if (args.chunkCount !== undefined) {
    updatePayload.chunk_count = args.chunkCount;
  }
  if (args.errorMessage !== undefined) {
    updatePayload.error_message = args.errorMessage;
  }
  if (args.metadata !== undefined) {
    updatePayload.metadata = args.metadata;
  }
  if (args.processedAt !== undefined) {
    updatePayload.processed_at = args.processedAt;
  }

  const { error } = await args.serviceClient
    .from("bloom_knowledge_documents")
    .update(updatePayload)
    .eq("id", args.documentId);

  if (error) {
    throw new Error(`Failed to update knowledge document: ${error.message}`);
  }
}

async function downloadDocumentBytes(
  serviceClient: SupabaseClient,
  storagePath: string,
): Promise<Uint8Array> {
  const { data, error } = await serviceClient.storage
    .from(BLOOM_UPLOADS_BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw new Error(
      `Failed to download knowledge document: ${error?.message ?? "not found"}`,
    );
  }

  return new Uint8Array(await data.arrayBuffer());
}

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function decodePdfLiteralString(value: string): string {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== "\\") {
      output += character;
      continue;
    }

    const next = value[index + 1];
    if (!next) {
      continue;
    }

    switch (next) {
      case "n":
        output += "\n";
        index += 1;
        break;
      case "r":
        output += "\r";
        index += 1;
        break;
      case "t":
        output += "\t";
        index += 1;
        break;
      case "b":
      case "f":
        index += 1;
        break;
      case "(":
      case ")":
      case "\\":
        output += next;
        index += 1;
        break;
      default: {
        const octal = value.slice(index + 1).match(/^[0-7]{1,3}/)?.[0];
        if (octal) {
          output += String.fromCharCode(Number.parseInt(octal, 8));
          index += octal.length;
        } else {
          output += next;
          index += 1;
        }
      }
    }
  }

  return output;
}

function extractPdfText(bytes: Uint8Array): TextExtractionResult {
  const raw = new TextDecoder("latin1", { fatal: false }).decode(bytes);
  const pageCount = Math.max(1, raw.match(/\/Type\s*\/Page\b/g)?.length ?? 1);
  const textChunks: string[] = [];
  const literalPattern = /\((?:\\.|[^\\)]){2,}\)\s*T[jJ]/g;
  const looseLiteralPattern = /\((?:\\.|[^\\)]){4,}\)/g;

  for (const match of raw.matchAll(literalPattern)) {
    const literal = match[0].replace(/\)\s*T[jJ]$/, "").slice(1);
    const decoded = decodePdfLiteralString(literal).replace(/\s+/g, " ").trim();
    if (decoded) {
      textChunks.push(decoded);
    }
  }

  if (textChunks.length === 0) {
    for (const match of raw.matchAll(looseLiteralPattern)) {
      const literal = match[0].slice(1, -1);
      const decoded = decodePdfLiteralString(literal)
        .replace(/\s+/g, " ")
        .trim();
      if (/^[\p{L}\p{N}\p{P}\p{Zs}]{4,}$/u.test(decoded)) {
        textChunks.push(decoded);
      }
    }
  }

  return {
    text: normalizeExtractedText(textChunks.join(" ")),
    metadata: { page_count: pageCount },
  };
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] + bytes[offset + 1] * 256;
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] +
    bytes[offset + 1] * 256 +
    bytes[offset + 2] * 65_536 +
    bytes[offset + 3] * 16_777_216
  );
}

function readAscii(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) {
    value += String.fromCharCode(byte);
  }
  return value;
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const minimumOffset = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (readUint32LE(bytes, offset) === 0x06054b50) {
      return offset;
    }
  }
  throw new Error("DOCX archive did not include a central directory.");
}

function parseZipEntries(bytes: Uint8Array): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(bytes);
  const entryCount = readUint16LE(bytes, eocdOffset + 10);
  let offset = readUint32LE(bytes, eocdOffset + 16);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > bytes.length ||
      readUint32LE(bytes, offset) !== 0x02014b50
    ) {
      break;
    }

    const compressionMethod = readUint16LE(bytes, offset + 10);
    const compressedSize = readUint32LE(bytes, offset + 20);
    const filenameLength = readUint16LE(bytes, offset + 28);
    const extraLength = readUint16LE(bytes, offset + 30);
    const commentLength = readUint16LE(bytes, offset + 32);
    const localHeaderOffset = readUint32LE(bytes, offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + filenameLength;

    if (nameEnd > bytes.length) {
      break;
    }

    entries.push({
      name: readAscii(bytes.subarray(nameStart, nameEnd)),
      compressionMethod,
      compressedSize,
      localHeaderOffset,
    });

    offset = nameEnd + extraLength + commentLength;
  }

  return entries;
}

function entryData(bytes: Uint8Array, entry: ZipEntry): Uint8Array {
  const offset = entry.localHeaderOffset;
  if (
    offset + 30 > bytes.length ||
    readUint32LE(bytes, offset) !== 0x04034b50
  ) {
    throw new Error(`DOCX entry ${entry.name} had an invalid local header.`);
  }

  const filenameLength = readUint16LE(bytes, offset + 26);
  const extraLength = readUint16LE(bytes, offset + 28);
  const dataStart = offset + 30 + filenameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > bytes.length) {
    throw new Error(`DOCX entry ${entry.name} exceeded archive bounds.`);
  }

  return bytes.subarray(dataStart, dataEnd);
}

async function decompressZipEntry(
  bytes: Uint8Array,
  entry: ZipEntry,
): Promise<Uint8Array> {
  const data = entryData(bytes, entry);
  if (entry.compressionMethod === 0) {
    return data;
  }
  if (entry.compressionMethod !== 8) {
    throw new Error(
      `Unsupported DOCX compression method ${entry.compressionMethod}.`,
    );
  }

  const stream = new Blob([data])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function decodeXmlEntity(entity: string): string {
  switch (entity) {
    case "amp":
      return "&";
    case "lt":
      return "<";
    case "gt":
      return ">";
    case "quot":
      return '"';
    case "apos":
      return "'";
    default:
      if (entity.startsWith("#x")) {
        const codePoint = Number.parseInt(entity.slice(2), 16);
        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : "";
      }
      if (entity.startsWith("#")) {
        const codePoint = Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : "";
      }
      return "";
  }
}

function decodeXmlText(value: string): string {
  return value.replace(/&([^;]+);/g, (_match, entity: string) =>
    decodeXmlEntity(entity),
  );
}

function extractDocxXmlText(xml: string): string {
  const paragraphs: string[] = [];
  const paragraphPattern = /<w:p[\s\S]*?<\/w:p>/g;
  const textPattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;

  for (const paragraphMatch of xml.matchAll(paragraphPattern)) {
    const paragraphXml = paragraphMatch[0]
      .replace(/<w:tab[^>]*\/>/g, " ")
      .replace(/<w:br[^>]*\/>/g, "\n");
    const text = [...paragraphXml.matchAll(textPattern)]
      .map((match) => decodeXmlText(match[1]))
      .join("")
      .replace(/[ \t]+/g, " ")
      .trim();
    if (text) {
      paragraphs.push(text);
    }
  }

  return paragraphs.join("\n");
}

async function extractDocxText(
  bytes: Uint8Array,
): Promise<TextExtractionResult> {
  const entries = parseZipEntries(bytes)
    .filter(
      (entry) =>
        entry.name === "word/document.xml" ||
        /^word\/(header|footer|footnotes|endnotes)\d*\.xml$/.test(entry.name),
    )
    .sort((left, right) => {
      if (left.name === "word/document.xml") {
        return -1;
      }
      if (right.name === "word/document.xml") {
        return 1;
      }
      return left.name.localeCompare(right.name);
    });

  if (entries.length === 0) {
    throw new Error("DOCX archive did not contain document text.");
  }

  const sections: string[] = [];
  for (const entry of entries) {
    const decompressed = await decompressZipEntry(bytes, entry);
    const text = extractDocxXmlText(decodeText(decompressed));
    if (text) {
      sections.push(text);
    }
  }

  return {
    text: normalizeExtractedText(sections.join("\n\n")),
    metadata: { docx_xml_files: entries.length },
  };
}

async function extractTextByType(
  bytes: Uint8Array,
  fileType: DocumentFileType,
): Promise<TextExtractionResult> {
  if (fileType === "txt") {
    return {
      text: normalizeExtractedText(decodeText(bytes)),
      metadata: { page_count: 1 },
    };
  }

  if (fileType === "pdf") {
    return extractPdfText(bytes);
  }

  return extractDocxText(bytes);
}

function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function tokenizeText(text: string): TextToken[] {
  const parts = text.match(/\S+/g) ?? [];
  let cursor = 0;
  return parts.map((part) => {
    const tokenCount = estimateTokenCount(part);
    const token: TextToken = {
      text: part,
      tokenStart: cursor,
      tokenEnd: cursor + tokenCount,
    };
    cursor += tokenCount;
    return token;
  });
}

function chunkText(text: string): KnowledgeChunk[] {
  const tokens = tokenizeText(text);
  const chunks: KnowledgeChunk[] = [];
  let startIndex = 0;

  while (startIndex < tokens.length) {
    let endIndex = startIndex;
    let chunkTokens = 0;

    while (endIndex < tokens.length) {
      const nextTokenCount =
        tokens[endIndex].tokenEnd - tokens[endIndex].tokenStart;
      if (
        chunkTokens > 0 &&
        chunkTokens + nextTokenCount > CHUNK_TARGET_TOKENS
      ) {
        break;
      }
      chunkTokens += nextTokenCount;
      endIndex += 1;
    }

    const chunkTokensSlice = tokens.slice(startIndex, endIndex);
    if (chunkTokensSlice.length === 0) {
      break;
    }

    chunks.push({
      chunkIndex: chunks.length,
      content: chunkTokensSlice.map((token) => token.text).join(" "),
      tokenStart: chunkTokensSlice[0].tokenStart,
      tokenEnd: chunkTokensSlice[chunkTokensSlice.length - 1].tokenEnd,
    });

    if (chunks.length > MAX_CHUNKS_PER_DOCUMENT) {
      throw new Error(
        "Document is too large to process into knowledge chunks.",
      );
    }

    if (endIndex >= tokens.length) {
      break;
    }

    let overlapTokens = 0;
    let overlapIndex = endIndex;
    while (overlapIndex > startIndex && overlapTokens < CHUNK_OVERLAP_TOKENS) {
      overlapIndex -= 1;
      overlapTokens +=
        tokens[overlapIndex].tokenEnd - tokens[overlapIndex].tokenStart;
    }

    startIndex = Math.max(overlapIndex, startIndex + 1);
  }

  return chunks;
}

async function replaceDocumentChunks(args: {
  serviceClient: SupabaseClient;
  document: KnowledgeDocumentRow;
  chunks: KnowledgeChunk[];
  embeddings: OpenAIEmbeddingVector[];
}): Promise<void> {
  const { error: deleteError } = await args.serviceClient
    .from("bloom_knowledge_chunks")
    .delete()
    .eq("document_id", args.document.id)
    .eq("tenant_id", args.document.tenant_id);

  if (deleteError) {
    throw new Error(
      `Failed to clear old knowledge chunks: ${deleteError.message}`,
    );
  }

  for (
    let index = 0;
    index < args.chunks.length;
    index += OPENAI_EMBEDDING_BATCH_SIZE
  ) {
    const chunkBatch = args.chunks.slice(
      index,
      index + OPENAI_EMBEDDING_BATCH_SIZE,
    );
    const rows = chunkBatch.map((chunk, batchIndex) => ({
      document_id: args.document.id,
      tenant_id: args.document.tenant_id,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      embedding: args.embeddings[index + batchIndex],
      metadata: {
        token_start: chunk.tokenStart,
        token_end: chunk.tokenEnd,
        source_file: args.document.source_file,
        file_type: args.document.file_type,
      },
    }));

    const { error: insertError } = await args.serviceClient
      .from("bloom_knowledge_chunks")
      .insert(rows);

    if (insertError) {
      throw new Error(
        `Failed to insert knowledge chunks: ${insertError.message}`,
      );
    }
  }
}

async function ingestKnowledgeDocument(args: {
  serviceClient: SupabaseClient;
  document: KnowledgeDocumentRow;
  storagePath: string;
  fileType: DocumentFileType;
  openAiApiKey: string;
}): Promise<{
  chunkCount: number;
  metadata: Record<string, string | number | null>;
}> {
  await updateDocumentStatus({
    serviceClient: args.serviceClient,
    documentId: args.document.id,
    status: "processing",
    progress: 10,
    errorMessage: null,
  });

  const bytes = await downloadDocumentBytes(
    args.serviceClient,
    args.storagePath,
  );
  const extraction = await extractTextByType(bytes, args.fileType);
  if (!extraction.text) {
    throw new Error("No readable text could be extracted from the document.");
  }

  const chunks = chunkText(extraction.text);
  if (chunks.length === 0) {
    throw new Error("No knowledge chunks could be created from the document.");
  }

  await updateDocumentStatus({
    serviceClient: args.serviceClient,
    documentId: args.document.id,
    status: "processing",
    progress: 45,
  });

  const embeddings = await createOpenAIEmbeddings({
    apiKey: args.openAiApiKey,
    inputs: chunks.map((chunk) => chunk.content),
    batchSize: OPENAI_EMBEDDING_BATCH_SIZE,
  });

  if (embeddings.length !== chunks.length) {
    throw new Error("Embedding count did not match chunk count.");
  }

  await replaceDocumentChunks({
    serviceClient: args.serviceClient,
    document: args.document,
    chunks,
    embeddings,
  });

  const metadata = {
    ...extraction.metadata,
    file_size_bytes: bytes.length,
    estimated_token_count: estimateTokenCount(extraction.text),
  };

  await updateDocumentStatus({
    serviceClient: args.serviceClient,
    documentId: args.document.id,
    status: "ready",
    progress: 100,
    content: extraction.text,
    chunkCount: chunks.length,
    errorMessage: null,
    metadata,
    processedAt: new Date().toISOString(),
  });

  return { chunkCount: chunks.length, metadata };
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflight(req, CORS_OPTIONS);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return corsJsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  const envConfig = readEnvConfig();
  if (!envConfig) {
    return corsJsonResponse(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const serviceClient = createClient(
    envConfig.supabaseUrl,
    envConfig.serviceRoleKey,
    { auth: { persistSession: false } },
  );
  let failureDocumentId: string | null = null;

  try {
    const requestBody: unknown = await req.json();
    const ingestRequest = parseRequestBody(requestBody);
    const { userId } = await authenticateRequest(req, envConfig);
    await resolveTenantMembership({
      serviceClient,
      userId,
      tenantId: ingestRequest.tenantId,
    });

    const document = await loadKnowledgeDocument({
      serviceClient,
      documentId: ingestRequest.documentId,
    });
    const { storagePath, fileType } = validateDocumentRequest(
      ingestRequest,
      document,
    );
    failureDocumentId = document.id;
    const result = await ingestKnowledgeDocument({
      serviceClient,
      document,
      storagePath,
      fileType,
      openAiApiKey: envConfig.openAiApiKey,
    });

    return corsJsonResponse({
      ok: true,
      document_id: document.id,
      chunk_count: result.chunkCount,
      metadata: result.metadata,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = toErrorMessage(error);
    console.error(
      "[bloom-knowledge-ingest] Failed to ingest document",
      message,
    );

    if (failureDocumentId) {
      try {
        await updateDocumentStatus({
          serviceClient,
          documentId: failureDocumentId,
          status: "failed",
          progress: 0,
          errorMessage: message,
        });
      } catch (statusError) {
        console.error(
          "[bloom-knowledge-ingest] Failed to mark document failed",
          toErrorMessage(statusError),
        );
      }
    }

    return corsJsonResponse({ ok: false, error: message }, { status });
  }
});
