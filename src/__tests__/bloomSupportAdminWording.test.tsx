import "@testing-library/jest-dom/vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KIND_LABEL, PRODUCT_LABEL, QUEUE_VIEWS, STATUS_LABEL, WAITING_LABEL, type TicketDetail } from "@/lib/bloomSupport/api";
import { adminAudienceLabel, adminAudienceOptions, adminInboxNames } from "@/lib/bloomSupport/adminLabels";
import { statusPatch } from "@/components/bloomSupport/statusPatch";
import type { AskOptions } from "@/components/bloomSupport/useAskDialog";
import { STATUS_LABEL as POLICY_STATUS_LABEL } from "../../supabase/functions/_shared/bloom-support/policy";
import { humanizeNextAction } from "../../supabase/functions/_shared/bloom-support/notes";

// Jon (2026-11-05): "It should never say needs Jon or Jeff. It should say something about Admin."
const PERSON = /\b(Jon|Jeff)\b/;

const api = vi.hoisted(() => ({
  escalations: vi.fn(),
  staff: vi.fn(),
  settings: vi.fn(),
  engineering: vi.fn(), features: vi.fn(), pageTickets: vi.fn(),
  setAutomation: vi.fn(), resolveEscalation: vi.fn(), updateTicket: vi.fn(),
}));
vi.mock("@/lib/bloomSupport/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bloomSupport/api")>();
  return { ...actual, bloomSupport: { ...actual.bloomSupport, ...api } };
});

import { EscalationsPanel } from "@/components/bloomSupport/AdminPanels";

describe("Bloom Support names roles, never people", () => {
  it("status, queue and policy label maps say Admin", () => {
    expect(STATUS_LABEL.needs_owner).toBe("Needs admin");
    expect(POLICY_STATUS_LABEL.needs_owner).toBe("Needs admin");
    expect(QUEUE_VIEWS.find((v) => v.key === "needs_owner")?.label).toBe("Needs admin");
    const maps: Array<Record<string, string>> = [STATUS_LABEL, POLICY_STATUS_LABEL, WAITING_LABEL, KIND_LABEL, PRODUCT_LABEL, Object.fromEntries(QUEUE_VIEWS.map((v) => [v.key, v.label]))];
    for (const map of maps) for (const [key, label] of Object.entries(map)) expect(label, key).not.toMatch(PERSON);
  });

  it("labels the two admin inboxes from data, not hard-coded names", () => {
    const owners = { jon: ["Owner.One@example.test"], jeff: ["two@example.test"] };
    const staff = [{ id: "p1", name: "Pat Admin", email: "owner.one@example.test" }];
    const names = adminInboxNames(owners, staff);
    expect(names).toEqual({ jon: "Pat Admin", jeff: "two@example.test" });
    expect(adminAudienceLabel("both", names)).toBe("All admins");
    expect(adminAudienceLabel("jon", names)).toBe("Admin · Pat Admin");
    expect(adminAudienceLabel("jeff", names, "Sam Owner")).toBe("Admin · Sam Owner");
    expect(adminAudienceLabel("jeff", adminInboxNames({}, undefined))).toBe("Admin · inbox 2");
    expect(adminAudienceOptions(names)).toEqual([
      { value: "both", label: "Any admin" },
      { value: "jon", label: "Admin · Pat Admin" },
      { value: "jeff", label: "Admin · two@example.test" },
    ]);
  });

  it("the Needs admin form keeps the jon/jeff/both values but shows Admin labels", async () => {
    let seen: AskOptions | null = null;
    const ask = async (o: AskOptions) => { seen = o; return { decision: "Refund?", who: "jeff", rec: "" }; };
    const patch = await statusPatch(ask, { kind: "question" } as TicketDetail, "needs_owner", { jon: null, jeff: "Pat Admin" });
    expect(patch).toMatchObject({ status: "needs_owner", accountable: "jeff" });
    expect(JSON.stringify(seen)).not.toMatch(PERSON);
    expect(seen!.title).toBe("Escalate to an admin");
    const who = seen!.fields.find((f) => f.name === "who");
    expect(who?.options?.map((o) => o.value)).toEqual(["both", "jon", "jeff"]);
    expect(who?.options?.map((o) => o.label)).toEqual(["Any admin", "Admin · inbox 1", "Admin · Pat Admin"]);
  });

  it("rewords old stored next actions for staff views", () => {
    expect(humanizeNextAction("Jon/Jeff: client wants a refund")).toBe("Admin: client wants a refund");
    expect(humanizeNextAction("Jon decides on the feature request")).toBe("Admin decides on the feature request");
    expect(humanizeNextAction("Jeff/Support: prepare the requested change")).toBe("Admin or Support: prepare the requested change");
    expect(humanizeNextAction("Call the client back")).toBe("Call the client back");
  });

  it("the escalations panel shows Admin plus the owner's name from data", async () => {
    api.escalations.mockResolvedValue([
      { id: "e1", audience: "jon", owner_id: "p1", reason: "decision", status: "open", created_at: new Date().toISOString(), ticket_id: null, ticket: null },
      { id: "e2", audience: "both", owner_id: null, reason: "decision", status: "open", created_at: new Date().toISOString(), ticket_id: null, ticket: null },
    ]);
    api.staff.mockResolvedValue([{ id: "p1", name: "Pat Admin", email: "pat@example.test", role: "platform_admin", grants: [], kind: "user", active: true }]);
    api.settings.mockResolvedValue({ owners: { jon: ["pat@example.test"], jeff: [] } });
    const me = { permissions: ["escalations.view", "tickets.read_all"] } as unknown as Parameters<typeof EscalationsPanel>[0]["me"];
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EscalationsPanel me={me} onOpenTicket={() => undefined} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Admin · Pat Admin")).toBeInTheDocument();
    expect(screen.getByText("All admins")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(PERSON);
  });

  it("the empty escalations panel says Nothing waiting for an admin", async () => {
    api.escalations.mockResolvedValue([]);
    api.staff.mockResolvedValue([]);
    api.settings.mockResolvedValue({});
    const me = { permissions: ["escalations.view"] } as unknown as Parameters<typeof EscalationsPanel>[0]["me"];
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EscalationsPanel me={me} onOpenTicket={() => undefined} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Nothing waiting for an admin")).toBeInTheDocument();
  });

  // Every piece of copy Bloom Support shows or sends: the staff desk, client views,
  // emails, chat and the server code that writes ticket text. Comments are skipped;
  // test fixtures may still use people as sample data.
  it("no Bloom Support source file puts Jon or Jeff in a user-visible string", () => {
    const root = resolve(__dirname, "../..");
    const targets = [
      "src/components/bloomSupport",
      "src/lib/bloomSupport",
      "src/pages/admin/BloomSupportPage.tsx",
      "src/pages/SupportPage.tsx",
      "src/pages/PublicSupportPage.tsx",
      "src/pages/PublicSupportTrackPage.tsx",
      "src/pages/BloomSupportConnectPage.tsx",
      "supabase/functions/_shared/bloom-support",
      "supabase/functions/bloom-assist",
      "supabase/functions/bloom-support-api",
      "supabase/functions/bloom-support-mcp",
      "supabase/functions/bloom-support-worker",
    ];
    const files: string[] = [];
    const walk = (p: string) => {
      const full = join(root, p);
      if (statSync(full).isDirectory()) { for (const e of readdirSync(full)) walk(join(p, e)); return; }
      if (/\.(ts|tsx)$/.test(p) && !/(_test\.ts|\.test\.tsx?|__tests__)/.test(p)) files.push(p);
    };
    targets.forEach(walk);
    expect(files.length).toBeGreaterThan(20);
    const hits: string[] = [];
    for (const f of files) {
      const code = readFileSync(join(root, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1")
        // Anchored regex literals that recognise old stored text (humanizeNextAction) are matchers, not copy.
        .replace(/\/\^(?:\\.|[^/\\\n])*\/[a-z]*/g, "");
      // Identifiers are lower case (jon, jeff) and repository names (JonDMorrison) do
      // not match, so what is left is copy: string literals, template text and JSX text.
      code.split("\n").forEach((line, i) => { if (PERSON.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 140)}`); });
    }
    expect(hits).toEqual([]);
  });

  it("the latest SQL definitions write role wording", () => {
    const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261105230000_bloom_support_admin_wording.sql"), "utf8");
    const code = sql.replace(/--.*$/gm, "");
    expect(code).not.toMatch(PERSON);
    expect(code).toContain("'Needs admin #'");
    expect(code).toContain("next_action = 'Admin: '");
  });
});

import { fireEvent, waitFor } from "@testing-library/react";
import { DecisionCard, TodayView } from "@/components/bloomSupport/TodayView";

describe("simple support decision card", () => {
  const decision = { key: "repair", who: "Request #1019", when: "today", text: "The automatic fix cannot continue safely.", recommendation: "Assign this request to me for review.", detail: "Private technical evidence", decide: async () => undefined };
  it("offers exactly three primary choices and puts evidence behind a disclosure", () => {
    const choose = vi.fn();
    const { container, unmount } = render(<DecisionCard d={decision} busy={false} onChoose={choose} />);
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.map((b) => b.textContent)).toEqual(["Do It", "Reject it", "Something else"]);
    buttons.forEach((button) => fireEvent.click(button));
    expect(choose.mock.calls).toEqual([["do"], ["reject"], ["other"]]);
    const details = container.querySelector("details");
    expect(details).not.toHaveAttribute("open");
    expect(details).toHaveTextContent("Private technical evidence");
    unmount();
  });
  it("prevents repeated submission while busy and unauthorized decisions", () => {
    const choose = vi.fn();
    const { container, rerender, unmount } = render(<DecisionCard d={decision} busy onChoose={choose} />);
    for (const button of container.querySelectorAll("button")) expect(button).toBeDisabled();
    rerender(<DecisionCard d={{ ...decision, decide: undefined }} busy={false} onChoose={choose} />);
    for (const button of container.querySelectorAll("button")) expect(button).toBeDisabled();
    unmount();
  });
});


it("Something else saves the alternative through the real Today dialog and ticket actions", async () => {
  api.engineering.mockResolvedValue([]);
  api.features.mockResolvedValue([]);
  api.pageTickets.mockResolvedValue({ items: [], total: 0 });
  api.escalations.mockResolvedValue([{ id: "review-1", status: "open", ticket_id: "ticket-1", reason: "engineering_escalated", created_at: new Date().toISOString(), ticket: { number: 1019, subject: "Recipient checkout" } }]);
  api.setAutomation.mockResolvedValue({});
  api.resolveEscalation.mockResolvedValue({});
  api.updateTicket.mockResolvedValue({});
  const me = { id: "admin-1", permissions: ["engineering.view", "features.view", "escalations.view", "escalations.resolve", "tickets.write"] } as Parameters<typeof TodayView>[0]["me"];
  const { unmount } = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TodayView me={me} onOpenTicket={() => undefined} onOpenDesk={() => undefined} /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Something else" }));
  const field = await screen.findByRole("textbox", { name: "What would you like instead?" });
  expect(screen.getByRole("button", { name: "Save guidance" })).toBeDisabled();
  fireEvent.change(field, { target: { value: "Check the work already in review before starting again." } });
  fireEvent.click(screen.getByRole("button", { name: "Save guidance" }));
  await waitFor(() => expect(api.updateTicket).toHaveBeenCalledWith("ticket-1", expect.objectContaining({ owner_id: "admin-1", next_action: "Alternative requested: Check the work already in review before starting again." })));
  expect(api.setAutomation).toHaveBeenCalledWith("ticket-1", "human", "Alternative requested: Check the work already in review before starting again.");
  expect(await screen.findByRole("status")).toHaveTextContent("Your alternative is recorded for review.");
  unmount();
});
