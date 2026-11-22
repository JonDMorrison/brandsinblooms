import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrialBanner } from "../TrialBanner";
const state = vi.hoisted(() => ({ subscription: { plan: "free_trial", tier: null as string | null }, loading: false, isTrialExpired: false, trialDaysLeft: 2 }));
vi.mock("@/contexts/SubscriptionContext", () => ({ useSubscription: () => state }));
afterEach(cleanup);
describe("TrialBanner", () => {
  it("does not show a trial warning when the current tier is paid", () => {
    state.subscription = { plan: "free_trial", tier: "bloom" };
    const { container } = render(<TrialBanner />);
    expect(container).toBeEmptyDOMElement();
  });
  it("still informs genuine trial accounts", () => {
    state.subscription = { plan: "free_trial", tier: "free_trial" };
    render(<TrialBanner />);
    expect(screen.getByText("2 days left in your trial")).toBeInTheDocument();
  });
});
