import { assertEquals } from "@std/assert";
import { slackQuestionText } from "./slack-question.ts";

Deno.test("connector attribution cannot turn an unknown question into a help match", () => {
  assertEquals(slackQuestionText("<@U0CFUTM7TQA> zxqvplm lunar teapot protocol\n*Sent using* <@U0CFNEJK11R>"), "zxqvplm lunar teapot protocol");
  assertEquals(slackQuestionText("<@U0CFUTM7TQA> Create and send an email campaign\n\n*Sent using* <@U0CFNEJK11R>"), "Create and send an email campaign");
});
Deno.test("native questions keep multiline text and only remove a trailing attribution", () => {
  assertEquals(slackQuestionText("<@U0CFUTM7TQA> Sent using email?\nHow do I schedule it?"), "Sent using email?\nHow do I schedule it?");
  assertEquals(slackQuestionText("question\n*Sent using* <@U0CFNEJK11R>\nmore question"), "question\n*Sent using* \nmore question");
  assertEquals(slackQuestionText(undefined), "");
  assertEquals(slackQuestionText("a".repeat(1001)).length, 1000);
});
