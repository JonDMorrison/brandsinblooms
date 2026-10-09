import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatusChip } from "../CRMCampaignsPage";
import type { CampaignCatalogItem } from "@/lib/crm/campaignEditor";

afterEach(cleanup);

describe("completed campaign status", () => {
  it.each(["sent", "sent_with_errors"])("shows a green Sent badge for %s with successful sends", (status) => {
    const campaign = { status, messagesSent: 1600, messagesFailed: 100 } as CampaignCatalogItem;
    const { container } = render(<StatusChip campaign={campaign} />);
    expect(screen.getByText("Sent")).toBeInTheDocument();
    expect(container.querySelector(".MuiChip-colorSuccess")).not.toBeNull();
    expect(container.querySelector(".lucide-circle-check-big")).not.toBeNull();
    expect(screen.queryByText(/100 errors/)).not.toBeInTheDocument();
    expect(campaign.messagesFailed).toBe(100);
  });
  it.each(["failed", "sent_with_errors"])("keeps %s red when nothing was sent", (status) => {
    const { container } = render(<StatusChip campaign={{ status, messagesSent: 0, messagesFailed: 100 } as CampaignCatalogItem} />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(container.querySelector(".MuiChip-colorDanger")).not.toBeNull();
  });
});
