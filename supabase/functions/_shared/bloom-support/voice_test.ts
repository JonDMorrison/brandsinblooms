import { assert, assertEquals, assertFalse, assertRejects, assertStringIncludes } from "@std/assert";
import {
  announceAfterActiveHandoff, BLOOM_ANSWER_SYSTEM_PROMPT, BLOOM_ROLE_DISCLOSURE, BLOOM_SIGNATURE,
  bloomAcknowledgement, bloomAttachmentRejection, bloomClarification, bloomEngineeringProgress,
  bloomFeatureDecision, bloomFeatureReceived, bloomHandoff, bloomHumanRequested,
  bloomInvestigationStarted, bloomReopened, bloomResolution, wantsHumanContact,
} from "./voice.ts";

Deno.test("Bloom identifies its AI support role in the deterministic first reply", () => {
  const message = bloomAcknowledgement(1011);
  assertEquals(message, "I'm Bloom, the BloomSuite AI support agent. Your request #1011 is with me now. I'll work through it and let you know what I find — or pass it to a person on our support team if that's what it needs.");
  assertStringIncludes(message, BLOOM_ROLE_DISCLOSURE);
  assertFalse(/I(?:'m| am) (?:a )?(?:human|person)/i.test(message));
  assertFalse(/keep you posted|update you (?:soon|regularly)|within \d+/i.test(message));
});
Deno.test("Bloom hands off honestly instead of bluffing", () => {
  const message = bloomHandoff("I couldn't verify an answer from the approved guidance");
  for (const phrase of ["rather than guessing", "a person on our support team", "no need to start over"]) assertStringIncludes(message, phrase);
});
Deno.test("the answer prompt centralizes identity, uncertainty and approved-knowledge rules", () => {
  for (const phrase of ["BloomSuite support agent", "AI support agent, not a human", "ONLY the approved articles", "Never invent", "say so clearly"]) assert(BLOOM_ANSWER_SYSTEM_PROMPT.includes(phrase));
  assertFalse(BLOOM_ANSWER_SYSTEM_PROMPT.includes("Brands in Blooms support agent"));
});
Deno.test("Bloom's lifecycle copy keeps one calm, honest voice", () => {
  assertStringIncludes(bloomClarification(["Which page were you on?"]), "Reply here and I'll pick it up");
  assertStringIncludes(bloomFeatureReceived(), "can't promise a date or outcome");
  assertFalse(/promise it will be built|will definitely/i.test(bloomFeatureReceived()));
  assertStringIncludes(bloomInvestigationStarted("bug"), "recorded the details");
  assertFalse(/started (?:the |an )?investigation/i.test(bloomInvestigationStarted("bug")));
  assertStringIncludes(bloomInvestigationStarted("incident"), "Our support team will see this");
  assertStringIncludes(bloomEngineeringProgress("verifying") ?? "", "won't mark this resolved");
  assertStringIncludes(bloomEngineeringProgress("rolled_back") ?? "", "rolled back");
  assertEquals(bloomEngineeringProgress("open"), null);
  assertStringIncludes(bloomFeatureDecision("planned"), "No date yet");
  assertFalse(/guaranteed|will ship by|definitely/i.test(bloomFeatureDecision("planned")));
  assertStringIncludes(bloomFeatureDecision("declined"), "another way");
  assertStringIncludes(bloomResolution("I verified the affected flow."), "reply to this email");
  assertStringIncludes(bloomReopened(), "don't need to repeat yourself");
  assertStringIncludes(bloomAttachmentRejection(["photo.tiff: unsupported attachment name or type"]), "request is already open");
  assertEquals(BLOOM_SIGNATURE, "Bloom\nBloomSuite support agent");
});
Deno.test("human contact detection covers natural requests and callbacks", () => {
  for (const text of [
    "I want to talk to a real person", "Can I speak with someone on your team?", "I need a human, not a bot",
    "Please get me a real person", "stop the bot and connect me with staff", "no ai please, I want someone to call me",
    "I'd prefer to chat with an agent", "Can you get me a representative?", "Can you have someone call me?",
    "Please call me", "Could you phone us?", "I would like a callback", "Stop the automated answers",
    "I don't need help with stock, but please have someone contact me",
    "Please don't call me; I'd prefer to chat with an agent.",
    "Do not send another email. Please call me.",
    "I do not want a call, please connect me with a human",
    "Do not send another email and please call me",
  ]) assert(wantsHumanContact(text), text);
});
Deno.test("human contact detection rejects ordinary tasks and negated requests", () => {
  for (const text of [
    "My checkout is broken", "Can you help me with this?", "I need help adding a person to my account",
    "The human resources module isn't working", "I don't need a human", "Please don't call me",
    "Do not get me a representative", "No need to phone us", "", "a".repeat(10_001),
    "I don't need a callback", "I don't want to speak with staff", "No need to talk to someone",
    "I never want to speak with someone", "Please don't stop the bot",
  ]) assertFalse(wantsHumanContact(text), text.slice(0, 100));
});
Deno.test("human handoff preserves context without an invented response time", () => {
  const message = bloomHumanRequested();
  assertStringIncludes(message, "support team");
  assertStringIncludes(message, "everything you've shared");
  assertStringIncludes(message, "don't need to repeat yourself");
  assertStringIncludes(message, "don't have a confirmed response time");
  assertFalse(/shortly|within \d+|will call|has read|has accepted|immediately/i.test(message));
});
Deno.test("a handoff promise is gated by durable active routing", async () => {
  let announcements = 0;
  await assertRejects(() => announceAfterActiveHandoff(
    () => Promise.reject(new Error("routing unavailable")), () => Promise.resolve(++announcements),
  ), Error, "routing unavailable");
  assertEquals(announcements, 0);
  assertEquals(await announceAfterActiveHandoff(() => Promise.resolve({ status: "resolved" }), () => Promise.resolve(++announcements)), false);
  assertEquals(announcements, 0);
  assertEquals(await announceAfterActiveHandoff(() => Promise.resolve({ status: "open" }), () => Promise.resolve(++announcements)), true);
  assertEquals(announcements, 1);
});
