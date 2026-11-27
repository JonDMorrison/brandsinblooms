import { assert, assertEquals } from "@std/assert";

import { handleGenerateEmailContent } from "../index.ts";
import {
  authedClient,
  ENV,
  generatorRequest,
  OTHER_TENANT_ID,
  OTHER_USER_ID,
  OWN_TENANT_ID,
  recordingCreateClient,
  stubOpenAI,
  TOKEN_USER_ID,
} from "../../_shared/testing/generatorAuthFixtures.ts";

const BLOCK = JSON.stringify({ title: "Fall bulbs", content: "Plant now.", cta_text: "Shop", cta_url: "/bulbs" });

Deno.test("generate-email-content returns 401 without a token", async () => {
  const { client, recorder } = authedClient({ canAccess: true });
  const { createClient, calls } = recordingCreateClient(client);
  const openai = stubOpenAI(BLOCK);
  try {
    const response = await handleGenerateEmailContent(
      generatorRequest({ prompt: "x", type: "email_block" }, null),
      { createClient, envGet: ENV },
    );
    assertEquals(response.status, 401);
    assertEquals(calls.length, 0);
    assertEquals(recorder.length, 0);
    assertEquals(openai.requests.length, 0);
  } finally {
    openai.restore();
  }
});

Deno.test("generate-email-content returns 401 for an invalid token", async () => {
  const { client } = authedClient({ canAccess: true, userId: null });
  const { createClient } = recordingCreateClient(client);
  const openai = stubOpenAI(BLOCK);
  try {
    const response = await handleGenerateEmailContent(
      generatorRequest({ prompt: "x", type: "email_block" }),
      { createClient, envGet: ENV },
    );
    assertEquals(response.status, 401);
    assertEquals(openai.requests.length, 0);
  } finally {
    openai.restore();
  }
});

Deno.test("generate-email-content returns 403 for a tenant the caller cannot access", async () => {
  const { client, recorder } = authedClient({ canAccess: false });
  const { createClient } = recordingCreateClient(client);
  const openai = stubOpenAI(BLOCK);
  try {
    const response = await handleGenerateEmailContent(
      generatorRequest({ prompt: "x", type: "email_block", persona: "Weekend Gardener", tenantId: OTHER_TENANT_ID }),
      { createClient, envGet: ENV },
    );
    assertEquals(response.status, 403);
    const access = recorder.find((entry) => entry.table === "bloom_can_access_tenant");
    assertEquals((access?.payload as { p_tenant_id: string }).p_tenant_id, OTHER_TENANT_ID);
    assert(!recorder.some((entry) => entry.table === "personas"));
    assertEquals(openai.requests.length, 0);
  } finally {
    openai.restore();
  }
});

Deno.test("generate-email-content ignores a body userId and acts as the token's user", async () => {
  const { client, recorder } = authedClient({ canAccess: true });
  const { createClient, calls } = recordingCreateClient(client);
  const openai = stubOpenAI(BLOCK);
  try {
    const response = await handleGenerateEmailContent(
      generatorRequest({ prompt: "x", type: "email_block", userId: OTHER_USER_ID, user_id: OTHER_USER_ID }),
      { createClient, envGet: ENV },
    );
    assertEquals(response.status, 200);
    const userLookup = recorder.find((entry) => entry.table === "users");
    assertEquals(userLookup?.filters[0], { type: "eq", column: "id", value: TOKEN_USER_ID });
    assert(!JSON.stringify(recorder).includes(OTHER_USER_ID));
    // Only the caller's JWT client is created; no service-key client.
    assertEquals(calls.map((call) => call.key), ["anon-key"]);
  } finally {
    openai.restore();
  }
});

Deno.test("generate-email-content returns 200 for a member of the tenant", async () => {
  const { client, recorder } = authedClient({
    canAccess: true,
    extra: {
      "personas:select": {
        data: { name: "Weekend Gardener", description: "Busy", tone: "warm", sample_phrases: [], buying_triggers: [] },
        error: null,
      },
    },
  });
  const { createClient } = recordingCreateClient(client);
  const openai = stubOpenAI(BLOCK);
  try {
    const response = await handleGenerateEmailContent(
      generatorRequest({ prompt: "x", type: "email_block", persona: "Weekend Gardener", tenantId: OWN_TENANT_ID }),
      { createClient, envGet: ENV },
    );
    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.title, "Fall bulbs");
    const access = recorder.find((entry) => entry.table === "bloom_can_access_tenant");
    assertEquals((access?.payload as { p_tenant_id: string }).p_tenant_id, OWN_TENANT_ID);
    assert(recorder.some((entry) => entry.table === "personas"));
    assertEquals(openai.requests.length, 1);
  } finally {
    openai.restore();
  }
});
