import { assertEquals, assertStringIncludes } from "@std/assert";
import { featureQuestionAnswer, projectQuestionAnswer, slackQuestionRoute } from "./slack-questions.ts";

Deno.test("only approved question channels are conversational", () => {
  assertEquals(slackQuestionRoute("C0CFUG4LFLJ"), "ask");
  assertEquals(slackQuestionRoute("C0CFWJDUQU9"), "features");
  assertEquals(slackQuestionRoute("C0CFUHJ5ESW"), "projects");
  assertEquals(slackQuestionRoute("C0CFNEQBS2X"), "tickets");
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

Deno.test("project and feature summaries withhold customer contacts and secrets", () => {
  const project = projectQuestionAnswer([{id:"11111111-1111-4111-8111-111111111111",project_name:"Launch client@example.ca",stage:"building",next_action:"Call (604) 555-1212",next_action_owner:"Team"}]);
  assertEquals(project.includes("client@example.ca"), false);
  assertEquals(project.includes("604"), false);
  assertStringIncludes(project, "See linked record");
  const feature = featureQuestionAnswer([{title:"Fix key xoxb-test-secret",product:"crm",status:"accepted"}]);
  assertEquals(feature.includes("xoxb-"), false);
  assertStringIncludes(feature, "See linked record");
});

Deno.test("Slack summary fields cannot generate channel pings", () => {
  const answer = featureQuestionAnswer([{title:"<@U123> *urgent* @here",status:"accepted",product:"crm"}]);
  assertEquals(answer.includes("<@"), false);
  assertEquals(answer.includes("@here"), false);
  assertEquals(answer.includes("*urgent*"), false);
});
