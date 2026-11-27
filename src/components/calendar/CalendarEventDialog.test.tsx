import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenant: { id: "test-tenant" } }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

const insertedCampaign = {
  id: "campaign-id",
  title: "My Event",
  theme: "My Event Promotion",
  description: null,
  week_number: 20,
};

const singleMock = vi.fn().mockResolvedValue({
  data: insertedCampaign,
  error: null,
});
const selectMock = vi.fn(() => ({ single: singleMock }));
const insertMock = vi.fn(() => ({ select: selectMock }));
const fromMock = vi.fn<(table: string) => { insert: typeof insertMock }>(
  () => ({ insert: insertMock }),
);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => fromMock(table),
  },
}));

import { readFileSync } from "node:fs";
import {
  getDateForWeek,
  getISOWeekNumber,
  toLocalDateString,
} from "@/utils/dateUtils";
import { CalendarEventDialog } from "./CalendarEventDialog";

// MUI Joy `Input` doesn't auto-associate the visible <Typography> label with
// the inner <input>. Grab the first input inside the form (Event Name) by
// position, which is stable in this dialog's structure.
const getEventNameInput = (): HTMLInputElement => {
  const inputs = document.querySelectorAll("form input");
  if (inputs.length === 0) {
    throw new Error("Expected at least one input inside the dialog form");
  }
  return inputs[0] as HTMLInputElement;
};

describe("CalendarEventDialog", () => {
  beforeEach(() => {
    toastMock.mockClear();
    singleMock.mockClear();
    selectMock.mockClear();
    insertMock.mockClear();
    fromMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("creates an event for email and SMS campaign planning", async () => {
    const onOpenChange = vi.fn();
    const onEventCreated = vi.fn();

    render(
      <CalendarEventDialog
        open
        onOpenChange={onOpenChange}
        onEventCreated={onEventCreated}
        defaultDate={new Date("2026-05-14T12:00:00Z")}
      />,
    );

    fireEvent.change(getEventNameInput(), { target: { value: "My Event" } });
    fireEvent.click(screen.getByRole("button", { name: /create event/i }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledTimes(1);
    });
    // campaigns_week_date_consistency: week_number is start_date's ISO week.
    expect(insertMock.mock.calls[0]).toEqual([
      expect.objectContaining({ start_date: "2026-05-14", week_number: 20 }),
    ]);

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(onEventCreated).toHaveBeenCalled();

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Event created",
        description: "The event is ready for email and SMS campaign planning.",
      }),
    );
  });

  it("keeps the dialog open and shows the insert error", async () => {
    singleMock.mockResolvedValueOnce({
      data: null,
      error: new Error("insert failed"),
    });

    render(
      <CalendarEventDialog
        open
        onOpenChange={vi.fn()}
        onEventCreated={vi.fn()}
        defaultDate={new Date("2026-05-14T12:00:00Z")}
      />,
    );

    fireEvent.change(getEventNameInput(), { target: { value: "My Event" } });
    fireEvent.click(screen.getByRole("button", { name: /create event/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("insert failed");
    expect(toastMock).not.toHaveBeenCalled();
  });
});

describe("calendar theme scheduling week_number", () => {
  const calendarView = readFileSync("src/components/CalendarViewNext.tsx", "utf8");

  it("derives week_number from the stored start_date, not the theme's week", () => {
    expect(calendarView).not.toContain("theme.weekNumber ||");
    expect(calendarView).toContain("const startDate = toLocalDateString(date);");
    expect(calendarView).toMatch(
      /start_date: startDate,\s*week_number: getISOWeekNumber\(date\),/,
    );
  });

  it("can schedule a theme whose target date falls in another ISO week", () => {
    // 2027 has no ISO week 53, so the Weekly Themes dialog's date for week 53
    // is Monday of ISO week 1 of 2028. The stored row must say week 1.
    const target = getDateForWeek(53, 2027);
    expect(toLocalDateString(target)).toBe("2028-01-03");
    expect(getISOWeekNumber(target)).toBe(1);
    // Local date, not UTC: late Sunday evening stays on Sunday's ISO week.
    const sundayEvening = new Date(2026, 4, 17, 23, 30);
    expect(toLocalDateString(sundayEvening)).toBe("2026-05-17");
    expect(getISOWeekNumber(sundayEvening)).toBe(20);
  });
});
