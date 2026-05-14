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

const generateCampaignContentMock = vi.fn();

vi.mock("@/components/homepage/ContentGenerationServices", () => ({
  generateCampaignContent: (...args: unknown[]) =>
    generateCampaignContentMock(...args),
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
    generateCampaignContentMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("closes the modal as soon as the campaigns insert resolves, even when content gen hangs", async () => {
    let resolveContentGen: (value: unknown) => void = () => {};
    generateCampaignContentMock.mockReturnValue(
      new Promise((resolve) => {
        resolveContentGen = resolve;
      }),
    );

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
        description: expect.stringContaining("background"),
      }),
    );

    expect(generateCampaignContentMock).toHaveBeenCalled();

    // Cleanup: resolve so the test doesn't leave a dangling promise.
    resolveContentGen({ success: true, tasks: [] });
  });

  it("shows a failure toast when background content gen rejects (timeout)", async () => {
    generateCampaignContentMock.mockRejectedValue(
      new Error(
        "Content generation is taking longer than expected. Your event was created — you can regenerate content from the campaign page.",
      ),
    );

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

    await waitFor(() => {
      const calls = toastMock.mock.calls.map((args) => args[0]);
      expect(
        calls.some(
          (call: { title?: string; variant?: string }) =>
            call?.title === "Content generation failed" &&
            call?.variant === "destructive",
        ),
      ).toBe(true);
    });
  });
});
