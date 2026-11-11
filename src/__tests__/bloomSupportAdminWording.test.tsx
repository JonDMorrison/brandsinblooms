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
  getTicket: vi.fn(), setAutomation: vi.fn(), resolveEscalation: vi.fn(), updateTicket: vi.fn(), updateEngineering: vi.fn(),
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
import { TodayView } from "@/components/bloomSupport/TodayView";
import { DecisionCard } from "@/components/bloomSupport/desk/DecisionCard";

describe("support decision card", () => {
  const take = vi.fn(async () => undefined);
  const repair = vi.fn(async () => undefined);
  const other = vi.fn(async () => undefined);
  const decision = {
    key: "repair", client: "Cedar Lane Garden Centre", ticket: "#1019 Checkout", when: "today",
    problem: "Bloom's automatic fix stopped before it finished.", recommendation: "Let Bloom start the fix.",
    risk: "The client marked this urgent priority.", evidence: "Private technical evidence",
    options: [
      { id: "repair", label: "Let Bloom start the fix", detail: "Nothing goes live without approval.", recommended: true, run: repair, done: "a" },
      { id: "take", label: "I'll take it from here", detail: "Assign it to me.", run: take, done: "b" },
    ],
    other: { run: other, done: "c" },
  };
  it("asks like a question: problem, recommendation, a Recommended answer, and Something else", () => {
    const confirm = vi.fn();
    const { container, unmount } = render(<DecisionCard d={decision} busy={false} onConfirm={confirm} />);
    expect(container).toHaveTextContent("The problem");
    expect(container).toHaveTextContent("What Bloom recommends");
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[0]).toBeChecked();
    expect(screen.getByRole("radio", { name: /Let Bloom start the fix.*Recommended/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(confirm).toHaveBeenLastCalledWith({ optionId: "repair" });
    fireEvent.click(screen.getByRole("radio", { name: /Something else/ }));
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "What should happen instead?" }), { target: { value: "  Wait for the vendor.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(confirm).toHaveBeenLastCalledWith({ other: "Wait for the vendor." });
    const details = container.querySelector("details");
    expect(details).not.toHaveAttribute("open");
    expect(details).toHaveTextContent("Private technical evidence");
    unmount();
  });
  it("asks staff to review a stopped repair before opting into takeover", () => {
    const open = vi.fn();
    const confirm = vi.fn();
    const { unmount } = render(
      <DecisionCard
        d={{
          ...decision,
          reviewFirst: true,
          recommendation: "Open the request to see why the repair stopped. Taking ownership is optional.",
          options: [{ id: "take", label: "Take over this request", detail: "Bloom stops messaging the client.", run: take, done: "Assigned." }],
          other: undefined,
          open: { label: "Open request", onClick: open },
        }}
        busy={false}
        onConfirm={confirm}
      />,
    );
    expect(screen.getByRole("button", { name: "Review stopped repair" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Take over this request/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Review stopped repair" }));
    expect(open).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
    unmount();
  });
  it("prevents repeated submission while busy and explains when the role can't decide", () => {
    const { container, rerender, unmount } = render(<DecisionCard d={decision} busy onConfirm={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
    rerender(<DecisionCard d={{ ...decision, options: [], other: undefined }} busy={false} onConfirm={vi.fn()} />);
    expect(container.querySelectorAll("input[type=radio]")).toHaveLength(0);
    expect(container).toHaveTextContent("Your role can't make this decision. An admin can.");
    unmount();
  });
});

it("places the Today work column beside the navigation without an empty left gutter", () => {
  api.engineering.mockResolvedValue([]);
  api.features.mockResolvedValue([]);
  api.pageTickets.mockResolvedValue({ items: [], total: 0 });
  api.escalations.mockResolvedValue([]);
  const me = { id: "admin-1", permissions: [] } as unknown as Parameters<typeof TodayView>[0]["me"];
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TodayView me={me} onOpenTicket={() => undefined} onOpenDesk={() => undefined} />
    </QueryClientProvider>,
  );
  expect(screen.getByTestId("bloom-support-today-work-column")).toHaveStyle({
    marginLeft: "0px",
    marginRight: "auto",
    maxWidth: "1200px",
    width: "100%",
    textAlign: "left",
  });
});


it("Something else saves the person's own instructions through the real ticket actions", async () => {
  api.engineering.mockResolvedValue([]);
  api.features.mockResolvedValue([]);
  api.pageTickets.mockResolvedValue({ items: [], total: 0 });
  api.escalations.mockResolvedValue([{ id: "review-1", status: "open", ticket_id: "ticket-1", reason: "engineering_escalated", created_at: new Date().toISOString(), ticket: { number: 1019, subject: "Recipient checkout" } }]);
  api.getTicket.mockResolvedValueOnce({ status: "working", version: 3 }).mockResolvedValueOnce({ status: "working", version: 5 });
  api.setAutomation.mockResolvedValue({});
  api.resolveEscalation.mockResolvedValue({});
  api.updateTicket.mockResolvedValue({});
  const me = { id: "admin-1", permissions: ["engineering.view", "features.view", "escalations.view", "escalations.resolve", "tickets.write"] } as Parameters<typeof TodayView>[0]["me"];
  const { unmount } = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TodayView me={me} onOpenTicket={() => undefined} onOpenDesk={() => undefined} /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("radio", { name: /Something else/ }));
  const field = await screen.findByRole("textbox", { name: "What should happen instead?" });
  fireEvent.change(field, { target: { value: "Check the work already in review before starting again." } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(api.updateTicket).toHaveBeenCalledWith("ticket-1", expect.objectContaining({ version: 5, owner_id: "admin-1", next_action: "Alternative requested: Check the work already in review before starting again." })));
  expect(api.setAutomation).toHaveBeenCalledWith("ticket-1", "human", "Alternative requested: Check the work already in review before starting again.");
  expect(await screen.findByRole("status")).toHaveTextContent("Your instructions are saved on the request, and it's assigned to you.");
  unmount();
});

it("Today counts decisions, Bloom's own work and today's completions from live data", async () => {
  const now = new Date().toISOString();
  const ticket = (id: string, extra: Record<string, unknown>) => ({ id, number: 1, subject: `Subject ${id}`, status: "working", account: { id: "a", name: `Client ${id}` }, requester: null, updated_at: now, ...extra });
  api.engineering.mockResolvedValue([]);
  api.features.mockResolvedValue([]);
  api.escalations.mockResolvedValue([]);
  api.pageTickets.mockImplementation(async (f: Record<string, string>) => {
    if (f.view === "needs_owner") return { items: [ticket("n1", { status: "needs_owner", next_action: "Admin: confirm the refund amount" })], total: 1 };
    if (f.view === "recently_resolved") return { items: [ticket("r1", { status: "resolved", resolved_at: now, resolution_summary: "Fixed it." }), ticket("r2", { status: "resolved", resolved_at: "2020-01-01T00:00:00Z" })], total: 2 };
    if (f.automation === "auto") return { items: [ticket("b1", { automation: "auto", executor: "bloom" }), ticket("p1", { automation: "auto", executor: "person" })], total: 2, next_cursor: null };
    return { items: [], total: 0, next_cursor: null };
  });
  const me = { id: "admin-1", permissions: ["tickets.write"] } as unknown as Parameters<typeof TodayView>[0]["me"];
  const { unmount } = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TodayView me={me} onOpenTicket={() => undefined} onOpenDesk={() => undefined} /></QueryClientProvider>);
  expect(await screen.findByText("One decision needs you.")).toBeInTheDocument();
  const glance = screen.getByRole("region", { name: "Today at a glance" });
  expect(glance).toHaveTextContent("1Need your decision");
  expect(glance).toHaveTextContent("1Bloom is handling");
  expect(glance).toHaveTextContent("1Completed today");
  const handling = screen.getByRole("region", { name: "Bloom is handling" });
  expect(handling).toHaveTextContent("Client b1");
  expect(handling).not.toHaveTextContent("Client p1");
  expect(screen.getByText("Confirm the refund amount.")).toBeInTheDocument();
  unmount();
});

it("offers real answers per situation: start the fix when Bloom is ready, keep going when only overdue", async () => {
  api.engineering.mockResolvedValue([]);
  api.features.mockResolvedValue([]);
  api.pageTickets.mockResolvedValue({ items: [], total: 0 });
  api.escalations.mockResolvedValue([
    { id: "s1", status: "open", ticket_id: "t1", reason: "engineering_start_requested", engineering_issue_id: "eng-9", created_at: new Date().toISOString(), detail: "Bloom found the template ignores the logo.", ticket: { number: 1, subject: "Logo" } },
    { id: "o1", status: "open", ticket_id: "t2", reason: "ticket_overdue", created_at: new Date().toISOString(), ticket: { number: 2, subject: "Hours" } },
    { id: "a1", status: "acknowledged", ticket_id: "t3", reason: "engineering_escalated", created_at: new Date().toISOString(), ticket: { number: 3, subject: "Taken" } },
  ]);
  api.updateEngineering.mockResolvedValue({});
  api.resolveEscalation.mockResolvedValue({});
  const me = { id: "admin-1", permissions: ["engineering.view", "features.view", "escalations.view", "escalations.resolve", "tickets.write", "engineering.dispatch"] } as Parameters<typeof TodayView>[0]["me"];
  const { unmount } = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TodayView me={me} onOpenTicket={() => undefined} onOpenDesk={() => undefined} /></QueryClientProvider>);
  expect(await screen.findByText("Bloom looked into this and is ready to start an automatic fix. What it found: Bloom found the template ignores the logo.")).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: /Let Bloom start the fix.*Recommended/ })).toBeChecked();
  expect(screen.getByRole("radio", { name: /Let Bloom keep going/ })).toBeInTheDocument();
  expect(screen.queryByText("#3 Taken")).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Confirm" })[0]);
  await waitFor(() => expect(api.updateEngineering).toHaveBeenCalledWith("eng-9", { start_repair: true, note: "Started from the Support desk" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Bloom is starting the fix. You'll be asked before anything goes live.");
  unmount();
});
