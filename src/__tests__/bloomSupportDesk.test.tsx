import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bloomState, deskAlerts, MAIN_VIEWS, MORE_VIEWS, parseDeskView } from "@/components/bloomSupport/desk/deskModel";
import { DeskNav } from "@/components/bloomSupport/desk/DeskNav";
import { DeskHeader } from "@/components/bloomSupport/desk/DeskHeader";

describe("Support desk navigation", () => {
  it("shows only the five everyday destinations, with specialist tools under More", () => {
    expect(MAIN_VIEWS.map((v) => v.label)).toEqual(["Today", "Requests", "Decisions", "Clients", "Reports"]);
    expect(MORE_VIEWS.map((v) => v.label)).toEqual(["Feature requests", "Saved answers", "Shared problems", "Fixes in progress", "Account changes", "System status", "Settings"]);
    expect(MORE_VIEWS.some((v) => /setup check/i.test(v.label))).toBe(false);
  });

  it("keeps every old view value working and falls back to Today for unknown links", () => {
    for (const v of ["today", "queue", "escalations", "features", "clients", "knowledge", "reports", "problems", "engineering", "operations", "readiness", "settings"]) {
      expect(parseDeskView(v)).toBe(v);
    }
    expect(parseDeskView(null)).toBe("today");
    expect(parseDeskView("something-old")).toBe("today");
  });

  it("selects a destination by click and opens More items", () => {
    const onChange = vi.fn();
    render(<DeskNav view="today" badges={{ escalations: 3 }} onChange={onChange} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(within(tabs[2]).getByLabelText("3 waiting")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Requests/ }));
    expect(onChange).toHaveBeenLastCalledWith("queue");
    fireEvent.click(screen.getByRole("button", { name: /More/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /System status/ }));
    expect(onChange).toHaveBeenLastCalledWith("readiness");
  });

  it("names the current More destination on the More button", () => {
    render(<DeskNav view="readiness" badges={{}} onChange={() => undefined} />);
    expect(screen.getByRole("button", { name: /System status/ })).toBeInTheDocument();
    for (const tab of screen.getAllByRole("tab")) expect(tab).toHaveAttribute("aria-selected", "false");
  });
});

describe("Support desk header", () => {
  it("raises nothing on a normal day", () => {
    expect(deskAlerts({ automation_enabled: true, dead_jobs: 0, by_status: { working: 4 } }, 0)).toEqual([]);
    expect(deskAlerts(undefined, 3)).toEqual([]);
  });

  it("raises only exceptional states, most serious first", () => {
    const alerts = deskAlerts({ automation_enabled: false, dead_jobs: 2, by_status: { needs_owner: 1 } }, 1);
    expect(alerts.map((a) => a.kind)).toEqual(["paused", "failed", "urgent", "admin"]);
    expect(alerts.map((a) => a.title)).toEqual(["Bloom is paused", "2 automatic steps failed this week", "1 urgent request open", "1 request needs an admin"]);
    expect(alerts.find((a) => a.kind === "admin")?.tone).toBe("warning");
  });

  it("describes Bloom from real state and never claims it is working when unknown", () => {
    expect(bloomState(undefined, true).label).toBe("Bloom's status is unavailable");
    expect(bloomState(undefined, false).label).toBe("Checking on Bloom…");
    expect(bloomState({ automation_enabled: false }, false)).toEqual({ tone: "danger", label: "Bloom is paused" });
    expect(bloomState({ automation_enabled: true, queued: 1, running: 1 }, false).label).toBe("Bloom is working on 2 steps");
    expect(bloomState({ automation_enabled: true, queued: 0, running: 0 }, false).label).toBe("Bloom is on and ready");
  });

  it("routes each alert action to the right place", () => {
    const onAlert = vi.fn();
    render(<DeskHeader summary={{ automation_enabled: false, by_status: { needs_owner: 2 } }} summaryFailed={false} urgent={1} onNewRequest={() => undefined} onAlert={onAlert} />);
    expect(screen.getByRole("heading", { level: 1, name: "Support desk" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    fireEvent.click(screen.getByRole("button", { name: "See urgent requests" }));
    fireEvent.click(screen.getByRole("button", { name: "See decisions" }));
    expect(onAlert.mock.calls.map((c) => c[0])).toEqual(["settings", "urgent", "decisions"]);
  });
});
