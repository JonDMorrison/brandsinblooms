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
