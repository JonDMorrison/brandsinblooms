import { describe, expect, it } from "vitest";
import { groupOpenEscalations } from "@/components/bloomSupport/todayActions";

describe("Bloom Support Today actions", () => {
  it("groups repeated open reasons for one ticket and ignores closed history", () => {
    const groups = groupOpenEscalations([
      { id: "old", ticket_id: "ticket-1", status: "resolved", created_at: "2026-11-01" },
      { id: "overdue", ticket_id: "ticket-1", status: "open", reason: "ticket_overdue", created_at: "2026-11-03" },
      { id: "repair", ticket_id: "ticket-1", status: "open", reason: "engineering_escalated", created_at: "2026-11-04" },
      { id: "feature", ticket_id: "ticket-2", status: "open", reason: "feature_decision", created_at: "2026-11-02" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].map((row) => row.id)).toEqual(["repair", "overdue"]);
    expect(groups[1].map((row) => row.id)).toEqual(["feature"]);
  });
});

import { vi } from "vitest";
import { recordReviewDecision, escalationExplanation } from "@/components/bloomSupport/todayActions";

describe("review decision persistence", () => {
  const recommendation = "Assign this request to me for review and keep automatic work paused.";
  const input = { ownerId: "admin-1", ticketIds: ["ticket-1", "ticket-1"], escalations: [{ id: "e1", status: "open" }], recommendation };
  const api = () => ({ setAutomation: vi.fn().mockResolvedValue({}), resolveEscalation: vi.fn().mockResolvedValue({}), updateTicket: vi.fn().mockResolvedValue({}) });
  it.each(["do", "reject", "other"] as const)("records %s durably with an owner and follow-up", async (choice) => {
    const client = api();
    await recordReviewDecision(client, input, choice, "Please investigate the existing work first.");
    expect(client.setAutomation).toHaveBeenCalledTimes(1);
    expect(client.setAutomation).toHaveBeenCalledWith("ticket-1", "human", expect.any(String));
    expect(client.resolveEscalation).toHaveBeenCalledWith("e1", expect.stringContaining(choice === "do" ? "Accepted:" : choice === "reject" ? "Rejected:" : "Alternative requested:"));
    expect(client.updateTicket).toHaveBeenCalledWith("ticket-1", expect.objectContaining({ status: "working", owner_id: "admin-1", next_action_due_at: expect.any(String) }));
    expect(client.setAutomation.mock.invocationCallOrder[0]).toBeLessThan(client.resolveEscalation.mock.invocationCallOrder[0]);
    if (choice === "reject") expect(client.updateTicket.mock.calls[0][1].next_action).toContain("Do not repeat this recommendation");
  });
  it("cannot record a blank alternative or continue after takeover fails", async () => {
    const client = api();
    await expect(recordReviewDecision(client, input, "other", "  ")).rejects.toThrow("Tell us");
    expect(client.setAutomation).not.toHaveBeenCalled();
    client.setAutomation.mockRejectedValue(new Error("conflict"));
    await expect(recordReviewDecision(client, input, "do")).rejects.toThrow("conflict");
    expect(client.resolveEscalation).not.toHaveBeenCalled();
    expect(client.updateTicket).not.toHaveBeenCalled();
  });
  it("explains a stopped repair without exposing raw technical details", () => {
    expect(escalationExplanation("engineering_escalated")).toBe("The automatic fix cannot continue safely. A person needs to choose the next step.");
  });
});
