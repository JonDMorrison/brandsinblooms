import { assertEquals, assertStringIncludes } from "@std/assert";
const sql = await Deno.readTextFile(new URL("../../../migrations/20261112165850_bloom_support_slack_conversations.sql", import.meta.url));
Deno.test("Slack conversation migration has bounded private schema and service-only API", () => {
  assertEquals((sql.match(/CREATE OR REPLACE FUNCTION /g) ?? []).length, 5);
  assertEquals((sql.match(/\$\$;/g) ?? []).length, 5);
  for (const table of ["slack_conversations", "slack_conversation_replies"]) {
    assertStringIncludes(sql, `ALTER TABLE bloom_support.${table} ENABLE ROW LEVEL SECURITY`);
  }
  for (const name of ["enqueue_slack_conversation", "slack_conversation_context", "claim_slack_reply", "record_slack_reply", "mark_slack_reply_unknown"]) {
    assertStringIncludes(sql, `REVOKE ALL ON FUNCTION public.bloom_support_${name}`);
    assertStringIncludes(sql, `GRANT EXECUTE ON FUNCTION public.bloom_support_${name}`);
  }
  assertStringIncludes(sql, "AND old.payload->>'slack_user_id'=c.slack_user_id");
  assertStringIncludes(sql, "ORDER BY old.created_at DESC LIMIT 6");
  assertStringIncludes(sql, "reply.state='final'");
  assertStringIncludes(sql, "slack:conversation:'||p_channel||':'||p_message_ts");
  assertStringIncludes(sql, "state IN ('pending','sending','progress','final','unknown')");
  assertStringIncludes(sql, "status='running'");
});
