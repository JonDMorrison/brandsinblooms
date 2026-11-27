import { assert, assertEquals } from "@std/assert";

import { handleGenerateNewsletter } from "../index.ts";
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

const CAMPAIGN_ID = "55555555-5555-4555-8555-555555555555";
const TASKS = {
  data: [
    {
      post_type: "blog",
      ai_output: "Divide hostas in early autumn.",
      campaigns: { title: "Autumn hostas", theme: "Perennials", description: "", week_number: 38 },
    },
  ],
  error: null,
};

Deno.test("generate-newsletter returns 401 without a token", async () => {
  const { client, recorder } = authedClient({ canAccess: true });
  const { createClient, calls } = recordingCreateClient(client);
  const openai = stubOpenAI("Newsletter");
  try {
    const response = await handleGenerateNewsletter(
      generatorRequest({ campaignId: CAMPAIGN_ID, userId: TOKEN_USER_ID }, null),
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

Deno.test("generate-newsletter returns 403 for a tenant the caller cannot access", async () => {
  const { client, recorder } = authedClient({ canAccess: false });
  const { createClient } = recordingCreateClient(client);
  const openai = stubOpenAI("Newsletter");
  try {
    const response = await handleGenerateNewsletter(
      generatorRequest({ campaignId: CAMPAIGN_ID, tenantId: OTHER_TENANT_ID }),
      { createClient, envGet: ENV },
    );
    assertEquals(response.status, 403);
    assert(!recorder.some((entry) => entry.table === "campaigns" || entry.table === "content_tasks"));
    assertEquals(openai.requests.length, 0);
  } finally {
    openai.restore();
  }
});

Deno.test("generate-newsletter ignores a body userId and acts as the token's user", async () => {
  const { client, recorder } = authedClient({
    canAccess: true,
    extra: {
      "campaigns:select": { data: { id: CAMPAIGN_ID }, error: null },
      "content_tasks:select": TASKS,
    },
  });
  const { createClient, calls } = recordingCreateClient(client);
  const openai = stubOpenAI("Newsletter");
  try {
    const response = await handleGenerateNewsletter(
      generatorRequest({ userId: OTHER_USER_ID, user_id: OTHER_USER_ID }),
      { createClient, envGet: ENV },
    );
    assertEquals(response.status, 200);
    const weekLookup = recorder.find((entry) => entry.table === "campaigns");
    assertEquals(weekLookup?.filters[0], { type: "eq", column: "user_id", value: TOKEN_USER_ID });
    assert(!JSON.stringify(recorder).includes(OTHER_USER_ID));
    assertEquals(calls.map((call) => call.key), ["anon-key"]);
  } finally {
    openai.restore();
  }
});

Deno.test("generate-newsletter returns 200 for a member of the tenant", async () => {
  const { client, recorder } = authedClient({
    canAccess: true,
    extra: {
      "campaigns:select": { data: { id: CAMPAIGN_ID }, error: null },
      "content_tasks:select": TASKS,
    },
  });
  const { createClient } = recordingCreateClient(client);
  const openai = stubOpenAI("Your autumn newsletter.");
  try {
    const response = await handleGenerateNewsletter(
      generatorRequest({ campaignId: CAMPAIGN_ID, tenantId: OWN_TENANT_ID }),
      { createClient, envGet: ENV },
    );
    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.content, "Your autumn newsletter.");
    // The named campaign is checked against the verified tenant.
    const campaignCheck = recorder.find((entry) => entry.table === "campaigns");
    assertEquals(campaignCheck?.filters, [
      { type: "eq", column: "id", value: CAMPAIGN_ID },
      { type: "eq", column: "tenant_id", value: OWN_TENANT_ID },
    ]);
    assertEquals(openai.requests.length, 1);
  } finally {
    openai.restore();
  }
});

Deno.test("generate-newsletter returns 404 for a campaign outside the tenant", async () => {
  const { client, recorder } = authedClient({
    canAccess: true,
    extra: { "campaigns:select": { data: null, error: null } },
  });
  const { createClient } = recordingCreateClient(client);
  const openai = stubOpenAI("Newsletter");
  try {
    const response = await handleGenerateNewsletter(
      generatorRequest({ campaignId: CAMPAIGN_ID }),
      { createClient, envGet: ENV },
    );
    assertEquals(response.status, 404);
    assert(!recorder.some((entry) => entry.table === "content_tasks"));
    assertEquals(openai.requests.length, 0);
  } finally {
    openai.restore();
  }
});
