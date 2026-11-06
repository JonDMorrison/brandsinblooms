import { assertEquals, assertFalse, assertStringIncludes } from "@std/assert";
import { engineeringIssuePayload } from "./engineering.ts";

Deno.test("the final GitHub issue payload contains no client contact details or customer identifiers", () => {
  const issueId = "11111111-2222-4333-8444-555555555555";
  const payload = engineeringIssuePayload({
    issueId,
    title: "Logo save fails for jane.doe+support@example.com (+1 604-555-0199)",
    branch: "bloom/fix-11111111",
    base: "main",
    evidence: [
      "### Report #1011: Logo save fails",
      "Contact jane.doe+support@example.com or (604) 555-0199.",
      "Customer ID: cust_private_42; account number acct_987654.",
      "Tenant ID: 5e7d2797-4169-46ae-b2d2-db3cb6990b7a; external user id cms-user-1.",
    ].join("\n"),
  });

  const outbound = JSON.stringify(payload);
  for (const privateValue of [
    "jane.doe+support@example.com",
    "604-555-0199",
    "cust_private_42",
    "acct_987654",
    "5e7d2797-4169-46ae-b2d2-db3cb6990b7a",
    "cms-user-1",
  ]) assertFalse(outbound.includes(privateValue), `GitHub payload leaked ${privateValue}`);
  assertStringIncludes(payload.title, "[redacted email]");
  assertStringIncludes(payload.body, "[redacted phone]");
  assertStringIncludes(payload.body, "[redacted customer id]");
  assertStringIncludes(payload.body, issueId, "the non-customer engineering correlation id remains available");
  assertEquals(payload.labels, ["bloom-repair"]);
});
