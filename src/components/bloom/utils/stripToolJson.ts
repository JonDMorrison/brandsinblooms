function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Detects the tool-execution envelope shapes Bloom emits. */
export function isToolErrorPayload(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(isToolErrorPayload);
  }

  if (!isRecord(value)) {
    return false;
  }

  if (value.block_type !== undefined) {
    return true;
  }
  if (value.tool_output !== undefined) {
    return true;
  }
  if (value.confirmation_required !== undefined) {
    return true;
  }
  if (
    value.error === "validation_error" ||
    value.error === "execution_error" ||
    value.error === "timeout_error" ||
    value.error === "forbidden" ||
    value.error === "tenant_isolation_violation"
  ) {
    return true;
  }
  if (value.success === false && typeof value.error === "string") {
    return true;
  }
  if (value.success !== undefined && isRecord(value.data)) {
    return true;
  }

  return false;
}

const TOOL_JSON_MARKER_REGEX =
  /"block_type"\s*:|"tool_output"\s*:|"confirmation_required"\s*:|"error"\s*:\s*"(?:validation_error|execution_error|timeout_error|forbidden|tenant_isolation_violation)"/;

function parseIfToolPayload(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (!trimmed) {
    return false;
  }

  try {
    return isToolErrorPayload(JSON.parse(trimmed));
  } catch {
    return TOOL_JSON_MARKER_REGEX.test(trimmed);
  }
}

/**
 * Returns the index just past a balanced JSON object/array that begins at
 * `start` (which must point at `{` or `[`), or -1 if it never closes.
 * String-aware so braces inside strings are ignored.
 */
function findBalancedJsonEnd(text: string, start: number): number {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }

  return -1;
}

function stripFencedToolPayloads(text: string): string {
  return text.replace(
    /```[ \t]*(text|json)?[ \t]*\r?\n([\s\S]*?)\r?\n?```/gi,
    (match, _info: string, body: string) =>
      parseIfToolPayload(body) ? "" : match,
  );
}

function stripBareToolPayloads(text: string): string {
  let result = "";
  let cursor = 0;

  while (cursor < text.length) {
    const char = text[cursor];
    const atLineStart = cursor === 0 || /\s/.test(text[cursor - 1] ?? "");

    if ((char === "{" || char === "[") && atLineStart) {
      const end = findBalancedJsonEnd(text, cursor);
      if (end !== -1) {
        const candidate = text.slice(cursor, end);
        if (parseIfToolPayload(candidate)) {
          result = result.replace(
            /(?:^|\n)[ \t]*(?:text|json)[ \t]*\n?$/i,
            "\n",
          );
          cursor = end;
          continue;
        }
      }
    }

    result += char;
    cursor += 1;
  }

  return result;
}

function hasFencedToolPayload(text: string): boolean {
  const fenceRegex = /```[ \t]*(text|json)?[ \t]*\r?\n([\s\S]*?)\r?\n?```/gi;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(text)) !== null) {
    if (parseIfToolPayload(match[2])) {
      return true;
    }
  }

  return false;
}

function hasBareToolPayload(text: string): boolean {
  let cursor = 0;

  while (cursor < text.length) {
    const char = text[cursor];
    const atLineStart = cursor === 0 || /\s/.test(text[cursor - 1] ?? "");

    if ((char === "{" || char === "[") && atLineStart) {
      const end = findBalancedJsonEnd(text, cursor);
      if (end !== -1 && parseIfToolPayload(text.slice(cursor, end))) {
        return true;
      }
    }

    cursor += 1;
  }

  return false;
}

export function containsToolJson(text: string): boolean {
  if (!text || (!text.includes("{") && !text.includes("["))) {
    return false;
  }

  return (
    TOOL_JSON_MARKER_REGEX.test(text) ||
    hasFencedToolPayload(text) ||
    hasBareToolPayload(text)
  );
}

/** Removes echoed tool-execution payloads from assistant text. Pure. */
export function stripToolJsonFromText(text: string): string {
  if (!text || (!text.includes("{") && !text.includes("["))) {
    return text;
  }

  let result = stripFencedToolPayloads(text);
  result = stripBareToolPayloads(result);
  result = result.replace(/\n{3,}/g, "\n\n").trim();
  return result;
}
