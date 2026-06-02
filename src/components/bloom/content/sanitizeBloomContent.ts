import {
  containsToolJson,
  isToolErrorPayload,
  stripToolJsonFromText,
} from "@/components/bloom/utils/stripToolJson";

export { containsToolJson, isToolErrorPayload, stripToolJsonFromText };

export const isToolPayloadObject = isToolErrorPayload;

/** Backward-compatible name for the shared tool-JSON sanitizer. */
export function stripEchoedToolPayloads(text: string): string {
  return stripToolJsonFromText(text);
}

// A complete markdown table: header row, separator row, then zero+ body rows.
const COMPLETE_TABLE_REGEX =
  /(?:^|\n)\|[^\n]+\|[ \t]*\n\|[ \t:|-]+\|[ \t]*\n(?:\|[^\n]+\|[ \t]*(?:\n|$))*/g;

// A trailing, still-streaming table fragment: a run of lines that each begin
// with "|" reaching the end of the buffer (header/separator/rows not yet
// closed off by following prose).
const TRAILING_TABLE_FRAGMENT_REGEX = /(?:^|\n)\|[^\n]*(?:\n\|[^\n]*)*$/;

/**
 * Hides markdown tables from LIVE streaming plain-text output.
 *
 * Streaming assistant text is written straight into a `textContent` node with
 * `white-space: pre-wrap`, so any markdown table the model emits would flash as
 * raw `| pipe | rows |` until the message persists and re-renders through the
 * markdown pipeline (where duplicate tables are also stripped). This helper
 * suppresses both fully-formed tables and the in-progress trailing fragment so
 * the raw markdown never appears mid-stream. It is fence-aware: tables inside
 * code blocks (closed or still open) are preserved verbatim.
 *
 * Pure. Intended only for the transient streaming view, not for persistence.
 */
export function stripStreamingMarkdownTables(text: string): string {
  if (!text.includes("|")) {
    return text;
  }

  // Inside an unclosed code fence the trailing content is literal code — only
  // sanitize the part before the open fence and leave the code untouched.
  const fenceCount = (text.match(/```/g) ?? []).length;
  if (fenceCount % 2 === 1) {
    const lastFence = text.lastIndexOf("```");
    return (
      stripStreamingMarkdownTables(text.slice(0, lastFence)) +
      text.slice(lastFence)
    );
  }

  const segments = text.split(/(```[\s\S]*?```)/g);
  const cleaned = segments
    .map((segment, index) => {
      if (segment.startsWith("```")) {
        return segment;
      }

      let next = segment.replace(COMPLETE_TABLE_REGEX, "\n");
      if (index === segments.length - 1) {
        next = next.replace(TRAILING_TABLE_FRAGMENT_REGEX, "");
      }
      return next;
    })
    .join("");

  return cleaned.replace(/\n{3,}/g, "\n\n");
}
