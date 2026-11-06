import { assert, assertEquals, assertFalse, assertRejects, assertStringIncludes } from "@std/assert";
import {
  announceAfterActiveHandoff,
  BLOOM_ANSWER_SYSTEM_PROMPT,
  BLOOM_ROLE_DISCLOSURE,
  bloomAcknowledgement,
  bloomHandoff,
} from "./voice.ts";

Deno.test("Bloom identifies its support role once in the deterministic first reply", () => {
  const message = bloomAcknowledgement(1011);
  assertEquals(
    message,
    "I'm Bloom, the Brands in Blooms support agent. I've received your request (#1011). I'll take the first look. If this needs a person, I'll hand it over.",
  );
  assertStringIncludes(message, BLOOM_ROLE_DISCLOSURE);
  assertFalse(/I(?:'m| am) (?:a )?(?:human|person)/i.test(message));
  assertFalse(/keep you posted|update you (?:soon|regularly)|within \d+/i.test(message), "the acknowledgement promises no update cadence");
});

Deno.test("Bloom hands off honestly instead of bluffing", () => {
  const message = bloomHandoff("I couldn't verify an answer from the approved guidance");
  assertStringIncludes(message, "rather than guessing");
  assertStringIncludes(message, "a person on our support team");
});

Deno.test("the answer prompt centralizes identity, uncertainty and approved-knowledge rules", () => {
  for (const phrase of ["AI support agent, not a human", "ONLY the approved articles", "Never invent", "say so clearly"]) {
    assert(BLOOM_ANSWER_SYSTEM_PROMPT.includes(phrase), `missing voice rule: ${phrase}`);
  }
});

Deno.test("a handoff promise is gated by durable active routing", async () => {
  let announcements = 0;
  await assertRejects(
    () => announceAfterActiveHandoff(
      () => Promise.reject(new Error("routing unavailable")),
      async () => { announcements++; },
    ),
    Error,
    "routing unavailable",
  );
  assertEquals(announcements, 0, "routing failure cannot publish a takeover promise");

  assertEquals(await announceAfterActiveHandoff(
    async () => ({ status: "resolved" }),
    async () => { announcements++; },
  ), false);
  assertEquals(announcements, 0, "a resolved duplicate cannot publish a new takeover promise");

  assertEquals(await announceAfterActiveHandoff(
    async () => ({ status: "open" }),
    async () => { announcements++; },
  ), true);
  assertEquals(announcements, 1, "an active escalation permits exactly one announcement callback");
});
