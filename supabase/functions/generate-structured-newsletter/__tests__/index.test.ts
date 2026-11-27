import { assert, assertEquals } from "@std/assert";

import { handleGenerateStructuredNewsletter } from "../index.ts";
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

const BODY = { theme: "Seed saving", week_focus: "Collect and store seeds" };

const YAML = "newsletter_md: Seed saving made simple";

function deps(createClient: (url: string, key: string) => unknown) {
  return { createClient, envGet: ENV };
}

Deno.test("generate-structured-newsletter returns 401 without a token", async () => {
  const { client, recorder } = authedClient({ canAccess: true });
  const { createClient, calls } = recordingCreateClient(client);
  const openai = stubOpenAI("", { yamlContent: YAML, overviewKeywords: ["seed packets"] }, "generate_newsletter_content");
  try {
    const response = await handleGenerateStructuredNewsletter(generatorRequest(BODY, null), deps(createClient));
    assertEquals(response.status, 401);
    assertEquals(calls.length, 0);
    assertEquals(recorder.length, 0);
    assertEquals(openai.requests.length, 0);
  } finally {
    openai.restore();
  }
});

Deno.test("generate-structured-newsletter returns 401 for an invalid token", async () => {
  const { client, recorder } = authedClient({ canAccess: true, userId: null });
  const { createClient, calls } = recordingCreateClient(client);
  const openai = stubOpenAI("", { yamlContent: YAML, overviewKeywords: ["seed packets"] }, "generate_newsletter_content");
  try {
    const response = await handleGenerateStructuredNewsletter(generatorRequest(BODY), deps(createClient));
    assertEquals(response.status, 401);
    assertEquals(calls.map((call) => call.key), ["anon-key"]);
    assert(!recorder.some((entry) => entry.table !== "auth"));
    assertEquals(openai.requests.length, 0);
  } finally {
    openai.restore();
  }
});

Deno.test("generate-structured-newsletter returns 403 for a tenant the caller cannot access", async () => {
  const { client, recorder } = authedClient({ canAccess: false });
  const { createClient, calls } = recordingCreateClient(client);
  const openai = stubOpenAI("", { yamlContent: YAML, overviewKeywords: ["seed packets"] }, "generate_newsletter_content");
  try {
    const response = await handleGenerateStructuredNewsletter(
      generatorRequest({ ...BODY, tenantId: OTHER_TENANT_ID }),
      deps(createClient),
    );
    assertEquals(response.status, 403);
    const access = recorder.find((entry) => entry.table === "bloom_can_access_tenant");
    assertEquals((access?.payload as { p_tenant_id: string }).p_tenant_id, OTHER_TENANT_ID);
    // Nothing is read, and no service-key client exists, before the check passes.
    assertEquals(calls.map((call) => call.key), ["anon-key"]);
    assert(!recorder.some((entry) => !["auth", "bloom_can_access_tenant"].includes(entry.table)));
    assertEquals(openai.requests.length, 0);
  } finally {
    openai.restore();
  }
});

Deno.test("generate-structured-newsletter ignores a body userId and acts as the token's user", async () => {
  const { client, recorder } = authedClient({ canAccess: true, extra: { "company_profiles:select": { data: { company_name: "Lacoste Garden Centre" }, error: null } } });
  const { createClient } = recordingCreateClient(client);
  const openai = stubOpenAI("", { yamlContent: YAML, overviewKeywords: ["seed packets"] }, "generate_newsletter_content");
  try {
    const response = await handleGenerateStructuredNewsletter(
      generatorRequest({ ...BODY, userId: OTHER_USER_ID, user_id: OTHER_USER_ID }),
      deps(createClient),
    );
    assertEquals(response.status, 200);
    // The tenant comes from the token user's own users row.
    const userLookup = recorder.find((entry) => entry.table === "users");
    assertEquals(userLookup?.filters[0], { type: "eq", column: "id", value: TOKEN_USER_ID });
    const access = recorder.find((entry) => entry.table === "bloom_can_access_tenant");
    assertEquals((access?.payload as { p_tenant_id: string }).p_tenant_id, OWN_TENANT_ID);
    const profileLookup = recorder.find((entry) => entry.table === "profile_user_id_for");
    assertEquals((profileLookup?.payload as { p_user_id: string }).p_user_id, TOKEN_USER_ID);
    const profileRead = recorder.find((entry) => entry.table === "company_profiles");
    assertEquals(profileRead?.filters[0], { type: "eq", column: "user_id", value: TOKEN_USER_ID });
    assert(!JSON.stringify(recorder).includes(OTHER_USER_ID));
  } finally {
    openai.restore();
  }
});

Deno.test("generate-structured-newsletter returns 200 for a member of the tenant", async () => {
  const { client, recorder } = authedClient({ canAccess: true, extra: { "company_profiles:select": { data: { company_name: "Lacoste Garden Centre" }, error: null } } });
  const { createClient, calls } = recordingCreateClient(client);
  const openai = stubOpenAI("", { yamlContent: YAML, overviewKeywords: ["seed packets"] }, "generate_newsletter_content");
  try {
    const response = await handleGenerateStructuredNewsletter(
      generatorRequest({ ...BODY, tenantId: OWN_TENANT_ID }),
      deps(createClient),
    );
    assertEquals(response.status, 200);
    const access = recorder.find((entry) => entry.table === "bloom_can_access_tenant");
    assertEquals((access?.payload as { p_tenant_id: string }).p_tenant_id, OWN_TENANT_ID);
    // The tenant named in the body is used; the users row is not consulted.
    assert(!recorder.some((entry) => entry.table === "users"));
    const body = await response.json();
    assertEquals(body.yamlContent, YAML);
    // Service key: only for profile_user_id_for, after the checks.
    assertEquals(calls.map((call) => call.key), ["anon-key", "service-role-key"]);
    assertEquals(openai.requests.length, 1);
  } finally {
    openai.restore();
  }
});
