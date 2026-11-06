import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  cleanupProductionE2E,
  deleteMarkedCampaignsWithClient,
  prepareProductionE2E,
  validateArtifactMarker,
} from "./production-e2e-state.mjs";

const EMAIL = "e2e@example.test";
const MARKER = "bloom-e2e-12345-1";

function fakeSupabase() {
  const state = {
    activeTenantId: "prior-tenant",
    campaigns: [],
    calls: [],
  };

  class Query {
    constructor(table) {
      this.table = table;
      this.action = null;
      this.filters = [];
      this.payload = null;
    }

    select(columns) {
      if (!this.action) this.action = "select";
      this.columns = columns;
      return this;
    }

    delete() {
      this.action = "delete";
      return this;
    }

    upsert(payload) {
      this.action = "upsert";
      this.payload = payload;
      return this;
    }

    eq(column, value) {
      this.filters.push([column, value]);
      return this;
    }

    limit() {
      return this;
    }

    maybeSingle() {
      this.single = true;
      return this;
    }

    then(resolve, reject) {
      return Promise.resolve(this.execute()).then(resolve, reject);
    }

    execute() {
      state.calls.push({
        table: this.table,
        action: this.action,
        filters: this.filters,
        payload: this.payload,
      });

      if (this.table === "app_admin_emails") {
        return { data: { email: EMAIL }, error: null };
      }
      if (this.table === "admin_session_context") {
        if (this.action === "upsert") {
          state.activeTenantId = this.payload.active_tenant_id;
          return { data: null, error: null };
        }
        return {
          data: { active_tenant_id: state.activeTenantId },
          error: null,
        };
      }
      if (this.table === "tenants") {
        return {
          data: [{ id: "greenfield", name: "Greenfield Garden Centre" }],
          error: null,
        };
      }
      if (this.table === "crm_campaigns") {
        const matches = (campaign) =>
          this.filters.every(([column, value]) => campaign[column] === value);
        if (this.action === "delete") {
          const deleted = state.campaigns.filter(matches);
          state.campaigns = state.campaigns.filter(
            (campaign) => !matches(campaign),
          );
          return {
            data: deleted.map(({ id }) => ({ id })),
            error: null,
          };
        }
        return {
          data: state.campaigns.filter(matches).map(({ id }) => ({ id })),
          error: null,
        };
      }
      throw new Error(`Unexpected table ${this.table}`);
    }
  }

  const client = {
    auth: {
      signInWithPassword: async () => ({
        data: { user: { id: "admin-user" } },
        error: null,
      }),
    },
    from: (table) => new Query(table),
  };
  return { client, state };
}

const clientFactoryFor = (client) => () => client;

test("validateArtifactMarker rejects a broad or unscoped cleanup key", () => {
  assert.equal(validateArtifactMarker(MARKER), MARKER);
  assert.throws(() => validateArtifactMarker("newsletter"), /bloom-e2e/);
  assert.throws(() => validateArtifactMarker("bloom-e2e-%"), /bloom-e2e/);
});

test("prepare and cleanup restore tenant context after an interrupted run", async () => {
  const directory = mkdtempSync(join(tmpdir(), "bloom-e2e-state-"));
  const statePath = join(directory, "state.json");
  const { client, state } = fakeSupabase();

  try {
    const snapshot = await prepareProductionE2E({
      email: EMAIL,
      password: "password",
      marker: MARKER,
      statePath,
      clientFactory: clientFactoryFor(client),
    });
    assert.equal(snapshot.previousTenantId, "prior-tenant");
    assert.equal(snapshot.targetTenantId, "greenfield");
    assert.equal(state.activeTenantId, "greenfield");

    state.campaigns.push(
      { id: "created-draft", name: MARKER, tenant_id: "greenfield" },
      {
        id: "customer-draft",
        name: "November newsletter",
        tenant_id: "greenfield",
      },
    );

    const result = await cleanupProductionE2E({
      email: EMAIL,
      password: "password",
      marker: MARKER,
      statePath,
      clientFactory: clientFactoryFor(client),
    });

    assert.deepEqual(result, { restored: true, deletedState: true });
    assert.equal(state.activeTenantId, "prior-tenant");
    assert.deepEqual(state.campaigns, [
      {
        id: "customer-draft",
        name: "November newsletter",
        tenant_id: "greenfield",
      },
    ]);
    const deleteCall = state.calls.find(
      (call) => call.table === "crm_campaigns" && call.action === "delete",
    );
    assert.deepEqual(deleteCall.filters, [
      ["name", MARKER],
      ["tenant_id", "greenfield"],
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("deleteMarkedCampaignsWithClient proves the expected draft was deleted", async () => {
  const { client, state } = fakeSupabase();
  state.campaigns.push({
    id: "created-draft",
    name: MARKER,
    tenant_id: "greenfield",
  });

  assert.deepEqual(
    await deleteMarkedCampaignsWithClient(client, {
      marker: MARKER,
      tenantId: "greenfield",
      expectedCampaignId: "created-draft",
    }),
    ["created-draft"],
  );
  assert.deepEqual(state.campaigns, []);
});
