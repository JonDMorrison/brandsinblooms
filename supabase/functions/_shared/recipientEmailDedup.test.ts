import {
  dedupeRecipientsByEmail,
  normalizeRecipientEmail,
} from "./recipientEmailDedup.ts";

function assertEquals(actual: unknown, expected: unknown, message?: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(message ?? `Expected ${e}, received ${a}`);
}

const row = (
  id: string,
  email: string,
  extra: Record<string, unknown> = {},
) => ({ id, email, email_opt_in: true, created_at: "2026-01-01T00:00:00Z", ...extra });

Deno.test("normalizes case and surrounding whitespace only", () => {
  assertEquals(normalizeRecipientEmail("  Pat@Example.COM "), "pat@example.com");
  assertEquals(normalizeRecipientEmail("pat+shop@example.com"), "pat+shop@example.com");
  assertEquals(normalizeRecipientEmail(null), "");
});

Deno.test("unique addresses pass through in their original order", () => {
  const input = [row("b", "b@example.com"), row("a", "a@example.com")];
  const result = dedupeRecipientsByEmail(input);
  assertEquals(result.recipients.map((r) => r.id), ["b", "a"]);
  assertEquals(result.duplicateRecords.length, 0);
  assertEquals(result.restrictedRecords.length, 0);
});

Deno.test("two records with one address receive one copy, oldest record kept", () => {
  const input = [
    row("newer", "Pat@Example.com", { created_at: "2026-05-01T00:00:00Z" }),
    row("older", " pat@example.com", { created_at: "2025-05-01T00:00:00Z" }),
    row("other", "sam@example.com"),
  ];
  const result = dedupeRecipientsByEmail(input);
  assertEquals(result.recipients.map((r) => r.id), ["older", "other"]);
  assertEquals(result.duplicateRecords.map((r) => r.id), ["newer"]);
});

Deno.test("the kept record does not depend on input order", () => {
  const a = row("a", "pat@example.com", { created_at: "2026-03-01T00:00:00Z" });
  const b = row("b", "PAT@example.com", { created_at: "2026-03-01T00:00:00Z" });
  assertEquals(dedupeRecipientsByEmail([a, b]).recipients.map((r) => r.id), ["a"]);
  assertEquals(dedupeRecipientsByEmail([b, a]).recipients.map((r) => r.id), ["a"]);
});

Deno.test("an opted-out record blocks every record with the same address", () => {
  const input = [
    row("in", "pat@example.com"),
    row("out", "Pat@example.com", { email_opt_in: false }),
    row("other", "sam@example.com"),
  ];
  const result = dedupeRecipientsByEmail(input);
  assertEquals(result.recipients.map((r) => r.id), ["other"]);
  assertEquals(result.restrictedRecords.map((r) => r.id).sort(), ["in", "out"]);
});

Deno.test("a suppressed record blocks every record with the same address", () => {
  const input = [
    row("ok", "pat@example.com"),
    row("sup", "PAT@EXAMPLE.COM", { suppressed: true }),
  ];
  assertEquals(dedupeRecipientsByEmail(input).recipients.length, 0);
});

Deno.test("an acknowledged consent override still sends one copy only", () => {
  const input = [
    row("in", "pat@example.com", { created_at: "2025-01-01T00:00:00Z" }),
    row("out", "Pat@example.com", { email_opt_in: false }),
  ];
  const result = dedupeRecipientsByEmail(input, { respectOptOut: false });
  assertEquals(result.recipients.map((r) => r.id), ["in"]);
});

Deno.test("a single opted-out record is left for the consent checks to handle", () => {
  const input = [row("out", "pat@example.com", { email_opt_in: false })];
  assertEquals(dedupeRecipientsByEmail(input).recipients.map((r) => r.id), ["out"]);
});
