export interface QueryResponse<T = unknown> {
  data?: T;
  error?: { message: string } | null;
}

export interface QueryRecorderEntry {
  table: string;
  operation: "select" | "insert" | "update" | "upsert" | "delete" | "rpc";
  payload?: unknown;
  filters: Array<{ type: string; column?: string; value?: unknown }>;
}

class MockQueryBuilder {
  private readonly filters: Array<{
    type: string;
    column?: string;
    value?: unknown;
  }> = [];

  constructor(
    private readonly table: string,
    private readonly operation: QueryRecorderEntry["operation"],
    private readonly payload: unknown,
    private readonly responses: Map<string, QueryResponse<unknown>[]>,
    private readonly recorder: QueryRecorderEntry[],
  ) {}

  select(_columns?: string) {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  in(column: string, value: unknown) {
    this.filters.push({ type: "in", column, value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ type: "is", column, value });
    return this;
  }

  order(column: string, value: unknown) {
    this.filters.push({ type: "order", column, value });
    return this;
  }

  limit(value: unknown) {
    this.filters.push({ type: "limit", value });
    return this;
  }

  maybeSingle() {
    return this.resolve();
  }

  single() {
    return this.resolve();
  }

  then<TResult1 = QueryResponse<unknown>, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResponse<unknown>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private resolve(): Promise<QueryResponse<unknown>> {
    this.recorder.push({
      table: this.table,
      operation: this.operation,
      payload: this.payload,
      filters: [...this.filters],
    });

    const key = `${this.table}:${this.operation}`;
    const queue = this.responses.get(key) ?? [];
    const next = queue.length > 0 ? queue.shift() : { data: null, error: null };
    this.responses.set(key, queue);
    return Promise.resolve(next as QueryResponse<unknown>);
  }
}

export function createMockSupabaseClient(
  seededResponses: Record<
    string,
    QueryResponse<unknown> | QueryResponse<unknown>[]
  >,
) {
  const responses = new Map<string, QueryResponse<unknown>[]>();
  for (const [key, value] of Object.entries(seededResponses)) {
    responses.set(key, Array.isArray(value) ? [...value] : [value]);
  }

  const recorder: QueryRecorderEntry[] = [];

  return {
    recorder,
    client: {
      auth: {
        getUser: async (_token?: string) => {
          const queue = responses.get("auth:getUser") ?? [];
          const next =
            queue.length > 0
              ? queue.shift()
              : { data: { user: null }, error: null };
          responses.set("auth:getUser", queue);
          recorder.push({
            table: "auth",
            operation: "rpc",
            payload: { method: "getUser" },
            filters: [],
          });
          return next as QueryResponse<{ user: unknown }>;
        },
      },
      from(table: string) {
        return {
          select: (_columns?: string) =>
            new MockQueryBuilder(
              table,
              "select",
              undefined,
              responses,
              recorder,
            ),
          insert: (payload: unknown) =>
            new MockQueryBuilder(table, "insert", payload, responses, recorder),
          update: (payload: unknown) =>
            new MockQueryBuilder(table, "update", payload, responses, recorder),
          upsert: (payload: unknown, _options?: unknown) =>
            new MockQueryBuilder(table, "upsert", payload, responses, recorder),
          delete: () =>
            new MockQueryBuilder(
              table,
              "delete",
              undefined,
              responses,
              recorder,
            ),
        };
      },
      rpc(name: string, payload?: unknown) {
        recorder.push({ table: name, operation: "rpc", payload, filters: [] });
        const queue = responses.get(`rpc:${name}`) ?? [];
        const next =
          queue.length > 0 ? queue.shift() : { data: null, error: null };
        responses.set(`rpc:${name}`, queue);
        return Promise.resolve(next as QueryResponse<unknown>);
      },
      functions: {
        invoke: async (name: string, payload?: unknown) => {
          recorder.push({
            table: `functions:${name}`,
            operation: "rpc",
            payload,
            filters: [],
          });
          const queue = responses.get(`functions:${name}`) ?? [];
          const next =
            queue.length > 0 ? queue.shift() : { data: null, error: null };
          responses.set(`functions:${name}`, queue);
          return next as QueryResponse<unknown>;
        },
      },
    },
  };
}

export function jsonRequest(
  url: string,
  body: unknown,
  init: RequestInit = {},
): Request {
  const headers = new Headers(init.headers ?? {});
  headers.set("Content-Type", "application/json");
  return new Request(url, {
    ...init,
    method: init.method ?? "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export function makeEnv(entries: Record<string, string>) {
  return (key: string): string | undefined => entries[key];
}
