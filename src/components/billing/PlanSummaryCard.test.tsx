import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const subscriptionMock = vi.hoisted(() => ({
  current: {
    subscription: null as null | { plan: string; tier?: string | null },
    loading: false,
  },
}));

vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => subscriptionMock.current,
}));

import { PlanSummaryCard } from "./PlanSummaryCard";

const renderCard = () =>
  render(
    <MemoryRouter>
      <PlanSummaryCard />
    </MemoryRouter>,
  );

describe("PlanSummaryCard", () => {
  beforeEach(() => {
    subscriptionMock.current = {
      subscription: null,
      loading: false,
    };
    navigateMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a paid-tier breakdown for Bloom (recommended tier)", () => {
    subscriptionMock.current = {
      subscription: { plan: "bloom", tier: "bloom" },
      loading: false,
    };

    renderCard();

    expect(screen.getByText(/what's included with Bloom/i)).toBeInTheDocument();
    expect(screen.getByText(/100,000 emails\/month/i)).toBeInTheDocument();
    expect(screen.getByText(/5,000 SMS\/month/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Website \+ Ecommerce storefront/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Bloom tier/i)).toBeInTheDocument();
  });

  it("renders a paid-tier breakdown for Seed without the website line", () => {
    subscriptionMock.current = {
      subscription: { plan: "seed", tier: "seed" },
      loading: false,
    };

    renderCard();

    expect(screen.getByText(/what's included with Seed/i)).toBeInTheDocument();
    expect(screen.getByText(/10,000 emails\/month/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Website \+ Ecommerce storefront/i),
    ).not.toBeInTheDocument();
  });

  it("renders the upgrade prompt on free_trial", () => {
    subscriptionMock.current = {
      subscription: { plan: "free_trial", tier: "free_trial" },
      loading: false,
    };

    renderCard();

    expect(screen.getByText(/What's included/i)).toBeInTheDocument();
    expect(
      screen.getByText(/You're on the free trial/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /view pricing/i }),
    ).toBeInTheDocument();
  });

  it("renders the lapsed message on expired", () => {
    subscriptionMock.current = {
      subscription: { plan: "expired", tier: "expired" },
      loading: false,
    };

    renderCard();

    expect(
      screen.getByText(/Your subscription has lapsed/i),
    ).toBeInTheDocument();
  });

  it("renders a generic prompt when subscription is null", () => {
    subscriptionMock.current = { subscription: null, loading: false };

    renderCard();

    expect(screen.getByText(/Choose a tier/i)).toBeInTheDocument();
  });

  it("navigates to /pricing when View pricing is clicked (trial state)", () => {
    subscriptionMock.current = {
      subscription: { plan: "free_trial", tier: "free_trial" },
      loading: false,
    };

    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /view pricing/i }));
    expect(navigateMock).toHaveBeenCalledWith("/pricing");
  });

  it("navigates to /pricing when Compare plans is clicked (paid state)", () => {
    subscriptionMock.current = {
      subscription: { plan: "sprout", tier: "sprout" },
      loading: false,
    };

    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /compare plans/i }));
    expect(navigateMock).toHaveBeenCalledWith("/pricing");
  });

  it("shows skeletons while loading", () => {
    subscriptionMock.current = { subscription: null, loading: true };

    const { container } = renderCard();

    // Joy Skeleton renders as a span with role="presentation" or
    // similar; assert no card content text is yet present.
    expect(
      screen.queryByText(/what's included/i),
    ).not.toBeInTheDocument();
    expect(container.querySelectorAll(".MuiSkeleton-root").length).toBeGreaterThan(0);
  });
});
