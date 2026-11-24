/**
 * BloomSuite CRM public showroom: an in-memory stand-in for the Supabase client.
 *
 * The showroom build aliases "@/integrations/supabase/client" to this module, so the
 * real CRM screens run against synthetic garden-centre data held in the visitor's
 * browser. There is no network client, URL or key in the showroom bundle.
 * Writes are kept in sessionStorage for this tab only; Reset demo clears them.
 */
export type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
type Result = { data: unknown; error: { message: string; code?: string } | null; count?: number | null; status?: number; statusText?: string };
export type RpcHandler = (args: Record<string, unknown>, db: ShowroomDatabase) => unknown;

const WRITE_LOG_KEY = "bloomsuite-crm-showroom-writes-v1";

export const DEMO_BLOCKED = "This is a demo. Nothing is sent, published or uploaded from the showroom.";

function uuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `demo-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

function getPath(row: Row, column: string): unknown {
  // "metadata->>source" / "metadata->source"
  const json = column.split(/->>?/);
  let value: unknown = row[json[0].trim()];
  for (const key of json.slice(1)) value = value && typeof value === "object" ? (value as Row)[key.trim().replace(/^'|'$/g, "")] : undefined;
  return value;
}

function likeToRegExp(pattern: string, insensitive: boolean): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, insensitive ? "is" : "s");
}

function parseValue(raw: string): unknown {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw.replace(/^"|"$/g, "");
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function jsonContains(haystack: unknown, needle: unknown): boolean {
  if (Array.isArray(needle)) return Array.isArray(haystack) && needle.every(item => haystack.some(h => jsonContains(h, item)));
  if (needle && typeof needle === "object") return !!haystack && typeof haystack === "object" && Object.entries(needle as Row).every(([k, v]) => jsonContains((haystack as Row)[k], v));
  return haystack === needle;
}

export function matches(row: Row, column: string, op: string, value: unknown): boolean {
  const actual = getPath(row, column);
  switch (op) {
    case "eq": return actual === value || (actual !== null && actual !== undefined && String(actual) === String(value));
    case "neq": return !(actual === value || String(actual) === String(value));
    case "gt": return actual !== null && actual !== undefined && compare(actual, value) > 0;
    case "gte": return actual !== null && actual !== undefined && compare(actual, value) >= 0;
    case "lt": return actual !== null && actual !== undefined && compare(actual, value) < 0;
    case "lte": return actual !== null && actual !== undefined && compare(actual, value) <= 0;
    case "like": return typeof actual === "string" && likeToRegExp(String(value), false).test(actual);
    case "ilike": return typeof actual === "string" && likeToRegExp(String(value), true).test(actual);
    case "is": return value === null ? actual === null || actual === undefined : actual === value;
    case "in": {
      const list = Array.isArray(value) ? value : String(value).replace(/^\(|\)$/g, "").split(",").map(v => parseValue(v.trim()));
      return list.some(item => item === actual || String(item) === String(actual));
    }
    case "cs": case "contains": return jsonContains(actual, typeof value === "string" ? parseArrayLiteral(value) : value);
    case "cd": case "containedBy": return Array.isArray(actual) && Array.isArray(value) && actual.every(item => value.includes(item));
    case "ov": case "overlaps": { const list = typeof value === "string" ? parseArrayLiteral(value) as unknown[] : value as unknown[]; return Array.isArray(actual) && Array.isArray(list) && actual.some(item => list.includes(item)); }
    case "fts": case "plfts": case "phfts": case "wfts": return typeof actual === "string" && actual.toLowerCase().includes(String(value).toLowerCase().replace(/[':&|!]/g, " ").trim().split(/\s+/)[0] ?? "");
    default: return true;
  }
}

function parseArrayLiteral(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}") && !trimmed.includes(":")) return trimmed.slice(1, -1).split(",").filter(Boolean).map(v => parseValue(v.trim()));
  try { return JSON.parse(trimmed); } catch { return value; }
}

type Predicate = (row: Row) => boolean;

/** PostgREST "or" filter strings, e.g. "first_name.ilike.%sam%,email.ilike.%sam%" or "and(a.eq.1,b.gt.2)". */
export function parseLogic(expression: string, join: "or" | "and"): Predicate {
  const parts: string[] = [];
  let depth = 0, current = "";
  for (const char of expression) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) { parts.push(current); current = ""; continue; }
    current += char;
  }
  if (current) parts.push(current);
  const predicates: Predicate[] = parts.map(part => {
    const p = part.trim();
    const nested = p.match(/^(not\.)?(and|or)\((.*)\)$/s);
    if (nested) { const inner = parseLogic(nested[3], nested[2] as "and" | "or"); return nested[1] ? row => !inner(row) : inner; }
    const segments = p.split(".");
    const column = segments.shift() ?? "";
    let negate = false;
    if (segments[0] === "not") { negate = true; segments.shift(); }
    const op = segments.shift() ?? "eq";
    const raw = segments.join(".");
    const value = op === "in" ? raw : op === "is" ? parseValue(raw) : parseValue(raw);
    return row => negate !== matches(row, column, op, value);
  });
  return row => join === "or" ? predicates.some(p => p(row)) : predicates.every(p => p(row));
}

/** Column list for a select; embedded resources (name(...)) come back as empty lists. */
function parseSelect(columns: string | undefined): { all: boolean; fields: { alias: string; source: string }[]; embeds: { alias: string; countOnly: boolean }[] } {
  const text = (columns ?? "*").replace(/\s+/g, "");
  const fields: { alias: string; source: string }[] = [];
  const embeds: { alias: string; countOnly: boolean }[] = [];
  let all = false, depth = 0, current = "";
  const flush = () => {
    if (!current) return;
    const embed = current.match(/^(?:(\w+):)?(\w+)(?:!\w+)?\((.*)\)$/);
    if (embed) embeds.push({ alias: embed[1] ?? embed[2], countOnly: embed[3] === "count" });
    else if (current === "*") all = true;
    else {
      const [left, right] = current.includes(":") ? current.split(":") : [current, current];
      const source = (right ?? left).split("::")[0];
      fields.push({ alias: left === source || !current.includes(":") ? source.split(/->>?/).pop()! : left, source });
    }
    current = "";
  };
  for (const char of text) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) { flush(); continue; }
    current += char;
  }
  flush();
  if (!fields.length && !embeds.length) all = true;
  return { all, fields, embeds };
}

function project(row: Row, columns: string | undefined): Row {
  const { all, fields, embeds } = parseSelect(columns);
  const out: Row = all ? { ...row } : {};
  for (const field of fields) out[field.alias] = getPath(row, field.source) ?? null;
  for (const embed of embeds) if (!(embed.alias in out)) out[embed.alias] = embed.countOnly ? [{ count: 0 }] : [];
  return out;
}

export class ShowroomDatabase {
  tables: Tables;
  rpcs: Record<string, RpcHandler>;
  private log: { table: string; op: string; rows?: Row[]; ids?: string[]; patch?: Row }[] = [];

  constructor(seed: Tables, rpcs: Record<string, RpcHandler>) {
    this.tables = structuredClone(seed);
    this.rpcs = rpcs;
    this.replay();
  }

  table(name: string): Row[] { return (this.tables[name] ??= []); }

  private replay() {
    try {
      const saved = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(WRITE_LOG_KEY) : null;
      if (!saved) return;
      for (const entry of JSON.parse(saved) as ShowroomDatabase["log"]) this.apply(entry, false);
    } catch { /* A damaged log only means the visitor starts fresh. */ }
  }

  apply(entry: ShowroomDatabase["log"][number], remember = true) {
    const rows = this.table(entry.table);
    if (entry.op === "insert" && entry.rows) for (const row of entry.rows) { const at = rows.findIndex(r => r.id !== undefined && r.id === row.id); if (at >= 0) rows[at] = { ...rows[at], ...row }; else rows.unshift(row); }
    if (entry.op === "update" && entry.ids && entry.patch) for (const row of rows) if (entry.ids.includes(String(row.id))) Object.assign(row, entry.patch);
    if (entry.op === "delete" && entry.ids) this.tables[entry.table] = rows.filter(row => !entry.ids!.includes(String(row.id)));
    if (!remember) return;
    this.log.push(entry);
    try { sessionStorage.setItem(WRITE_LOG_KEY, JSON.stringify(this.log.slice(-400))); } catch { /* Storage full: the change still applies until reload. */ }
  }
}

export class QueryBuilder implements PromiseLike<Result> {
  private filters: Predicate[] = [];
  private orders: { column: string; ascending: boolean; nullsFirst?: boolean }[] = [];
  private from = 0;
  private to: number | null = null;
  private columns: string | undefined = "*";
  private returning = false;
  private countMode: string | null = null;
  private head = false;
  private cardinality: "many" | "single" | "maybe" = "many";
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | null = null;
  private conflict: string | undefined;

  constructor(private readonly db: ShowroomDatabase, private readonly name: string) {}

  select(columns = "*", options: { count?: string; head?: boolean } = {}) {
    this.columns = columns;
    if (this.op !== "select") this.returning = true;
    if (options.count) this.countMode = options.count;
    if (options.head) this.head = true;
    return this;
  }
  insert(values: Row | Row[]) { this.op = "insert"; this.payload = values; return this; }
  upsert(values: Row | Row[], options: { onConflict?: string } = {}) { this.op = "upsert"; this.payload = values; this.conflict = options.onConflict; return this; }
  update(values: Row) { this.op = "update"; this.payload = values; return this; }
  delete() { this.op = "delete"; return this; }

  private add(column: string, op: string, value: unknown) { this.filters.push(row => matches(row, column, op, value)); return this; }
  eq(c: string, v: unknown) { return this.add(c, "eq", v); }
  neq(c: string, v: unknown) { return this.add(c, "neq", v); }
  gt(c: string, v: unknown) { return this.add(c, "gt", v); }
  gte(c: string, v: unknown) { return this.add(c, "gte", v); }
  lt(c: string, v: unknown) { return this.add(c, "lt", v); }
  lte(c: string, v: unknown) { return this.add(c, "lte", v); }
  like(c: string, v: unknown) { return this.add(c, "like", v); }
  ilike(c: string, v: unknown) { return this.add(c, "ilike", v); }
  likeAnyOf(c: string, v: string[]) { this.filters.push(row => v.some(p => matches(row, c, "like", p))); return this; }
  ilikeAnyOf(c: string, v: string[]) { this.filters.push(row => v.some(p => matches(row, c, "ilike", p))); return this; }
  is(c: string, v: unknown) { return this.add(c, "is", v); }
  in(c: string, v: unknown[]) { return this.add(c, "in", v); }
  contains(c: string, v: unknown) { return this.add(c, "contains", v); }
  containedBy(c: string, v: unknown) { return this.add(c, "containedBy", v); }
  overlaps(c: string, v: unknown) { return this.add(c, "overlaps", v); }
  textSearch(c: string, v: string) { return this.add(c, "fts", v); }
  match(query: Row) { for (const [k, v] of Object.entries(query)) this.add(k, "eq", v); return this; }
  not(c: string, op: string, v: unknown) { this.filters.push(row => !matches(row, c, op, op === "in" ? v : v)); return this; }
  or(expression: string) { this.filters.push(parseLogic(expression, "or")); return this; }
  filter(c: string, op: string, v: unknown) { return this.add(c, op, v); }
  order(column: string, options: { ascending?: boolean; nullsFirst?: boolean; foreignTable?: string; referencedTable?: string } = {}) {
    if (!options.foreignTable && !options.referencedTable) this.orders.push({ column, ascending: options.ascending ?? true, nullsFirst: options.nullsFirst });
    return this;
  }
  limit(count: number, options: { foreignTable?: string; referencedTable?: string } = {}) { if (!options.foreignTable && !options.referencedTable) this.to = this.from + count - 1; return this; }
  range(from: number, to: number) { this.from = from; this.to = to; return this; }
  single() { this.cardinality = "single"; return this; }
  maybeSingle() { this.cardinality = "maybe"; return this; }
  abortSignal() { return this; }
  returns() { return this; }
  throwOnError() { return this; }
  csv() { return this; }
  explain() { return this; }
  overrideTypes() { return this; }

  private selected(): Row[] { return this.db.table(this.name).filter(row => this.filters.every(f => f(row))); }

  private execute(): Result {
    const now = new Date().toISOString();
    if (this.op === "insert" || this.op === "upsert") {
      const input = (Array.isArray(this.payload) ? this.payload : [this.payload ?? {}]) as Row[];
      const existing = this.db.table(this.name);
      const keys = this.conflict?.split(",").map(k => k.trim());
      const rows = input.map(values => {
        const match = this.op === "upsert" ? existing.find(row => keys ? keys.every(k => row[k] === values[k]) : row.id !== undefined && row.id === values.id) : undefined;
        return match ? { ...match, ...values, updated_at: now } : { id: uuid(), created_at: now, updated_at: now, ...values };
      });
      this.db.apply({ table: this.name, op: "insert", rows });
      return this.finish(rows);
    }
    if (this.op === "update") {
      const rows = this.selected();
      const patch = { ...(this.payload as Row), updated_at: (this.payload as Row)?.updated_at ?? now };
      this.db.apply({ table: this.name, op: "update", ids: rows.map(r => String(r.id)), patch });
      return this.finish(rows.map(r => ({ ...r, ...patch })));
    }
    if (this.op === "delete") {
      const rows = this.selected();
      this.db.apply({ table: this.name, op: "delete", ids: rows.map(r => String(r.id)) });
      return this.finish(rows);
    }
    let rows = this.selected();
    for (const order of [...this.orders].reverse()) {
      rows = [...rows].sort((a, b) => {
        const x = getPath(a, order.column), y = getPath(b, order.column);
        if ((x === null || x === undefined) !== (y === null || y === undefined)) return (x === null || x === undefined) === !!order.nullsFirst ? -1 : 1;
        return order.ascending ? compare(x, y) : compare(y, x);
      });
    }
    const total = rows.length;
    rows = rows.slice(this.from, this.to === null ? undefined : this.to + 1);
    if (this.head) return { data: null, error: null, count: total, status: 200 };
    return this.finish(rows, total);
  }

  private finish(rows: Row[], total = rows.length): Result {
    const writing = this.op !== "select";
    const data = writing && !this.returning ? null : rows.map(row => project(row, this.columns));
    const count = this.countMode ? total : null;
    if (this.cardinality === "many" || data === null) return { data, error: null, count, status: writing ? 201 : 200 };
    const list = data as Row[];
    if (list.length === 1) return { data: list[0], error: null, count, status: 200 };
    if (list.length === 0 && this.cardinality === "maybe") return { data: null, error: null, count, status: 200 };
    return { data: null, error: { message: list.length ? "More than one row returned" : "No rows found", code: "PGRST116" }, count, status: 406 };
  }

  then<A = Result, B = never>(resolve?: ((value: Result) => A | PromiseLike<A>) | null, reject?: ((reason: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
    return new Promise<Result>(done => setTimeout(() => done(this.execute()), 0)).then(resolve, reject);
  }
}
