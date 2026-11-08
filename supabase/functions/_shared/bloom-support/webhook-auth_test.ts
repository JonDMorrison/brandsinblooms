import { assert, assertFalse } from "@std/assert";
import { verifyGithubWebhook, verifySlackWebhook } from "./webhook-auth.ts";
Deno.test("GitHub official HMAC SHA-256 fixture and failed signatures", async () => {
  const expected = "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17";
  const secret = "It's a Secret to Everybody";
  assert(await verifyGithubWebhook("Hello, World!", expected, secret));
  assertFalse(await verifyGithubWebhook("Hello, World!!", expected, secret));
  assertFalse(await verifyGithubWebhook("Hello, World!", expected, undefined));
  assertFalse(await verifyGithubWebhook("Hello, World!", "sha1=not-hmac", secret));
});
Deno.test("Slack rejects stale timestamp, modified text, and missing secret", async () => {
  const secret = "example-signing-secret-with-enough-length";
  const ts = "1794099900";
  const body = '{"type":"url_verification","challenge":"abc"}';
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode("v0:" + ts + ":" + body)));
  const sig = "v0=" + Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  assert(await verifySlackWebhook(body, ts, sig, secret, 1794099900));
  assertFalse(await verifySlackWebhook(body, ts, sig, secret, 1794100501));
  assertFalse(await verifySlackWebhook(body + "x", ts, sig, secret, 1794099900));
  assertFalse(await verifySlackWebhook(body, ts, sig, undefined, 1794099900));
});
