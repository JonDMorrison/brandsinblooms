// Parses the Server-Sent Events stream returned by the bloom-assist edge
// function. Mirrors parseSseMessage in src/hooks/askBloom/useAskBloomStreaming.ts:
// frames are separated by a blank line, each frame has one `event:` line and
// one or more `data:` lines holding JSON, and `:` lines are comments.

/**
 * @typedef {{ event: string, data: unknown }} BloomSseEvent
 */

/**
 * @param {string} frame
 * @returns {BloomSseEvent | null}
 */
export function parseSseFrame(frame) {
  let eventName = "message";
  const dataLines = [];

  for (const rawLine of frame.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith(":")) continue;
    const separator = rawLine.indexOf(":");
    const field = separator === -1 ? rawLine : rawLine.slice(0, separator);
    const value =
      separator === -1 ? "" : rawLine.slice(separator + 1).replace(/^ /, "");
    if (field === "event") eventName = value.trim();
    else if (field === "data") dataLines.push(value);
  }

  if (dataLines.length === 0) return null;

  const rawData = dataLines.join("\n");
  try {
    return { event: eventName, data: JSON.parse(rawData) };
  } catch {
    return { event: eventName, data: rawData };
  }
}

/**
 * @param {string} body
 * @returns {BloomSseEvent[]}
 */
export function parseSseText(body) {
  return body
    .split(/\r?\n\r?\n/)
    .map((frame) => parseSseFrame(frame))
    .filter((event) => event !== null);
}

/**
 * Reads a fetch Response body to completion and returns its events.
 * @param {ReadableStream<Uint8Array> | null} stream
 * @returns {Promise<BloomSseEvent[]>}
 */
export async function readSseStream(stream) {
  if (!stream) return [];
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return parseSseText(text);
}
