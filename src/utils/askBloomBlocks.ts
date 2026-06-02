import type {
  AskBloomActionCard,
  AskBloomActionCardStatus,
  AskBloomBlock,
  AskBloomBlockType,
  BloomContentBlock,
} from "@/types/askBloom";

type UnknownRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const readString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const toDataRecord = (value: unknown): Record<string, unknown> => {
  if (isRecord(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return { items: value };
  }

  if (value === null || value === undefined) {
    return {};
  }

  return { value };
};

const KNOWN_ASK_BLOOM_BLOCK_TYPES: readonly AskBloomBlockType[] = [
  "text",
  "thinking",
  "data_card",
  "content",
  "interaction",
  "stat_card",
  "insight",
  "insight_card",
  "confirmation",
  "navigation",
  "data_table",
  "task_plan",
  "code",
  "research_progress",
  "chart",
  "image",
  "tool_result",
  "mutation_action",
  "suggestion_chips",
];

export const toAskBloomBlockType = (value: unknown): AskBloomBlockType => {
  const normalized = readString(value).toLowerCase().replace(/-/g, "_");

  // Legacy alias: Bloom emits `action_card`, Ask Bloom models it as a mutation.
  if (normalized === "action_card") {
    return "mutation_action";
  }

  // Direct pass-through for all known types — preserve block identity.
  if ((KNOWN_ASK_BLOOM_BLOCK_TYPES as readonly string[]).includes(normalized)) {
    return normalized as AskBloomBlockType;
  }

  // Fallback: preserve unknown/future types as a data card so they still persist.
  return "data_card";
};

/**
 * Converts a Bloom content block (the source-of-truth union produced by
 * `parseContentBlocks`) into an Ask Bloom block, preserving the original block
 * for direct renderer pass-through in later milestones.
 */
export const bloomContentBlockToAskBloomBlock = (
  bloomBlock: BloomContentBlock,
  index: number,
): AskBloomBlock => {
  const id = bloomBlock.id || `block-${index}-${Date.now()}`;

  switch (bloomBlock.type) {
    case "text":
    case "thinking":
      return {
        type: bloomBlock.type,
        content: bloomBlock.content,
        data: {},
        id,
        bloomContentBlock: bloomBlock,
      };
    case "error":
      return {
        type: "text",
        content: bloomBlock.message,
        data: {},
        id,
        bloomContentBlock: bloomBlock,
      };
    case "tool_result": {
      const data = toDataRecord(bloomBlock.data);
      const status: "success" | "error" =
        bloomBlock.status === "error" || bloomBlock.status === "failed"
          ? "error"
          : "success";
      return {
        type: "tool_result",
        content: bloomBlock.message ?? "",
        data,
        id,
        bloomContentBlock: bloomBlock,
        toolResult: {
          toolName: bloomBlock.toolName ?? "",
          blockType: bloomBlock.blockType,
          data,
          status,
          message: bloomBlock.message,
          error: bloomBlock.error,
          count: bloomBlock.count,
        },
      };
    }
    case "block":
      return {
        type: toAskBloomBlockType(bloomBlock.blockType),
        content: "",
        data: toDataRecord(bloomBlock.payload),
        id,
        bloomContentBlock: bloomBlock,
      };
  }
};

const toActionCardStatus = (value: unknown): AskBloomActionCardStatus => {
  switch (readString(value).toLowerCase()) {
    case "confirmed":
      return "confirmed";
    case "executing":
      return "executing";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "pending":
    default:
      return "pending";
  }
};

export const toAskBloomActionCard = (
  value: unknown,
): AskBloomActionCard | null => {
  if (!isRecord(value)) {
    return null;
  }

  const mutationId =
    readString(value.mutationId) || readString(value.mutation_id);
  const toolName = readString(value.toolName) || readString(value.tool_name);
  const description = readString(value.description);

  if (!mutationId || !toolName || !description) {
    return null;
  }

  const toolArgs = toDataRecord(
    value.toolArgs ?? value.tool_args ?? value.arguments ?? value.params,
  );
  const status = toActionCardStatus(value.status);
  const result = readString(value.result) || null;

  return {
    type: "mutation_action",
    mutationId,
    toolName,
    toolArgs,
    description,
    status,
    result,
    content: description,
    data: {
      mutationId,
      toolName,
      toolArgs,
      description,
      status,
      result,
    },
  };
};

export const serializeAskBloomBlock = (
  block: AskBloomBlock,
): Record<string, unknown> => {
  if (block.type === "mutation_action") {
    return {
      block_type: block.type,
      content: block.description,
      payload: {
        mutationId: block.mutationId,
        toolName: block.toolName,
        toolArgs: block.toolArgs,
        description: block.description,
        status: block.status,
        result: block.result,
      },
    };
  }

  if (block.type === "suggestion_chips") {
    return {
      block_type: block.type,
      content: block.content,
      payload: {
        suggestions: block.data.suggestions,
      },
    };
  }

  if (block.type === "tool_result" && block.toolResult) {
    // Keep the persisted payload self-describing so `parseContentBlocks` and the
    // Ask Bloom re-hydration path can reconstruct the tool result later.
    return {
      block_type: block.type,
      content: block.content,
      payload: {
        ...block.data,
        tool_name: block.toolResult.toolName,
        block_type: block.toolResult.blockType,
        status: block.toolResult.status,
        message: block.toolResult.message,
        error: block.toolResult.error,
        count: block.toolResult.count,
      },
    };
  }

  return {
    block_type: block.type,
    content: block.content,
    payload: block.data,
  };
};
