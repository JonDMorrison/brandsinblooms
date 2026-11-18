// Turns the raw SSE events of one Bloom turn into a transcript the scorer can
// check. Event shapes come from supabase/functions/bloom-assist/types.ts and
// stream-handler.ts: token {text}, tool_start {tool, params},
// tool_result {tool, block_type, result}, action_card {...}, task_plan {...},
// error {message, code}, done {...}.

const FOLLOW_UPS_PATTERN = /<follow_ups>[\s\S]*?<\/follow_ups>/g;

/**
 * @typedef {{ tool: string, params: unknown, result: Record<string, unknown> | null, blockType: string | null }} ToolCall
 * @typedef {{
 *   text: string,
 *   toolCalls: ToolCall[],
 *   actionCards: Record<string, unknown>[],
 *   taskPlans: Record<string, unknown>[],
 *   errors: Record<string, unknown>[],
 *   done: Record<string, unknown> | null,
 * }} Transcript
 */

/** @param {unknown} value */
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : null;
}

/** @param {Record<string, unknown> | null} data */
function toolNameOf(data) {
  const name = data?.tool ?? data?.tool_name;
  return typeof name === "string" ? name : "";
}

/**
 * @param {import("./sse.mjs").BloomSseEvent[]} events
 * @returns {Transcript}
 */
export function buildTranscript(events) {
  /** @type {Transcript} */
  const transcript = {
    text: "",
    toolCalls: [],
    actionCards: [],
    taskPlans: [],
    errors: [],
    done: null,
  };

  for (const { event, data } of events) {
    const record = asRecord(data);

    if (event === "token" && typeof record?.text === "string") {
      transcript.text += record.text;
      continue;
    }

    if (event === "tool_start") {
      transcript.toolCalls.push({
        tool: toolNameOf(record),
        params: record?.params ?? null,
        result: null,
        blockType: null,
      });
      continue;
    }

    if (event === "tool_result") {
      const tool = toolNameOf(record);
      const pending = [...transcript.toolCalls]
        .reverse()
        .find((call) => call.tool === tool && call.result === null);
      const result = asRecord(record?.result);
      const blockType =
        typeof record?.block_type === "string" ? record.block_type : null;
      if (pending) {
        pending.result = result;
        pending.blockType = blockType;
      } else {
        transcript.toolCalls.push({ tool, params: null, result, blockType });
      }
      continue;
    }

    if (event === "action_card" && record) transcript.actionCards.push(record);
    else if (event === "task_plan" && record) transcript.taskPlans.push(record);
    else if (event === "error" && record) transcript.errors.push(record);
    else if (event === "done" && record) transcript.done = record;
  }

  transcript.text = transcript.text.replace(FOLLOW_UPS_PATTERN, "").trim();
  return transcript;
}
