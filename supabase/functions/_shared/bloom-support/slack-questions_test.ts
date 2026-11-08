import { assertEquals, assertStringIncludes } from "@std/assert";
import { featureQuestionAnswer, projectQuestionAnswer, slackQuestionRoute } from "./slack-questions.ts";

Deno.test("only approved question channels are conversational", () => {
  assertEquals(slackQuestionRoute("C0CFUG4LFLJ"), "ask");
  assertEquals(slackQuestionRoute("C0CFWJDUQU9"), "features");
  assertEquals(slackQuestionRoute("C0CFUHJ5ESW"), "projects");
  assertEquals(slackQuestionRoute("C0CFNEQBS2X"), null);
});

Deno.test("project answers are bounded, linked, and exclude unsafe markup", () => {
  const answer = projectQuestionAnswer([{ id: "11111111-1111-4111-8111-111111111111", project_name: "Launch <@U1>", stage: "internal_review", next_action: "Check & verify", next_action_owner: "Team" }]);
  assertStringIncludes(answer, "Launch U1");
  assertStringIncludes(answer, "internal review");
  assertStringIncludes(answer, "?project=11111111-1111-4111-8111-111111111111");
  assertEquals(answer.includes("<@U1>"), false);
});

Deno.test("feature answers distinguish accepted requests from released features", () => {
  const answer = featureQuestionAnswer([{ title: "Multiple addresses", status: "accepted", product: "cms" }]);
  assertStringIncludes(answer, "Multiple addresses — accepted (cms)");
  assertStringIncludes(answer, "not confirmation that a feature is released");
});
