import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CampaignStepBadge } from "@/components/crm/campaign-editor/CampaignEditorStep";

describe("CampaignStepBadge", () => {
  it("renders Needs attention in Joy primary (navy), not warning or danger", () => {
    render(<CampaignStepBadge state={{ kind: "attention", count: 2 }} />);
    const badge = screen.getByTestId("campaign-step-badge-attention");
    expect(badge).toHaveClass("MuiChip-colorPrimary");
    expect(badge).toHaveClass("MuiChip-variantSoft");
    expect(badge).not.toHaveClass("MuiChip-colorWarning");
    expect(badge).not.toHaveClass("MuiChip-colorDanger");
    expect(screen.getByTestId("campaign-step-badge-count")).toHaveTextContent("2");
    expect(badge).toHaveTextContent("Needs attention: 2 issues");
  });
});
