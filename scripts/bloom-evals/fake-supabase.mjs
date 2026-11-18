// A minimal in-memory stand-in for the parts of supabase-js the eval seeder and
// runner use. Test-only. Supports from().select/insert/update/delete with
// eq/gte filters, single/maybeSingle, auth.admin.createUser/updateUserById,
// and rpc. createUser mimics the handle_new_user_signup trigger: it creates a
// tenant named after user_metadata.company_name and a users row with role admin.

import { randomUUID } from "node:crypto";

/** @param {Record<string, unknown[]>} [initial] */
export function createFakeSupabase(initial = {}) {
  /** @type {Record<string, Record<string, unknown>[]>} */
  const tables = { users: [], tenants: [], ...structuredClone(initial) };
  const calls = [];

  const table = (name) => (tables[name] ??= []);

  function query(name) {
    /** @type {Array<(row: Record<string, unknown>) => boolean>} */
    const filters = [];
    let action = "select";
    /** @type {unknown} */
    let payload = null;
    let returnRows = false;

    const matches = (row) => filters.every((filter) => filter(row));

    const execute = () => {
      calls.push({ table: name, action, payload });
      if (action === "insert") {
        const rows = (Array.isArray(payload) ? payload : [payload]).map((row) => ({ id: randomUUID(), ...row }));
        table(name).push(...rows);
        return { data: returnRows ? rows : null, error: null };
      }
      if (action === "update") {
        for (const row of table(name).filter(matches)) Object.assign(row, payload);
        return { data: null, error: null };
      }
      if (action === "delete") {
        tables[name] = table(name).filter((row) => !matches(row));
        return { data: null, error: null };
      }
      return { data: table(name).filter(matches), error: null };
    };

    const builder = {
      select() {
        if (action === "insert") returnRows = true;
        return builder;
      },
      insert(rows) {
        action = "insert";
        payload = rows;
        return builder;
      },
      update(values) {
        action = "update";
        payload = values;
        return builder;
      },
      delete() {
        action = "delete";
        return builder;
      },
      eq(column, value) {
        filters.push((row) => row[column] === value);
        return builder;
      },
      gte(column, value) {
        filters.push((row) => String(row[column] ?? "") >= String(value));
        return builder;
      },
      async single() {
        const { data } = execute();
        const rows = /** @type {unknown[]} */ (data);
        return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: `expected 1 row, got ${rows.length}` } };
      },
      async maybeSingle() {
        const { data } = execute();
        return { data: /** @type {unknown[]} */ (data)[0] ?? null, error: null };
      },
      then(resolve, reject) {
        return Promise.resolve(execute()).then(resolve, reject);
      },
    };
    return builder;
  }

  const client = {
    tables,
    calls,
    from: (name) => query(name),
    rpc: async (name, args) => {
      calls.push({ table: `rpc:${name}`, action: "rpc", payload: args });
      if (name === "bloom_chat_spend_status") {
        return { data: { month: "2026-11", committed_micros: 1_000_000, cap_micros: 25_000_000 }, error: null };
      }
      return { data: null, error: { message: `unknown rpc ${name}` } };
    },
    auth: {
      admin: {
        async createUser({ email, user_metadata }) {
          const tenantId = randomUUID();
          table("tenants").push({ id: tenantId, name: user_metadata?.company_name ?? email.split("@")[0] });
          const id = randomUUID();
          table("users").push({ id, email, name: user_metadata?.full_name ?? email, role: "admin", tenant_id: tenantId });
          calls.push({ table: "auth", action: "createUser", payload: email });
          return { data: { user: { id, email } }, error: null };
        },
        async updateUserById(id) {
          calls.push({ table: "auth", action: "updateUserById", payload: id });
          return { data: { user: { id } }, error: null };
        },
      },
    },
  };
  return client;
}
