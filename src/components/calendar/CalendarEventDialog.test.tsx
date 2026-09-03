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
const fromMock = vi.fn(() => ({ insert: insertMock }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

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
