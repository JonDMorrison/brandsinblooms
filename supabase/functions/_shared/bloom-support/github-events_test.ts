import { assertEquals } from "@std/assert";
import { failedMainCheckSuite } from "./github-events.ts";

const sha = "a".repeat(40);
Deno.test("report failed checks from the release branch with a stable source", () => {
  assertEquals(failedMainCheckSuite({id: 123456789, head_branch: "main", conclusion: "failure", head_sha: sha}), {id:123456789, sha});
});
Deno.test("ignore failed PR checks and successful release checks", () => {
  assertEquals(failedMainCheckSuite({id:123456789, head_branch:"feature/branch", conclusion:"failure", head_sha:sha}), null);
  assertEquals(failedMainCheckSuite({id:123456789, head_branch:"main", conclusion:"success", head_sha:sha}), null);
});
Deno.test("reject malformed or missing check identities", () => {
  assertEquals(failedMainCheckSuite(null), null);
  assertEquals(failedMainCheckSuite({id:"123456789",head_branch:"main",conclusion:"failure",head_sha:sha}), null);
  assertEquals(failedMainCheckSuite({id:123456789,head_branch:"main",conclusion:"failure",head_sha:"not-a-sha"}), null);
});
