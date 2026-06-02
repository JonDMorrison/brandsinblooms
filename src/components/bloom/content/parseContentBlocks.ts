import { normalizeBloomBlockItems } from "@/components/bloom/blocks/blockUtils";
import { stripEchoedToolPayloads } from "@/components/bloom/content/sanitizeBloomContent";
import {
  analyzeStreamingContent,
  extractPreFormText,
} from "@/components/bloom/utils/contentGate";
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
  if (
    ["data_card", "data_table", "stat_card", "tool_result"].includes(
      normalizedBlockType,
    )
  ) {
    return {
      type: "tool_result",
      id: block.id,
      toolName: block.toolName,
      blockType:
        normalizedBlockType === "tool_result" ? null : normalizedBlockType,
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

/** Identifier fields the structured result cards render and the model echoes. */
const IDENTIFIER_FIELDS = [
  "name",
  "full_name",
  "fullName",
  "first_name",
  "firstName",
  "last_name",
  "lastName",
  "email",
  "phone",
  "phone_number",
  "phoneNumber",
  "title",
  "subject",
  "sku",
  "order_number",
  "orderNumber",
] as const;

/**
 * Recursively collects entity identifiers (names, emails, titles, SKUs, order
 * numbers, ids) from a tool-result payload so we can detect when the assistant
 * text repeats the same data in a markdown table.
 */
function collectIdentifiers(value: unknown, out: Set<string>, depth: number) {
  if (depth > 6) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectIdentifiers(item, out, depth + 1);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const field of IDENTIFIER_FIELDS) {
    const fieldValue = value[field];
    if (typeof fieldValue === "string" && fieldValue.trim().length > 0) {
      out.add(fieldValue.toLowerCase().trim());
    }
  }

  const idValue = value.id;
  if (typeof idValue === "string" && idValue.trim().length > 0) {
    out.add(idValue.toLowerCase().trim());
  } else if (typeof idValue === "number") {
    out.add(String(idValue));
  }

  for (const nested of Object.values(value)) {
    if (Array.isArray(nested) || isRecord(nested)) {
      collectIdentifiers(nested, out, depth + 1);
    }
  }
}

export function extractIdentifiersFromToolResults(
  toolResultBlocks: BloomContentBlock[],
): Set<string> {
  const identifiers = new Set<string>();
  for (const block of toolResultBlocks) {
    if (block.type === "tool_result") {
      collectIdentifiers(block.data, identifiers, 0);
    }
  }
  return identifiers;
}

/** True when a single line repeats an entity already shown in a result card. */
function lineHasIdentifier(line: string, identifiers: Set<string>): boolean {
  if (identifiers.size === 0) {
    return false;
  }
  const lower = line.toLowerCase();
  for (const id of identifiers) {
    if (id.length >= 3 && lower.includes(id)) {
      return true;
    }
  }
  return false;
}

/** Pulls candidate identifiers out of the body rows of a markdown table. */
function extractIdentifiersFromTable(tableText: string): string[] {
  const identifiers: string[] = [];
  const rows = tableText
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !/^\|[\s:|-]+\|?$/.test(line));

  // Skip the header row; only inspect data rows.
  for (const row of rows.slice(1)) {
    const cells = row
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);
    for (const cell of cells) {
      if (cell.includes("@")) {
        identifiers.push(cell.toLowerCase());
      } else if (/^[A-Za-z][^|]{2,}$/.test(cell)) {
        identifiers.push(cell.toLowerCase());
      }
    }
  }

  return identifiers;
}

// A well-formed markdown table: header row, separator row, then data rows.
const MARKDOWN_TABLE_REGEX =
  /(\|[^\n]+\|[ \t]*\n\|[ \t:|-]+\|[ \t]*\n(?:\|[^\n]+\|[ \t]*(?:\n|$))*)/g;

// Standalone "pointer" intro lines that only announce the card. Removed when a
// redundant table/list is stripped so the message doesn't dangle a lone
// preamble.
const INTRO_PARAGRAPH_REGEX =
  /^(?:here(?:'s| (?:are|is))\b.*|showing\b.*|below (?:are|is)\b.*|the (?:results?|data) (?:are|is)\b.*|i (?:found|located|retrieved)\b.*(?:following|below|here)?[.:]?|these are\b.*)[.:]?$/i;

// Numbered ("1." / "1)") and bullet ("-", "*", "•") list markers.
const NUMBERED_LIST_REGEX = /^\s*\d+[.)]\s+\S/;
const BULLET_LIST_REGEX = /^\s*[-*•]\s+\S/;
// "Key: value" or "**Key:** value" lines (optionally bullet-prefixed).
const KEY_VALUE_REGEX =
  /^\s*(?:[-*•]\s*)?\*{0,2}[A-Za-z][A-Za-z0-9 _/-]{0,40}\*{0,2}\s*:\s+\S/;

/** Splits text into fenced-code and plain segments so code is never altered. */
function splitOnCodeFences(
  text: string,
): Array<{ text: string; isCode: boolean }> {
  const segments: Array<{ text: string; isCode: boolean }> = [];
  const fenceRegex = /```[\s\S]*?```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        isCode: false,
      });
    }
    segments.push({ text: match[0], isCode: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isCode: false });
  }

  return segments;
}

function stripRedundantTablesFromSegment(
  text: string,
  toolIdentifiers: Set<string>,
): { text: string; removed: boolean } {
  let removed = false;
  const cleaned = text.replace(MARKDOWN_TABLE_REGEX, (table) => {
    const tableIdentifiers = extractIdentifiersFromTable(table);
    if (tableIdentifiers.length === 0) {
      return table;
    }

    const overlap = tableIdentifiers.filter((id) =>
      toolIdentifiers.has(id),
    ).length;
    const overlapRatio = overlap / tableIdentifiers.length;

    // Only treat the table as a duplicate when most of its rows are already
    // shown in the structured card. Unrelated tables are preserved.
    if (overlapRatio > 0.5) {
      removed = true;
      return "";
    }

    return table;
  });

  return { text: cleaned, removed };
}

/**
 * Removes a contiguous run of list lines (numbered or bullet) when the items
 * mostly repeat entities already shown in a structured result card. Unrelated
 * lists (recommendations, next steps) keep low identifier overlap and survive.
 */
function stripRedundantListBlocks(
  text: string,
  toolIdentifiers: Set<string>,
  itemRegex: RegExp,
  overlapThreshold: number,
): { text: string; removed: boolean } {
  if (toolIdentifiers.size === 0) {
    return { text, removed: false };
  }

  const lines = text.split("\n");
  const out: string[] = [];
  let removed = false;
  let index = 0;

  while (index < lines.length) {
    if (!itemRegex.test(lines[index])) {
      out.push(lines[index]);
      index += 1;
      continue;
    }

    const blockStart = index;
    const itemTexts: string[] = [];
    while (index < lines.length) {
      const line = lines[index];
      if (itemRegex.test(line)) {
        itemTexts.push(line);
        index += 1;
        continue;
      }
      // Indented continuation of the previous item.
      if (line.trim() !== "" && /^\s+\S/.test(line) && itemTexts.length > 0) {
        itemTexts[itemTexts.length - 1] += ` ${line.trim()}`;
        index += 1;
        continue;
      }
      break;
    }

    if (itemTexts.length >= 2) {
      const hits = itemTexts.filter((item) =>
        lineHasIdentifier(item, toolIdentifiers),
      ).length;
      if (hits / itemTexts.length > overlapThreshold) {
        removed = true;
        continue;
      }
    }

    out.push(...lines.slice(blockStart, index));
  }

  return { text: out.join("\n"), removed };
}

/**
 * Removes contiguous "Key: value" blocks (e.g. a profile restated as text)
 * when the values mostly repeat entities already shown in a result card.
 */
function stripRedundantKeyValueBlocks(
  text: string,
  toolIdentifiers: Set<string>,
): { text: string; removed: boolean } {
  if (toolIdentifiers.size === 0) {
    return { text, removed: false };
  }

  const lines = text.split("\n");
  const out: string[] = [];
  let removed = false;
  let index = 0;

  while (index < lines.length) {
    if (!KEY_VALUE_REGEX.test(lines[index])) {
      out.push(lines[index]);
      index += 1;
      continue;
    }

    const blockStart = index;
    const kvLines: string[] = [];
    while (index < lines.length && KEY_VALUE_REGEX.test(lines[index])) {
      kvLines.push(lines[index]);
      index += 1;
    }

    if (kvLines.length >= 2) {
      const hits = kvLines.filter((line) =>
        lineHasIdentifier(line, toolIdentifiers),
      ).length;
      if (hits / kvLines.length > 0.3) {
        removed = true;
        continue;
      }
    }

    out.push(...lines.slice(blockStart, index));
  }

  return { text: out.join("\n"), removed };
}

/**
 * When a response carries structured tool-result cards AND text, the model
 * often repeats the same rows as a markdown table, numbered list, bullet list,
 * or key/value block inside the text. This pure helper removes those redundant
 * restatements (and any lone pointer intro left behind) while preserving
 * analysis, recommendations, and summary stats.
 */
export function stripRedundantContent(
  textContent: string,
  toolResultBlocks: BloomContentBlock[],
): string {
  if (!textContent.trim() || toolResultBlocks.length === 0) {
    return textContent;
  }

  const toolIdentifiers = extractIdentifiersFromToolResults(toolResultBlocks);
  if (toolIdentifiers.size === 0) {
    return textContent;
  }

  let removedAny = false;
  const cleaned = splitOnCodeFences(textContent)
    .map((segment) => {
      if (segment.isCode) {
        return segment.text;
      }
      let text = segment.text;

      const tables = stripRedundantTablesFromSegment(text, toolIdentifiers);
      text = tables.text;
      removedAny = removedAny || tables.removed;

      const numbered = stripRedundantListBlocks(
        text,
        toolIdentifiers,
        NUMBERED_LIST_REGEX,
        0.4,
      );
      text = numbered.text;
      removedAny = removedAny || numbered.removed;

      const bullets = stripRedundantListBlocks(
        text,
        toolIdentifiers,
        BULLET_LIST_REGEX,
        0.4,
      );
      text = bullets.text;
      removedAny = removedAny || bullets.removed;

      const keyValues = stripRedundantKeyValueBlocks(text, toolIdentifiers);
      text = keyValues.text;
      removedAny = removedAny || keyValues.removed;

      return text;
    })
    .join("");

  if (!removedAny) {
    return textContent;
  }

  // Drop dangling pointer-only paragraphs ("Here are your top customers:").
  const withoutPointerIntros = cleaned
    .split(/\n{2,}/)
    .filter((paragraph) => !INTRO_PARAGRAPH_REGEX.test(paragraph.trim()))
    .join("\n\n");

  return withoutPointerIntros
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "");
}

/**
 * Removes redundant data tables from text blocks when structured tool-result
 * cards are present, and drops any text block left empty afterwards.
 */
function dedupeRedundantText(blocks: BloomContentBlock[]): BloomContentBlock[] {
  const toolResultBlocks = blocks.filter(
    (block) => block.type === "tool_result",
  );
  if (toolResultBlocks.length === 0) {
    return blocks;
  }

  const deduped = blocks
    .map((block) => {
      if (block.type !== "text") {
        return block;
      }
      const stripped = stripRedundantContent(block.content, toolResultBlocks);
      return stripped === block.content
        ? block
        : { ...block, content: stripped };
    })
    .filter(
      (block) => block.type !== "text" || block.content.trim().length > 0,
    );

  // Surface the structured result cards first, then surviving text/other
  // blocks, so the reader sees the data before any analysis. Thinking stays on
  // top and relative order within each group is preserved.
  const thinking = deduped.filter((block) => block.type === "thinking");
  const toolResults = deduped.filter((block) => block.type === "tool_result");
  const rest = deduped.filter(
    (block) => block.type !== "thinking" && block.type !== "tool_result",
  );
  return [...thinking, ...toolResults, ...rest];
}

/**
 * Durable cleanup for persisted text that was a form/field request or a
 * text-based task plan. The interactive UI owns those, so the raw field list is
 * dropped while any leading prose ("To create a new customer…") is kept.
 * JSON tool payloads are already removed upstream by `stripEchoedToolPayloads`.
 */
function stripInterceptedTextBlocks(
  blocks: BloomContentBlock[],
): BloomContentBlock[] {
  return blocks
    .map((block) => {
      if (block.type !== "text") {
        return block;
      }
      const decision = analyzeStreamingContent(block.content, {
        hasToolResultBlocks: false,
        toolResultIdentifiers: new Set<string>(),
        isAfterToolResult: false,
      });
      if (
        decision.action !== "intercept_form" &&
        decision.action !== "intercept_plan"
      ) {
        return block;
      }
      const intro = extractPreFormText(block.content);
      return intro === block.content ? block : { ...block, content: intro };
    })
    .filter(
      (block) => block.type !== "text" || block.content.trim().length > 0,
    );
}

export function parseContentBlocks(message: BloomMessage): BloomContentBlock[] {
  const blocks: BloomContentBlock[] = [];
  const safeText = stripEchoedToolPayloads(message.text);
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
    pushTextBlock(blocks, `${message.id}-text`, safeText);
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
        safeText.length,
      );
      pushTextBlock(
        blocks,
        `${message.id}-text-before-${block.id}`,
        safeText.slice(cursor, position),
      );
      blocks.push(blockItemToContentBlock(block, index));
      cursor = position;
    });
    pushTextBlock(
      blocks,
      `${message.id}-text-after-blocks`,
      safeText.slice(cursor),
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
    pushTextBlock(blocks, `${message.id}-text`, safeText);
  }

  return stripInterceptedTextBlocks(dedupeRedundantText(blocks));
}
