import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: vi.fn() } } }));

import { StatusChip } from "@/components/bloomSupport/chips";
import { CLIENT_STATUS_LABEL, clientStatusOf, statusLabel, type TicketStatus } from "@/lib/bloomSupport/api";

const ALL_STATUSES: TicketStatus[] = ["new", "working", "waiting", "needs_owner", "resolved", "received", "in_progress", "waiting_on_you"];
const INTERNAL = /Jon|Jeff|needs|owner|_/i;
const repo = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8");

describe("Bloom Support clients never see an internal routing status", () => {
  it("projects every status to the four client states, matching the server", () => {
    expect(clientStatusOf("new")).toBe("received");
    expect(clientStatusOf("working")).toBe("in_progress");
    expect(clientStatusOf("needs_owner")).toBe("in_progress");
    expect(clientStatusOf("waiting", "customer")).toBe("waiting_on_you");
    expect(clientStatusOf("waiting", "deployment")).toBe("in_progress");
    expect(clientStatusOf("resolved")).toBe("resolved");
    for (const s of ["received", "in_progress", "waiting_on_you", "resolved"] as const) expect(clientStatusOf(s)).toBe(s);
  });

  it("client labels name no person or internal state", () => {
    for (const status of ALL_STATUSES) expect(statusLabel(status, "client")).not.toMatch(INTERNAL);
    expect(statusLabel("needs_owner", "client")).toBe(CLIENT_STATUS_LABEL.in_progress);
    expect(statusLabel("needs_owner", "staff")).toBe("Needs admin");
  });

  it("StatusChip renders client labels for a client, even for a raw needs_owner", () => {
    for (const status of ALL_STATUSES) {
      const { unmount } = render(<StatusChip status={status} audience="client" />);
      const text = document.body.textContent ?? "";
      expect(text).not.toMatch(INTERNAL);
      expect(Object.values(CLIENT_STATUS_LABEL)).toContain(text);
      unmount();
    }
    render(<StatusChip status="needs_owner" audience="client" />);
    expect(screen.getByText("In progress")).toBeTruthy();
  });

  it("staff still see the routing label", () => {
    render(<StatusChip status="needs_owner" />);
    expect(screen.getByText("Needs admin")).toBeTruthy();
  });

  it("the client support surfaces pass the client audience", () => {
    expect(repo("src/pages/SupportPage.tsx")).toContain('<StatusChip status={t.status} audience={staff ? "staff" : "client"} />');
    const pane = repo("src/components/bloomSupport/TicketDetailPane.tsx");
    expect(pane).toContain('<StatusChip status={t.status} audience={staff ? "staff" : "client"} />');
    expect(pane).toContain('statusLabel(c.status, staff ? "staff" : "client")');
    expect(pane).not.toMatch(/\{t\.waiting_reason && <Chip/);
  });

  it("the server projects status for non-staff ticket reads", () => {
    const sql = repo("supabase/migrations/20261105220000_bloom_support_client_status.sql");
    expect(sql).toContain("'status', CASE WHEN staff THEN t.status ELSE bloom_support.client_status(t) END");
    expect(sql).toContain("'status', CASE WHEN staff THEN o.status ELSE bloom_support.client_status(o) END");
    expect(sql).toMatch(/WHEN t\.status = 'waiting' AND t\.waiting_reason = 'customer' THEN 'waiting_on_you'/);
  });
});
