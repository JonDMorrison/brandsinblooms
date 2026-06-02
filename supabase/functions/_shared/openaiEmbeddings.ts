export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const OPENAI_EMBEDDING_DIMENSIONS = 1536;
export const OPENAI_EMBEDDING_BATCH_SIZE = 100;

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

export type OpenAIEmbeddingVector = number[];

type OpenAIEmbeddingItem = {
  index: number;
  embedding: OpenAIEmbeddingVector;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEmbeddingItem(value: unknown): OpenAIEmbeddingItem | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.index !== "number" || !Number.isInteger(value.index)) {
    return null;
  }

  if (!Array.isArray(value.embedding)) {
    return null;
  }

  const embedding = value.embedding.filter(
    (dimension): dimension is number =>
      typeof dimension === "number" && Number.isFinite(dimension),
  );

  if (embedding.length !== OPENAI_EMBEDDING_DIMENSIONS) {
    return null;
  }

  return { index: value.index, embedding };
}

function parseEmbeddingResponse(
  payload: unknown,
  expectedCount: number,
): OpenAIEmbeddingVector[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error("OpenAI embeddings response did not include data.");
  }

  const orderedEmbeddings: Array<OpenAIEmbeddingVector | null> = Array.from(
    { length: expectedCount },
    () => null,
  );

  for (const rawItem of payload.data) {
    const item = parseEmbeddingItem(rawItem);
    if (!item || item.index < 0 || item.index >= expectedCount) {
      continue;
    }
    orderedEmbeddings[item.index] = item.embedding;
  }

  if (orderedEmbeddings.some((embedding) => embedding === null)) {
    throw new Error(
      "OpenAI embeddings response was missing one or more embeddings.",
    );
  }

  return orderedEmbeddings.filter(
    (embedding): embedding is OpenAIEmbeddingVector => embedding !== null,
  );
}

export async function createOpenAIEmbeddings(args: {
  apiKey: string;
  inputs: string[];
  batchSize?: number;
}): Promise<OpenAIEmbeddingVector[]> {
  const inputs = args.inputs.map((input) => input.trim()).filter(Boolean);
  if (inputs.length === 0) {
    return [];
  }

  const batchSize = Math.max(
    1,
    Math.min(
      args.batchSize ?? OPENAI_EMBEDDING_BATCH_SIZE,
      OPENAI_EMBEDDING_BATCH_SIZE,
    ),
  );
  const embeddings: OpenAIEmbeddingVector[] = [];

  for (let index = 0; index < inputs.length; index += batchSize) {
    const batch = inputs.slice(index, index + batchSize);
    const response = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_EMBEDDING_MODEL,
        input: batch,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI embeddings request failed (${response.status}): ${await response.text()}`,
      );
    }

    const payload: unknown = await response.json();
    embeddings.push(...parseEmbeddingResponse(payload, batch.length));
  }

  return embeddings;
}
