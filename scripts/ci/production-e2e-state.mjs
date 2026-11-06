import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://udldmkqwnxhdeztyqcau.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_iKrafIfqem0wBWT51FqNpQ_KBHmF2El";
const DEFAULT_TENANT = "Greenfield Garden Centre";
const DEFAULT_STATE_FILE = "e2e/.auth/production-e2e-state.json";
const MARKER_PATTERN = /^bloom-e2e-[a-z0-9][a-z0-9-]{5,80}$/;

function assertRequired(value, name) {
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

export function validateArtifactMarker(value) {
  const marker = assertRequired(value, "E2E_ARTIFACT_MARKER");
  if (!MARKER_PATTERN.test(marker)) {
    throw new Error(
      "E2E_ARTIFACT_MARKER must be a lowercase bloom-e2e-* identifier",
    );
  }
  return marker;
}

function stateFilePath(value) {
  return resolve(value || DEFAULT_STATE_FILE);
}

function writeState(path, state) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(state)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporaryPath, path);
}

function readState(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function removeState(path) {
  rmSync(path, { force: true });
}

function assertQuery(result, label) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data;
}

async function authenticatedClient({
  email,
  password,
  clientFactory = createClient,
}) {
  const normalizedEmail = assertRequired(email, "E2E_EMAIL");
  const normalizedPassword = assertRequired(password, "E2E_PASSWORD");
  const client = clientFactory(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const result = await client.auth.signInWithPassword({
    email: normalizedEmail,
    password: normalizedPassword,
  });
  if (result.error || !result.data.user) {
    throw new Error(
      `Production E2E authentication failed: ${result.error?.message ?? "missing user"}`,
    );
  }
  return { client, user: result.data.user, email: normalizedEmail };
}

async function assertMasterAdmin(client, email) {
  const result = await client
    .from("app_admin_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  const row = assertQuery(result, "Could not verify the E2E administrator");
  if (!row) {
    throw new Error(
      "E2E_EMAIL is not registered as a BloomSuite administrator",
    );
  }
}

async function setAdminContext(client, userId, tenantId) {
  const write = await client.from("admin_session_context").upsert(
    {
      admin_user_id: userId,
      active_tenant_id: tenantId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "admin_user_id" },
  );
  assertQuery(write, "Could not save the production E2E tenant context");

  const verify = await client
    .from("admin_session_context")
    .select("active_tenant_id")
    .eq("admin_user_id", userId)
    .maybeSingle();
  const row = assertQuery(
    verify,
    "Could not verify the production E2E tenant context",
  );
  if ((row?.active_tenant_id ?? null) !== tenantId) {
    throw new Error("Production E2E tenant context verification failed");
  }
}

export async function deleteMarkedCampaignsWithClient(
  client,
  { marker, tenantId = null, expectedCampaignId = null },
) {
  const safeMarker = validateArtifactMarker(marker);
  let deletion = client.from("crm_campaigns").delete().eq("name", safeMarker);
  if (tenantId) deletion = deletion.eq("tenant_id", tenantId);
  const deleted = assertQuery(
    await deletion.select("id"),
    "Could not delete production E2E newsletter drafts",
  );
  const deletedIds = (deleted ?? []).map((row) => row.id);

  if (expectedCampaignId && !deletedIds.includes(expectedCampaignId)) {
    throw new Error(
      `Production E2E campaign ${expectedCampaignId} was not deleted`,
    );
  }

  let remainingQuery = client
    .from("crm_campaigns")
    .select("id")
    .eq("name", safeMarker);
  if (tenantId) remainingQuery = remainingQuery.eq("tenant_id", tenantId);
  const remaining = assertQuery(
    await remainingQuery,
    "Could not verify production E2E newsletter cleanup",
  );
  if ((remaining ?? []).length > 0) {
    throw new Error("Production E2E newsletter drafts remain after cleanup");
  }

  return deletedIds;
}

export async function deleteMarkedCampaigns({
  email,
  password,
  marker,
  tenantId = null,
  expectedCampaignId = null,
  clientFactory,
}) {
  const { client, email: normalizedEmail } = await authenticatedClient({
    email,
    password,
    clientFactory,
  });
  await assertMasterAdmin(client, normalizedEmail);
  return deleteMarkedCampaignsWithClient(client, {
    marker,
    tenantId,
    expectedCampaignId,
  });
}

export async function prepareProductionE2E({
  email,
  password,
  marker,
  tenantName = DEFAULT_TENANT,
  statePath = DEFAULT_STATE_FILE,
  clientFactory,
}) {
  const safeMarker = validateArtifactMarker(marker);
  const path = stateFilePath(statePath);
  if (readState(path)) {
    throw new Error(
      "A production E2E tenant snapshot already exists; cleanup must run first",
    );
  }

  const {
    client,
    user,
    email: normalizedEmail,
  } = await authenticatedClient({
    email,
    password,
    clientFactory,
  });
  await assertMasterAdmin(client, normalizedEmail);

  const currentContext = assertQuery(
    await client
      .from("admin_session_context")
      .select("active_tenant_id")
      .eq("admin_user_id", user.id)
      .maybeSingle(),
    "Could not read the existing E2E tenant context",
  );
  const tenants = assertQuery(
    await client
      .from("tenants")
      .select("id, name")
      .eq("name", tenantName)
      .limit(2),
    "Could not resolve the production E2E tenant",
  );
  if (tenants?.length !== 1) {
    throw new Error(
      `Expected exactly one production E2E tenant named ${tenantName}`,
    );
  }

  const state = {
    version: 1,
    marker: safeMarker,
    adminUserId: user.id,
    previousTenantId: currentContext?.active_tenant_id ?? null,
    targetTenantId: tenants[0].id,
  };
  writeState(path, state);
  await setAdminContext(client, user.id, state.targetTenantId);
  return state;
}

export async function cleanupProductionE2E({
  email,
  password,
  marker,
  statePath = DEFAULT_STATE_FILE,
  clientFactory,
}) {
  const safeMarker = validateArtifactMarker(marker);
  const path = stateFilePath(statePath);
  const state = readState(path);
  const {
    client,
    user,
    email: normalizedEmail,
  } = await authenticatedClient({
    email,
    password,
    clientFactory,
  });
  await assertMasterAdmin(client, normalizedEmail);

  if (!state) {
    await deleteMarkedCampaignsWithClient(client, { marker: safeMarker });
    return { restored: false, deletedState: false };
  }
  if (
    state.version !== 1 ||
    state.marker !== safeMarker ||
    state.adminUserId !== user.id ||
    !state.targetTenantId
  ) {
    throw new Error("Production E2E tenant snapshot does not match this run");
  }

  let cleanupError = null;
  let restoreError = null;
  try {
    await setAdminContext(client, user.id, state.targetTenantId);
    await deleteMarkedCampaignsWithClient(client, {
      marker: safeMarker,
      tenantId: state.targetTenantId,
    });
  } catch (error) {
    cleanupError = error;
  } finally {
    try {
      await setAdminContext(client, user.id, state.previousTenantId ?? null);
    } catch (error) {
      restoreError = error;
    }
  }

  if (cleanupError || restoreError) {
    const failures = [cleanupError, restoreError]
      .filter(Boolean)
      .map((error) => (error instanceof Error ? error.message : String(error)))
      .join("; ");
    throw new Error(`Production E2E cleanup did not complete: ${failures}`);
  }

  removeState(path);
  return { restored: true, deletedState: true };
}

async function main() {
  const command = process.argv[2];
  const options = {
    email: process.env.E2E_EMAIL,
    password: process.env.E2E_PASSWORD,
    marker: process.env.E2E_ARTIFACT_MARKER,
    statePath: process.env.E2E_STATE_FILE || DEFAULT_STATE_FILE,
  };

  if (command === "prepare") {
    await prepareProductionE2E(options);
    console.log("Production E2E tenant context is ready.");
    return;
  }
  if (command === "cleanup") {
    await cleanupProductionE2E(options);
    console.log(
      "Production E2E artifacts are removed and tenant context is restored.",
    );
    return;
  }
  throw new Error("Usage: production-e2e-state.mjs <prepare|cleanup>");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
