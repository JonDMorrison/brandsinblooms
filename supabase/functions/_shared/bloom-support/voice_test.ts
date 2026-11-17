import { assert, assertEquals, assertFalse, assertRejects, assertStringIncludes } from "@std/assert";
import {
  announceAfterActiveHandoff,
  BLOOM_ANSWER_SYSTEM_PROMPT,
  BLOOM_ROLE_DISCLOSURE,
  BLOOM_SIGNATURE,
  bloomAcknowledgement,
  bloomAttachmentRejection,
  bloomClarification,
  bloomEngineeringProgress,
  bloomFeatureDecision,
  bloomFeatureReceived,
  bloomHandoff,
  bloomHumanRequested,
  bloomInvestigationStarted,
  bloomReopened,
  bloomResolution,
  wantsHumanContact,
} from "./voice.ts";

Deno.test("Bloom identifies its support role once in the deterministic first reply", () => {
  const message = bloomAcknowledgement(1011);
  assertEquals(
    message,
    "I'm Bloom, the BloomSuite support agent. Your request #1011 is with me now. I'll work through it and let you know what I find — or pass it to a person on our support team if that's what it needs.",
  );
  assertStringIncludes(message, BLOOM_ROLE_DISCLOSURE);
  assertFalse(/I(?:'m| am) (?:a )?(?:human|person)/i.test(message));
  assertFalse(/keep you posted|update you (?:soon|regularly)|within \d+/i.test(message), "the acknowledgement promises no update cadence");
});

Deno.test("Bloom hands off honestly instead of bluffing", () => {
  const message = bloomHandoff("I couldn't verify an answer from the approved guidance");
  assertStringIncludes(message, "rather than guessing");
  assertStringIncludes(message, "a person on our support team");
  assertStringIncludes(message, "no need to start over");
});

Deno.test("the answer prompt centralizes identity, uncertainty and approved-knowledge rules", () => {
  for (const phrase of ["BloomSuite support agent", "AI support agent, not a human", "ONLY the approved articles", "Never invent", "say so clearly"]) {
    assert(BLOOM_ANSWER_SYSTEM_PROMPT.includes(phrase), `missing voice rule: ${phrase}`);
  }
  assertFalse(BLOOM_ANSWER_SYSTEM_PROMPT.includes("Brands in Blooms support agent"));
});

Deno.test("Bloom's lifecycle copy keeps one calm, honest voice", () => {
  assertStringIncludes(bloomClarification(["Which page were you on?"]), "Reply here and I'll pick it up");
  // Feature received: must not overpromise on delivery timeline or outcome
  assertStringIncludes(bloomFeatureReceived(), "can't promise a date or outcome");
  assertFalse(/promise it will be built|will definitely/i.test(bloomFeatureReceived()));
  // Investigation started: bug — must describe evidence/details being recorded
  assertStringIncludes(bloomInvestigationStarted("bug"), "recorded the details");
  assertFalse(/started (?:the |an )?investigation/i.test(bloomInvestigationStarted("bug")));
  // Investigation started: incident — must indicate urgency and staff awareness
  assertStringIncludes(bloomInvestigationStarted("incident"), "Jon or Jeff will see this");
  assertStringIncludes(bloomEngineeringProgress("verifying") ?? "", "won't mark this resolved");
  assertStringIncludes(bloomEngineeringProgress("rolled_back") ?? "", "rolled back");
  assertEquals(bloomEngineeringProgress("open"), null);
  // Feature decision: planned — must not promise a shipping date
  assertStringIncludes(bloomFeatureDecision("planned"), "No date yet");
  assertFalse(/guaranteed|will ship by|definitely/i.test(bloomFeatureDecision("planned")));
  assertStringIncludes(bloomFeatureDecision("declined"), "another way");
  assertStringIncludes(bloomResolution("I verified the affected flow."), "reply to this email");
  // Reopened: must reassure the customer they don't need to repeat themselves
  assertStringIncludes(bloomReopened(), "don't need to repeat yourself");
  assertStringIncludes(bloomAttachmentRejection(["photo.tiff: unsupported attachment name or type"]), "request is already open");
  assertEquals(BLOOM_SIGNATURE, "Bloom\nBloomSuite support agent");
});

Deno.test("wantsHumanContact detects explicit requests for a person", () => {
  // Clear explicit requests
  assert(wantsHumanContact("I want to talk to a real person"));
  assert(wantsHumanContact("Can I speak with someone on your team?"));
  assert(wantsHumanContact("I need a human, not a bot"));
  assert(wantsHumanContact("Please get me a real person"));
  assert(wantsHumanContact("stop the bot and connect me with staff"));
  assert(wantsHumanContact("no ai please, I want someone to call me"));
  assert(wantsHumanContact("I'd prefer to chat with an agent"));
  assert(wantsHumanContact("Can you get me a representative?"));

  // Should NOT trigger — normal support messages
  assertFalse(wantsHumanContact("My checkout is broken"));
  assertFalse(wantsHumanContact("Can you help me with this?"));
  assertFalse(wantsHumanContact("I need help adding a person to my account"));
  assertFalse(wantsHumanContact("The human resources module isn't working"));
  assertFalse(wantsHumanContact(""));
});

Deno.test("bloomHumanRequested confirms context transfer so the customer never repeats themselves", () => {
  const msg = bloomHumanRequested();
  assertStringIncludes(msg, "support team");
  assertStringIncludes(msg, "everything you've shared");
  assertFalse(/start over/i.test(msg), "should tell customer they don't need to repeat themselves");
});

Deno.test("a handoff promise is gated by durable active routing", async () => {
  let announcements = 0;
  await assertRejects(
    () => announceAfterActiveHandoff(
      () => Promise.reject(new Error("routing unavailable")),
      () => Promise.resolve(++announcements),
    ),
    Error,
    "routing unavailable",
  );
  assertEquals(announcements, 0, "routing failure cannot publish a takeover promise");

  assertEquals(await announceAfterActiveHandoff(
    () => Promise.resolve({ status: "resolved" }),
    () => Promise.resolve(++announcements),
  ), false);
  assertEquals(announcements, 0, "a resolved duplicate cannot publish a new takeover promise");

  assertEquals(await announceAfterActiveHandoff(
    () => Promise.resolve({ status: "open" }),
    () => Promise.resolve(++announcements),
  ), true);
  assertEquals(announcements, 1, "an active escalation permits exactly one announcement callback");
});
