import {
  createOpenAIEmbeddings,
  type OpenAIEmbeddingVector,
} from "../../../_shared/openaiEmbeddings.ts";
import type { JsonArray, JsonObject, JsonValue } from "../../types.ts";
import type {
  ToolExecutionContext,
  ToolImplementation,
  ToolResult,
} from "../types.ts";

const KNOWLEDGE_MATCH_LIMIT = 5;
const KNOWLEDGE_MIN_SIMILARITY = 0;

type KnowledgeMatch = {
  chunkId: string;
  documentId: string;
  tenantId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  metadata: JsonObject;
  similarity: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }

  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return typeof value !== "number" || Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function jsonObjectOrEmpty(value: unknown): JsonObject {
  return isRecord(value) && Object.values(value).every(isJsonValue)
    ? value
    : {};
}

function createResult(args: {
  success: boolean;
  data?: JsonValue | null;
  count?: number | null;
  message: string;
  error?: string | null;
}): ToolResult {
  return {
    success: args.success,
    data: args.data ?? null,
    count: args.count ?? null,
    message: args.message,
    error: args.error ?? null,
    block_type: "text",
    confirmation_required: false,
    confirmation_details: null,
  };
}

function parseKnowledgeMatch(value: unknown): KnowledgeMatch | null {
  if (!isRecord(value)) {
    return null;
  }

  const chunkId = readString(value.chunk_id);
  const documentId = readString(value.document_id);
  const tenantId = readString(value.tenant_id);
  const documentTitle = readString(value.document_title);
  const chunkIndex = readNumber(value.chunk_index);
  const content = readString(value.content);
  const similarity = readNumber(value.similarity);

  if (
    !chunkId ||
    !documentId ||
    !tenantId ||
    !documentTitle ||
    chunkIndex === null ||
    !content ||
    similarity === null
  ) {
    return null;
  }

  return {
    chunkId,
    documentId,
    tenantId,
    documentTitle,
    chunkIndex,
    content,
    metadata: jsonObjectOrEmpty(value.metadata),
    similarity,
  };
}

function toToolData(matches: KnowledgeMatch[]): JsonArray {
  return matches.map((match) => ({
    chunk_id: match.chunkId,
    document_id: match.documentId,
    tenant_id: match.tenantId,
    document_title: match.documentTitle,
    chunk_index: match.chunkIndex,
    similarity: Math.round(match.similarity * 10_000) / 10_000,
    content: match.content,
    metadata: match.metadata,
  }));
}

function knowledgeContextMessage(
  query: string,
  matches: KnowledgeMatch[],
): string {
  if (matches.length === 0) {
    return `No ready knowledge base content matched: ${query}`;
  }

  const sections = matches.map((match, index) => {
    const score = Math.round(match.similarity * 10_000) / 10_000;
    return [
      `Result ${index + 1}: ${match.documentTitle}`,
      `Similarity: ${score}`,
      `Chunk: ${match.chunkIndex}`,
      match.content,
    ].join("\n");
  });

  return [`Relevant knowledge base content for: ${query}`, ...sections].join(
    "\n\n---\n\n",
  );
}

async function searchKnowledgeRows(args: {
  context: ToolExecutionContext;
  embedding: OpenAIEmbeddingVector;
}): Promise<KnowledgeMatch[]> {
  const client = args.context.dataClient ?? args.context.serviceClient;
  const { data, error } = await client.rpc("match_bloom_knowledge_chunks", {
    p_tenant_id: args.context.tenantId,
    p_query_embedding: args.embedding,
    p_match_count: KNOWLEDGE_MATCH_LIMIT,
    p_min_similarity: KNOWLEDGE_MIN_SIMILARITY,
  });

  if (error) {
    throw new Error(`Failed to search Bloom knowledge: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows
    .map(parseKnowledgeMatch)
    .filter((match): match is KnowledgeMatch => Boolean(match))
    .slice(0, KNOWLEDGE_MATCH_LIMIT);
}

export const searchKnowledge: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
) => {
  const query = readString(params.query);
  if (!query) {
    return createResult({
      success: false,
      message: "A knowledge search query is required.",
      error: "validation_error",
      count: 0,
    });
  }

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    return createResult({
      success: false,
      message:
        "Knowledge search is unavailable because embeddings are not configured.",
      error: "missing_openai_api_key",
      count: 0,
    });
  }

  const [embedding] = await createOpenAIEmbeddings({
    apiKey: openAiApiKey,
    inputs: [query],
  });
  if (!embedding) {
    return createResult({
      success: false,
      message: "Knowledge search could not create a query embedding.",
      error: "embedding_error",
      count: 0,
    });
  }

  const matches = await searchKnowledgeRows({ context, embedding });
  return createResult({
    success: true,
    data: toToolData(matches),
    count: matches.length,
    message: knowledgeContextMessage(query, matches),
  });
};
