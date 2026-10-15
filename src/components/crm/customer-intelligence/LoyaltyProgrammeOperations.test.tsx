import "@testing-library/jest-dom/vitest";
import * as React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgrammeBaselinePanel } from "./ProgrammeBaselinePanel";
import { ProgrammeResultsPanel } from "./ProgrammeResultsPanel";
import { ProgrammeWorkspaceBody } from "./LoyaltyProgrammeWorkspace";
import { CalendarImportWorksheet } from "@/components/calendar/MarketingCalendarImport";
import type { ProgrammeDetail } from "@/lib/loyalty/programmeApi";
import { createProgrammeDraft } from "../../../../supabase/functions/_shared/loyalty/programme-templates";
import {
  capturePeriod,
  captureProgrammeBaseline,
  compareProgrammePeriod,
} from "../../../../supabase/functions/_shared/loyalty/programme-measurement";
const mocks = vi.hoisted(() => ({
  command: vi.fn(),
  download: vi.fn(),
  workbook: vi.fn(),
  rows: vi.fn(),
}));
vi.mock("@/lib/loyalty/programmeApi", async (original) => ({
  ...(await original<typeof import("@/lib/loyalty/programmeApi")>()),
  programmeCommand: mocks.command,
  downloadProgrammeData: mocks.download,
}));
vi.mock("@/lib/loyalty/calendarWorkbook", () => ({
  openCalendarWorkbook: mocks.workbook,
  calendarWorkbookRows: mocks.rows,
}));
vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenant: { id: "tenant-a" } }),
}));
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ role: "owner_admin", hasPermission: () => true }),
}));
const at = "2026-10-15T18:00:00Z";
const draft = createProgrammeDraft(
  "welcome",
  "CAD",
  "2026-10-15",
  "America/Vancouver",
);
const detail: ProgrammeDetail = {
  programme: {
    id: "programme",
    name: "Welcome programme",
    status: "draft",
    current_version_id: "version",
    created_at: at,
    updated_at: at,
  },
  version: {
    id: "version",
    programme_id: "programme",
    version_number: 1,
    definition: draft,
    definition_hash: "a".repeat(64),
  },
  baselines: [],
  baselineLimit: 100,
};
const settings = {
  currency: "CAD" as const,
  timezone: "America/Vancouver",
  spendWeight: 50,
  transactionsWeight: 50,
};
const coverage = {
  status: "unverified" as const,
  evidence: "",
  reviewedAt: null,
};
const contact = {
  id: "customer-a",
  created_at: "2024-01-01T00:00:00Z",
  email_opt_in: false,
  opt_out: false,
  suppressed: false,
};
const old = capturePeriod(
  [],
  ["customer-a"],
  ["customer-a"],
  "tenant-a",
  { start: "2025-09-01", end: "2025-09-30" },
  settings,
  at,
  coverage,
);
const base = captureProgrammeBaseline(old, [contact], []);
const next = capturePeriod(
  [],
  ["customer-a"],
  ["customer-a"],
  "tenant-a",
  { start: "2026-09-01", end: "2026-09-30" },
  settings,
  at,
  coverage,
);
const report = compareProgrammePeriod(base, next, [contact], [], [], false);
const preview = {
  previewId: "preview",
  digest: "a".repeat(64),
  expiresAt: "2099-01-01T00:00:00Z",
  versionId: "version",
  baseline: base,
  audience: {
    name: "All profiles",
    customerCount: 1,
    excludedCount: 2,
    unknownCount: 3,
    definition: { exactRule: "all active" },
    notes: ["Consent is separate from this audience."],
  },
  page: 1,
  hasMore: false,
};
function wrap(children: React.ReactNode) {
  return render(<MemoryRouter>{children}</MemoryRouter>);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.command.mockImplementation(
    async (_tenant: string, command: { action: string }) => {
      switch (command.action) {
        case "audiences":
          return { segments: [], bloomSets: [] };
        case "preview_baseline":
          return preview;
        case "confirm_baseline":
          return { saved: { baselineId: "baseline-new" } };
        case "list":
          return { programmes: [], count: 0 };
        case "get":
          return detail;
        case "runs":
          return { runs: [] };
        case "calendar_history":
          return { batches: [] };
        default:
          throw new Error("Unexpected test command: " + command.action);
      }
    },
  );
});
afterEach(cleanup);
describe("programme baseline review workflow", () => {
  it("requires an explicit reviewed confirmation and does not issue or send", async () => {
    const saved = vi.fn(async () => undefined);
    wrap(
      <ProgrammeBaselinePanel
        tenantId="tenant-a"
        detail={detail}
        onSaved={saved}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review baseline and audience" }),
    );
    expect(
      await screen.findByText("1 customers in this fixed cohort"),
    ).toBeVisible();
    const button = screen.getByRole("button", {
      name: "Confirm and save baseline",
    });
    expect(button).toBeDisabled();
    expect(mocks.command.mock.calls.map(([, p]) => p.action)).not.toContain(
      "confirm_baseline",
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Save this exact 1-customer baseline/,
      }),
    );
    fireEvent.click(button);
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(mocks.command).toHaveBeenCalledWith("tenant-a", {
      action: "confirm_baseline",
      previewId: "preview",
      digest: "a".repeat(64),
      confirmed: true,
    });
    expect(
      mocks.command.mock.calls.some(([, p]) =>
        /issue|send|redeem/.test(p.action),
      ),
    ).toBe(false);
  });
  it("invalidates a reviewed audience when dates or thresholds change", async () => {
    wrap(
      <ProgrammeBaselinePanel
        tenantId="tenant-a"
        detail={detail}
        onSaved={async () => undefined}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review baseline and audience" }),
    );
    await screen.findByText("1 customers in this fixed cohort");
    fireEvent.change(screen.getByLabelText("Baseline starts"), {
      target: { value: "2025-02-01" },
    });
    expect(
      screen.queryByRole("button", { name: "Confirm and save baseline" }),
    ).not.toBeInTheDocument();
  });
  it("shows source errors rather than substituting zero customer totals", async () => {
    mocks.command.mockImplementation(async (_t, p) => {
      if (p.action === "audiences") return { segments: [], bloomSets: [] };
      throw new Error("Purchase history is unavailable.");
    });
    wrap(
      <ProgrammeBaselinePanel
        tenantId="tenant-a"
        detail={detail}
        onSaved={async () => undefined}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review baseline and audience" }),
    );
    expect(
      await screen.findByText("Purchase history is unavailable."),
    ).toBeVisible();
    expect(
      screen.queryByText("0 customers in this fixed cohort"),
    ).not.toBeInTheDocument();
  });
  it("keeps excluded and unknown audience counts visible", async () => {
    wrap(
      <ProgrammeBaselinePanel
        tenantId="tenant-a"
        detail={detail}
        onSaved={async () => undefined}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review baseline and audience" }),
    );
    expect(
      await screen.findByText(
        /2 excluded by the selected audience. 3 have unknown/,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("checkbox", {
        name: /reconciled complete dated order history for this baseline/,
      }),
    ).not.toBeChecked();
  });
  it("does not apply a delayed preview to a replacement workspace", async () => {
    let resolve!: (value: unknown) => void;
    mocks.command.mockImplementation((_t, p) =>
      p.action === "audiences"
        ? Promise.resolve({ segments: [], bloomSets: [] })
        : new Promise((r) => {
            resolve = r;
          }),
    );
    const view = wrap(
      <ProgrammeBaselinePanel
        key="old"
        tenantId="tenant-a"
        detail={detail}
        onSaved={async () => undefined}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review baseline and audience" }),
    );
    view.rerender(
      <MemoryRouter>
        <ProgrammeBaselinePanel
          key="new"
          tenantId="tenant-b"
          detail={detail}
          onSaved={async () => undefined}
        />
      </MemoryRouter>,
    );
    resolve(preview);
    await new Promise((r) => setTimeout(r, 0));
    expect(
      screen.queryByText("1 customers in this fixed cohort"),
    ).not.toBeInTheDocument();
  });
});
describe("saved result interpretation", () => {
  it("keeps unknown customers visible and avoids a fabricated growth percentage", () => {
    wrap(
      <ProgrammeResultsPanel
        tenantId="tenant-a"
        initial={{
          runId: "run",
          result: { ...report, page: 1, count: 1, hasMore: false },
        }}
      />,
    );
    expect(screen.getAllByText("Not scored").length).toBeGreaterThan(0);
    expect(screen.getByText(/Original cohort: 1. Comparable: 0/)).toBeVisible();
    expect(
      within(
        screen.getByRole("table", { name: "Programme customer comparison" }),
      ).getByText("unknown"),
    ).toBeVisible();
    expect(
      screen.getByText("Campaign outcomes—not a claim of cause"),
    ).toBeVisible();
  });
  it("fails a partial multi-page export instead of returning an incomplete list", async () => {
    mocks.command.mockImplementation(async (_t, p) =>
      p.page === 1
        ? {
            runId: "run",
            result: { ...report, count: 51, page: 1, hasMore: true },
          }
        : {
            runId: "run",
            result: { ...report, rows: [], count: 51, page: 2, hasMore: false },
          },
    );
    wrap(
      <ProgrammeResultsPanel
        tenantId="tenant-a"
        initial={{
          runId: "run",
          result: { ...report, page: 1, count: 51, hasMore: true },
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Export all/ }));
    expect(
      await screen.findByText(/No partial export was produced./),
    ).toBeVisible();
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
describe("programme workspace", () => {
  it("loads the existing company programmes only after opening the workspace", async () => {
    wrap(
      <ProgrammeWorkspaceBody
        tenantId="tenant-a"
        timezone="America/Vancouver"
      />,
    );
    expect(mocks.command).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", {
        name: /Loyalty programmes · Plan, rewards and results/,
      }),
    );
    await waitFor(() =>
      expect(mocks.command).toHaveBeenCalledWith("tenant-a", {
        action: "list",
        page: 1,
      }),
    );
  });
});
async function choose(label: string, value: string) {
  const el = screen.getByLabelText(label);
  fireEvent.mouseDown(el);
  fireEvent.click(el);
  const option = await screen.findByRole("option", {
    name: value,
    exact: true,
  });
  fireEvent.click(option);
}
describe("calendar review and commit", () => {
  it("requires reject acknowledgement and explicit planned-only approval", async () => {
    const raw = { Title: "Spring", Date: "2027-03-01" };
    mocks.workbook.mockResolvedValue({
      name: "calendar.csv",
      sheets: ["Plan"],
      epoch: "excel_1900",
      workbook: {},
    });
    mocks.rows.mockResolvedValue({
      headers: ["Title", "Date"],
      rows: [raw, { Title: "", Date: "bad" }],
    });
    mocks.command.mockImplementation(async (_t, p) => {
      if (p.action === "calendar_preview")
        return {
          previewId: "calendar",
          digest: "b".repeat(64),
          expiresAt: "2099-01-01",
          preview: {
            counts: { accepted: 1, rejected: 1, duplicate: 0, source: 2 },
            rows: [
              {
                rowNumber: 2,
                state: "accepted",
                item: { title: "Spring", date: "2027-03-01", channel: "email" },
                original: raw,
                errors: [],
              },
              {
                rowNumber: 3,
                state: "rejected",
                item: null,
                original: { Title: "", Date: "bad" },
                errors: ["Date is invalid."],
              },
            ],
          },
        };
      if (p.action === "calendar_confirm")
        return {
          saved: {
            created: 1,
            duplicates: 0,
            rejected: 1,
            scheduledMessages: 0,
          },
        };
      if (p.action === "calendar_history") return { batches: [] };
      throw new Error(p.action);
    });
    const imported = vi.fn();
    wrap(
      <CalendarImportWorksheet
        tenantId="tenant-a"
        timezone="America/Vancouver"
        onImported={imported}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Import your marketing calendar/ }),
    );
    fireEvent.change(screen.getByLabelText("Marketing calendar file"), {
      target: {
        files: [new File(["Title,Date"], "calendar.csv", { type: "text/csv" })],
      },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Read selected sheet" }),
    );
    await screen.findByText("Map 2 source rows");
    await choose("Title column (required)", "Title");
    await choose("Date column (required)", "Date");
    fireEvent.click(screen.getByRole("button", { name: "Preview import" }));
    await screen.findByText("1 ready · 0 duplicates · 1 need attention");
    const confirm = screen.getByRole("button", {
      name: "Confirm calendar import",
    });
    expect(confirm).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Import 1 accepted rows as planned tasks only/,
      }),
    );
    expect(confirm).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Leave 1 rejected rows out/ }),
    );
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(imported).toHaveBeenCalledOnce());
    expect(mocks.command).toHaveBeenCalledWith("tenant-a", {
      action: "calendar_confirm",
      previewId: "calendar",
      digest: "b".repeat(64),
      confirmed: true,
      acceptRejected: true,
    });
    expect(screen.getByText(/No messages scheduled/)).toBeVisible();
  });
});
