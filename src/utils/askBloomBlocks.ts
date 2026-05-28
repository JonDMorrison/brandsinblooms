import type {
  AskBloomActionCard,
  AskBloomActionCardStatus,
  AskBloomBlock,
  AskBloomBlockType,
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

export const toAskBloomBlockType = (value: unknown): AskBloomBlockType => {
  const normalized = readString(value).toLowerCase().replace(/-/g, "_");
  switch (normalized) {
    case "text":
      return "text";
    case "action_card":
    case "mutation_action":
      return "mutation_action";
    case "insight_card":
      return "insight_card";
    case "suggestion_chips":
      return "suggestion_chips";
    case "data_card":
    default:
      return "data_card";
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

  return {
    block_type: block.type,
    content: block.content,
    payload: block.data,
  };
};
