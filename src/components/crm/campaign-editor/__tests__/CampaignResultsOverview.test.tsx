import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampaignResultsOverview } from "../CampaignResultsOverview";
const props = {name:"Bonus webinar",subject:"Free webinar",completedAt:"Oct 30",sent:1803,delivered:1703,opened:237,clicked:179,bounced:43,failed:2,deliveryRate:94.5,openRate:13.9,clickRate:10.5,cloning:false,onReport:vi.fn(),onRecipients:vi.fn(),onDuplicate:vi.fn(),onRetry:vi.fn()};
afterEach(cleanup);
describe("CampaignResultsOverview", () => {
  it("separates sends, confirmed delivery, and list issues without an alarming global error", () => {
    render(<CampaignResultsOverview {...props} />);
    expect(screen.getByText("1,803 emails sent.")).toBeVisible();
    expect(screen.getByText("1,703")).toBeVisible();
    expect(screen.getByText(/2 emails could not be sent/)).toHaveTextContent("43 sent emails bounced");
    expect(screen.queryByText("Campaign Sent with Errors")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Review retry options"}));
    expect(props.onRetry).toHaveBeenCalledOnce();
  });
  it("keeps missing reporting data unknown instead of displaying zero or assuming delivery", () => {
    render(<CampaignResultsOverview {...props} delivered={null} opened={null} clicked={null} deliveryRate={null} openRate={null} clickRate={null} />);
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.getAllByText("Updating as results arrive")).toHaveLength(3);
    expect(screen.queryByText(/Delivered to 1,803/)).not.toBeInTheDocument();
  });
  it("avoids a success claim when no emails were sent and links the full report", () => {
    render(<CampaignResultsOverview {...props} sent={0} />);
    expect(screen.queryByText("Your campaign is out in the world.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Explore full report"}));
    expect(props.onReport).toHaveBeenCalledOnce();
  });
});
