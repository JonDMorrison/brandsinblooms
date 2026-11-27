import { assertEquals } from "@std/assert";

import { retiredFunctionResponse } from "./retiredFunction.ts";

function captureWarnings(run: () => void): unknown[] {
  const original = console.warn;
  const lines: unknown[] = [];
  console.warn = (line: unknown) => lines.push(line);
  try {
    run();
  } finally {
    console.warn = original;
  }
  return lines;
}

Deno.test("a retired function answers 410 Gone and logs origin and referer", async () => {
  let response: Response | undefined;
  const logs = captureWarnings(() => {
    response = retiredFunctionResponse(
      new Request("https://example.test/functions/v1/generate-newsletter", {
        method: "POST",
        headers: {
          origin: "https://app.bloomsuite.test",
          referer: "https://app.bloomsuite.test/calendar",
          "user-agent": "test-agent",
        },
        body: "{}",
      }),
      "generate-newsletter",
    );
  });
  assertEquals(response?.status, 410);
  assertEquals((await response!.json()).code, "FUNCTION_RETIRED");
  assertEquals(logs.length, 1);
  assertEquals(JSON.parse(String(logs[0])), {
    event: "retired_function_called",
    function: "generate-newsletter",
    method: "POST",
    origin: "https://app.bloomsuite.test",
    referer: "https://app.bloomsuite.test/calendar",
    user_agent: "test-agent",
  });
});

Deno.test("a retired function still answers CORS preflight without logging", () => {
  let response: Response | undefined;
  const logs = captureWarnings(() => {
    response = retiredFunctionResponse(
      new Request("https://example.test", { method: "OPTIONS" }),
      "generate-plan-email",
    );
  });
  assertEquals(response?.status, 200);
  assertEquals(logs.length, 0);
});
