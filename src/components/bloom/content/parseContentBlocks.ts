import { normalizeBloomBlockItems } from "@/components/bloom/blocks/blockUtils";
import type { BloomBlockItem } from "@/components/bloom/blocks/blockTypes";
import type { BloomMessage, BloomToolExecution } from "@/hooks/bloom/types";

export type BloomContentBlock =
  | { type: "text"; id: string; content: string }
  | { type: "thinking"; id: string; content: string }
  | {
      type: "tool_result";
      id: string;
      toolName: string | null;
      blockType: string | null;
      data: unknown;
      status:
        | "success"
        | "error"
        | "pending"
        | "executing"
        | "completed"
        | "failed"
        | null;
      message: string | null;
      error: string | null;
      count: number | null;
    }
  | { type: "error"; id: string; message: string; code?: string | null }
  | { type: "block"; id: string; blockType: string; payload: unknown };

interface StreamingBlockLike {
  id: string;
  toolName: string | null;
  blockType: string;
  payload: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toolOutputBlockType(value: unknown) {
  return isRecord(value)
    ? (readString(value.block_type) ?? readString(value.blockType))
    : null;
}

function toolOutputCount(value: unknown) {
  return isRecord(value) ? readNumber(value.count) : null;
}

function toolOutputMessage(value: unknown) {
  return isRecord(value) ? readString(value.message) : null;
}

function toolOutputError(value: unknown) {
  return isRecord(value) ? readString(value.error) : null;
}

function shouldSkipToolExecution(execution: BloomToolExecution) {
  const toolName = execution.toolName.toLowerCase();
  if (toolName === "generate_image") {
    return true;
  }

  return (
    isRecord(execution.toolOutput) &&
    execution.toolOutput.confirmation_required === true
  );
}

function blockItemToContentBlock(
  block: BloomBlockItem,
  fallbackIndex: number,
): BloomContentBlock {
  if (block.text) {
    return {
      type: "text",
      id: `${block.id}-text-${fallbackIndex}`,
      content: block.text,
    };
  }

  const normalizedBlockType = block.blockType.trim().toLowerCase();
  if (normalizedBlockType === "error") {
    const message = isRecord(block.payload)
      ? (readString(block.payload.message) ?? readString(block.payload.error))
      : null;
    return {
      type: "error",
      id: block.id,
      message: message ?? "Bloom could not render this result.",
    };
  }

  if (["data_card", "data_table", "stat_card"].includes(normalizedBlockType)) {
    return {
      type: "tool_result",
      id: block.id,
      toolName: isRecord(block.payload)
        ? (readString(block.payload.tool_name) ??
          readString(block.payload.toolName))
        : null,
      blockType: normalizedBlockType,
      data: block.payload,
      status: "success",
      message: isRecord(block.payload)
        ? readString(block.payload.message)
        : null,
      error: null,
      count: isRecord(block.payload) ? readNumber(block.payload.count) : null,
    };
  }

  if (normalizedBlockType === "text") {
    const text = isRecord(block.payload)
      ? (readString(block.payload.text) ??
        readString(block.payload.content) ??
        readString(block.payload.markdown))
      : readString(block.payload);
    if (text) {
      return { type: "text", id: block.id, content: text };
    }
  }

  if (normalizedBlockType === "thinking") {
    const content = isRecord(block.payload)
      ? (readString(block.payload.content) ?? readString(block.payload.text))
      : readString(block.payload);
    if (content) {
      return { type: "thinking", id: block.id, content };
    }
  }

  return {
    type: "block",
    id: block.id,
    blockType: block.blockType,
    payload: block.payload,
  };
}

function toolExecutionToContentBlock(
  execution: BloomToolExecution,
): BloomContentBlock {
  return {
    type: "tool_result",
    id: `tool-${execution.id}`,
    toolName: execution.toolName,
    blockType: toolOutputBlockType(execution.toolOutput),
    data: execution.toolOutput ?? {
      message:
        execution.errorMessage ?? "Tool execution did not return a payload.",
      error: execution.errorMessage,
    },
    status: execution.status,
    message: toolOutputMessage(execution.toolOutput),
    error: execution.errorMessage ?? toolOutputError(execution.toolOutput),
    count: toolOutputCount(execution.toolOutput),
  };
}

export function contentBlockFromStreamingBlock(
  block: StreamingBlockLike,
): BloomContentBlock {
  const normalizedBlockType = block.blockType.trim().toLowerCase();
  if (["data_card", "data_table", "stat_card"].includes(normalizedBlockType)) {
    return {
      type: "tool_result",
      id: block.id,
      toolName: block.toolName,
      blockType: normalizedBlockType,
      data: block.payload,
      status: "success",
      message: toolOutputMessage(block.payload),
      error: toolOutputError(block.payload),
      count: toolOutputCount(block.payload),
    };
  }

  if (normalizedBlockType === "error") {
    return {
      type: "error",
      id: block.id,
      message:
        toolOutputError(block.payload) ??
        toolOutputMessage(block.payload) ??
        "Bloom could not render this result.",
    };
  }

  return {
    type: "block",
    id: block.id,
    blockType: block.blockType,
    payload: block.payload,
  };
}

function pushTextBlock(
  blocks: BloomContentBlock[],
  id: string,
  content: string,
) {
  if (!content.trim()) {
    return;
  }

  blocks.push({ type: "text", id, content });
}

export function parseContentBlocks(message: BloomMessage): BloomContentBlock[] {
  const blocks: BloomContentBlock[] = [];
  const thinkingContent = message.thinkingContent?.trim();
  if (thinkingContent) {
    blocks.push({
      type: "thinking",
      id: `${message.id}-thinking`,
      content: thinkingContent,
    });
  }

  const blockItems = normalizeBloomBlockItems(message.blockData);
  const blockDataContainsTextSections = blockItems.some(
    (block) => block.text !== null,
  );
  const positionedBlockItems = blockItems
    .filter((block) => block.text === null && block.position !== null)
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));

  if (
    blockItems.length === 0 ||
    (!blockDataContainsTextSections && positionedBlockItems.length === 0)
  ) {
    pushTextBlock(blocks, `${message.id}-text`, message.text);
  }

  if (blockDataContainsTextSections) {
    blockItems.forEach((block, index) => {
      blocks.push(blockItemToContentBlock(block, index));
    });
  } else if (positionedBlockItems.length > 0) {
    let cursor = 0;
    positionedBlockItems.forEach((block, index) => {
      const position = Math.min(
        Math.max(block.position ?? 0, 0),
        message.text.length,
      );
      pushTextBlock(
        blocks,
        `${message.id}-text-before-${block.id}`,
        message.text.slice(cursor, position),
      );
      blocks.push(blockItemToContentBlock(block, index));
      cursor = position;
    });
    pushTextBlock(
      blocks,
      `${message.id}-text-after-blocks`,
      message.text.slice(cursor),
    );
  } else {
    blockItems.forEach((block, index) => {
      blocks.push(blockItemToContentBlock(block, index));
    });
  }

  for (const execution of message.toolExecutions ?? []) {
    if (!shouldSkipToolExecution(execution)) {
      blocks.push(toolExecutionToContentBlock(execution));
    }
  }

  if (blocks.length === 0) {
    pushTextBlock(blocks, `${message.id}-text`, message.text);
  }

  return blocks;
}
