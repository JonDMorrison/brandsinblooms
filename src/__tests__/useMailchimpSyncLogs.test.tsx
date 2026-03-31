import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
const removeChannelMock = vi.fn();
const channelMock = vi.fn();

type TestImportJob = {
  id: string;
  tenant_id: string;
  provider: string;
  status: string;
  config: unknown;
  report: unknown;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  progress_percentage: number | null;
  current_stage: string | null;
  estimated_completion_at: string | null;
  error_details: unknown;
  batch_stats: unknown;
  current_page?: number | null;
  total_pages_est?: number | null;
  fetched_rows?: number | null;
  inserted_rows?: number | null;
  skipped_rows?: number | null;
  failed_rows?: number | null;
};

type TestArtifact = {
  tenant_id: string;
  provider: string;
  artifact_type: string;
  external_id: string;
  name: string | null;
  data: unknown;
};

let importJobs: TestImportJob[] = [];
let artifacts: TestArtifact[] = [];
let realtimeCallback:
  | ((payload: { eventType: string; new?: unknown; old?: unknown }) => void)
  | null = null;

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "owner@example.com" },
  }),
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({
    tenant: { id: "tenant-1" },
  }),
}));

function createQueryBuilder(table: string) {
  const state: {
    eq: Record<string, unknown>;
    in: Record<string, unknown[]>;
    gte: Record<string, string>;
    range: [number, number] | null;
    maybeSingle: boolean;
    selectError?: { code: string; message: string } | null;
  } = {
    eq: {},
    in: {},
    gte: {},
    range: null,
    maybeSingle: false,
    selectError: undefined,
  };

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      state.eq[column] = value;
      return builder;
    }),
    in: vi.fn((column: string, value: unknown[]) => {
      state.in[column] = value;
      return builder;
    }),
    gte: vi.fn((column: string, value: string) => {
      state.gte[column] = value;
      return builder;
    }),
    order: vi.fn(() => builder),
    range: vi.fn((start: number, end: number) => {
      state.range = [start, end];
      return builder;
    }),
    maybeSingle: vi.fn(() => {
      state.maybeSingle = true;
      return builder;
    }),
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => {
      const execute = () => {
        if (state.selectError) {
          return { data: null, error: state.selectError, count: 0 };
        }

        if (table === "provider_artifacts") {
          let rows = artifacts.slice();
          rows = rows.filter((row) =>
            Object.entries(state.eq).every(
              ([column, value]) => row[column as keyof TestArtifact] === value,
            ),
          );
          const artifactTypes = state.in.artifact_type;
          if (artifactTypes) {
            rows = rows.filter((row) =>
              artifactTypes.includes(row.artifact_type),
            );
          }

          return { data: rows, error: null };
        }

        let rows = importJobs.slice();
        rows = rows.filter((row) =>
          Object.entries(state.eq).every(
            ([column, value]) => row[column as keyof TestImportJob] === value,
          ),
        );

        const idFilter = state.in.id;
        if (idFilter) {
          rows = rows.filter((row) => idFilter.includes(row.id));
        }

        const createdAtThreshold = state.gte.created_at;
        if (createdAtThreshold) {
          rows = rows.filter((row) => row.created_at >= createdAtThreshold);
        }

        rows.sort((left, right) =>
          right.created_at.localeCompare(left.created_at),
        );

        if (state.maybeSingle) {
          return { data: rows[0] ?? null, error: null };
        }

        const totalCount = rows.length;
        if (state.range) {
          rows = rows.slice(state.range[0], state.range[1] + 1);
        }

        return { data: rows, error: null, count: totalCount };
      };

      return Promise.resolve(execute()).then(resolve, reject);
    },
  };

  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    channel: (...args: unknown[]) => channelMock(...args),
    removeChannel: (...args: unknown[]) => removeChannelMock(...args),
  },
}));

import { useMailchimpSyncLogs } from "@/hooks/useMailchimpSyncLogs";

function buildJob(index: number, overrides: Partial<TestImportJob> = {}) {
  return {
    id: `job-${index}`,
    tenant_id: "tenant-1",
    provider: "mailchimp",
    status: "completed",
    config: {
      listIds: ["list-1"],
      segmentIds: ["segment-1"],
    },
    report: {
      contacts_imported: 100 + index,
      contacts_skipped: 5,
      contacts_failed: 1,
      segments_created: 2,
      tags_created: 3,
      consents_recorded: 100 + index,
      batches_processed: 2,
    },
    completed_at: `2026-03-${String(24 - (index % 10)).padStart(2, "0")}T09:10:00.000Z`,
    created_at: `2026-03-${String(24 - (index % 10)).padStart(2, "0")}T09:00:00.000Z`,
    updated_at: `2026-03-${String(24 - (index % 10)).padStart(2, "0")}T09:10:00.000Z`,
    progress_percentage: 100,
    current_stage: "Import finished",
    estimated_completion_at: null,
    error_details: null,
    batch_stats: {
      total_batches: 2,
      completed_batches: 2,
      failed_batches: 0,
      contacts_imported: 100 + index,
      contacts_skipped: 5,
      contacts_failed: 1,
      contacts_per_batch: 50,
      estimated_total_rows: 100,
      total_scopes: 1,
    },
    current_page: 2,
    total_pages_est: 2,
    fetched_rows: 110,
    inserted_rows: 100,
    skipped_rows: 5,
    failed_rows: 1,
    ...overrides,
  } satisfies TestImportJob;
}

function HookProbe({
  statusFilter = "all",
  datePreset = "all",
  focusedJobId = null,
}: {
  statusFilter?: "all" | "pending" | "running" | "completed" | "failed";
  datePreset?: "7d" | "30d" | "all";
  focusedJobId?: string | null;
}) {
  const state = useMailchimpSyncLogs({
    statusFilter,
    datePreset,
    focusedJobId,
  });

  return (
    <div>
      <div data-testid="row-count">{state.rows.length}</div>
      <div data-testid="total-count">{state.totalCount}</div>
      <div data-testid="first-id">{state.rows[0]?.id ?? "none"}</div>
      <div data-testid="first-list-name">
        {state.rows[0]?.resolvedLists[0]?.name ?? "none"}
      </div>
      <div data-testid="first-progress">
        {state.rows[0]?.progressPercentage ?? 0}
      </div>
      <div data-testid="running-progress">
        {state.rows.find((row) => row.id === "job-running")
          ?.progressPercentage ?? 0}
      </div>
      <div data-testid="focused-job-excluded">
        {state.focusedJobExcluded ? "yes" : "no"}
      </div>
      <button type="button" onClick={() => void state.loadMore()}>
        load more
      </button>
    </div>
  );
}

describe("useMailchimpSyncLogs", () => {
  beforeEach(() => {
    vi.useRealTimers();
    importJobs = Array.from({ length: 22 }, (_, index) => buildJob(index + 1));
    artifacts = [
      {
        tenant_id: "tenant-1",
        provider: "mailchimp",
        artifact_type: "list",
        external_id: "list-1",
        name: "Newsletter",
        data: {},
      },
      {
        tenant_id: "tenant-1",
        provider: "mailchimp",
        artifact_type: "segment",
        external_id: "segment-1",
        name: "VIP Customers",
        data: { parent_list_id: "list-1" },
      },
    ];
    realtimeCallback = null;
    fromMock.mockImplementation((table: string) => createQueryBuilder(table));
    channelMock.mockImplementation(() => {
      const channel = {
        on: vi.fn(
          (_: unknown, __: unknown, callback: typeof realtimeCallback) => {
            realtimeCallback = callback;
            return channel;
          },
        ),
        subscribe: vi.fn(() => channel),
      };

      return channel;
    });
    removeChannelMock.mockReset();
  });

  it("loads the first page, resolves artifact names, and appends more rows", async () => {
    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("row-count").textContent).toBe("20");
      expect(screen.getByTestId("total-count").textContent).toBe("22");
      expect(screen.getByTestId("first-list-name").textContent).toBe(
        "Newsletter",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "load more" }));

    await waitFor(() => {
      expect(screen.getByTestId("row-count").textContent).toBe("22");
    });
  });

  it("merges realtime inserts at the top of the sync log list", async () => {
    importJobs = [
      buildJob(1, {
        id: "job-running",
        status: "running",
        progress_percentage: 10,
        current_stage: "Fetching contacts",
        completed_at: null,
        updated_at: "2026-03-24T09:01:00.000Z",
      }),
    ];

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("row-count").textContent).toBe("1");
      expect(screen.getByTestId("running-progress").textContent).toBe("10");
    });

    act(() => {
      realtimeCallback?.({
        eventType: "INSERT",
        new: buildJob(99, {
          id: "job-new",
          created_at: "2026-03-25T10:00:00.000Z",
          updated_at: "2026-03-25T10:00:00.000Z",
          provider: "mailchimp",
          tenant_id: "tenant-1",
          status: "running",
          progress_percentage: 5,
          current_stage: "Queued",
          completed_at: null,
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("row-count").textContent).toBe("2");
      expect(screen.getByTestId("first-id").textContent).toBe("job-new");
    });
  });

  it("polls active jobs so running progress can refresh without a realtime event", async () => {
    importJobs = [
      buildJob(1, {
        id: "job-running",
        status: "running",
        progress_percentage: 10,
        current_stage: "Fetching contacts",
        completed_at: null,
        updated_at: "2026-03-24T09:01:00.000Z",
      }),
    ];

    const setIntervalSpy = vi
      .spyOn(window, "setInterval")
      .mockImplementation(() => 1);
    vi.spyOn(window, "clearInterval").mockImplementation(() => undefined);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("running-progress").textContent).toBe("10");
    });

    importJobs = importJobs.map((job) =>
      job.id === "job-running"
        ? {
            ...job,
            progress_percentage: 45,
            report: {
              ...(job.report as Record<string, unknown>),
              contacts_imported: 45,
            },
            batch_stats: {
              ...(job.batch_stats as Record<string, unknown>),
              contacts_imported: 45,
            },
            updated_at: "2026-03-24T09:04:00.000Z",
          }
        : job,
    );

    await act(async () => {
      const latestPollCallback = setIntervalSpy.mock.calls.at(-1)?.[0] as
        | (() => void)
        | undefined;
      latestPollCallback?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId("running-progress").textContent).toBe("45");
    });
  });

  it("derives sync counters from stable report and batch stats fields", async () => {
    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("row-count").textContent).toBe("20");
      expect(screen.getByTestId("first-progress").textContent).toBe("100");
    });
  });
});
