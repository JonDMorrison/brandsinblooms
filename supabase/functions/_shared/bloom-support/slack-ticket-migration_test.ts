import { assert, assertEquals, assertStringIncludes } from "@std/assert";

// The production release deploys migrations verbatim. A previous string-edit
// corrupted PostgreSQL dollar-quoted delimiters and duplicated most of a file.
// Check the exact committed source before allowing any future release.
const sql = await Deno.readTextFile(new URL("../../../migrations/20261108162000_bloom_support_slack_ticket_threads.sql", import.meta.url));

Deno.test("ticket-thread migration has balanced function bodies and cannot be duplicated", () => {
  assert(sql.length > 5000 && sql.length < 12000);
  assert(sql.split("\n").length < 240);
  assertEquals((sql.match(/CREATE OR REPLACE FUNCTION /g) ?? []).length, 4);
  assertEquals((sql.match(/\bAS \$\$/g) ?? []).length, 4);
  assertEquals((sql.match(/\$\$;/g) ?? []).length, 4);
  assertEquals(sql.includes(" AS $\n"), false);
  assertEquals(sql.includes("AS $\n"), false);
});

Deno.test("ticket conversation database guards keep private data and authorization server-side", () => {
  assertStringIncludes(sql, "ALTER TABLE bloom_support.slack_ticket_threads ENABLE ROW LEVEL SECURITY;");
  assertStringIncludes(sql, "GRANT SELECT, INSERT ON TABLE bloom_support.slack_ticket_threads TO service_role;");
  assertStringIncludes(sql, "AND bloom_support.has_permission(pr.id,'tickets.read_all')");
  assertStringIncludes(sql, "bloom_support.can_read_ticket(v_actor,v_ticket)");
  assertStringIncludes(sql, "redacted_at IS NULL");
  assertStringIncludes(sql, "ON CONFLICT (ticket_id) DO NOTHING");
  assertStringIncludes(sql, "AFTER UPDATE OF owner_id, executor, executor_id");
  assertStringIncludes(sql, "'slack_ticket_changed',true");
  for (const signature of [
    "public.bloom_support_slack_ticket_thread(uuid,text)",
    "public.bloom_support_enqueue_slack_ticket_question(text,text,text,text,text)",
    "public.bloom_support_slack_ticket_actor(text)",
  ]) assertStringIncludes(sql, "REVOKE ALL ON FUNCTION " + signature);
});
