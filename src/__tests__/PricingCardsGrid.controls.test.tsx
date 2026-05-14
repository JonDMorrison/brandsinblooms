import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { PricingCardsGrid } from "@/components/pricing/PricingCardsGrid";

const renderGrid = (props: React.ComponentProps<typeof PricingCardsGrid> = {}) =>
  render(
    <MemoryRouter>
      <PricingCardsGrid {...props} />
    </MemoryRouter>,
  );

describe("PricingCardsGrid billing-interval + currency toggle", () => {
  it("defaults to monthly USD and renders the four tiers at monthly prices", () => {
    renderGrid();

    expect(screen.getByTestId("billing-monthly")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("currency-usd")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    expect(screen.getByTestId("price-seed")).toHaveTextContent("$199");
    expect(screen.getByTestId("price-sprout")).toHaveTextContent("$349");
    expect(screen.getByTestId("price-bloom")).toHaveTextContent("$699");
    expect(screen.getByTestId("price-thrive")).toHaveTextContent("$1,199");

    // No annual-savings line should render while monthly is active.
    expect(screen.queryByTestId("annual-savings-seed")).toBeNull();
  });

  it("switches every card to annual amounts when Annual is selected and shows the 2-months-free badge", () => {
    renderGrid();

    fireEvent.click(screen.getByTestId("billing-annual"));

    expect(screen.getByTestId("billing-annual")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    expect(screen.getByTestId("price-seed")).toHaveTextContent("$1,990");
    expect(screen.getByTestId("price-sprout")).toHaveTextContent("$3,490");
    expect(screen.getByTestId("price-bloom")).toHaveTextContent("$6,990");
    expect(screen.getByTestId("price-thrive")).toHaveTextContent("$11,990");

    expect(screen.getByTestId("annual-savings-seed")).toHaveTextContent(
      /2 months free/i,
    );
    expect(screen.getByTestId("annual-savings-seed")).toHaveTextContent(
      "$199",
    );
  });

  it("appends CAD to displayed prices when currency is switched to CAD", () => {
    renderGrid();

    fireEvent.click(screen.getByTestId("currency-cad"));

    expect(screen.getByTestId("currency-cad")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("price-seed")).toHaveTextContent("$199 CAD");
    expect(screen.getByTestId("price-bloom")).toHaveTextContent("$699 CAD");
  });

  it("calls onSelectPlan with the currently selected billingInterval and currency", () => {
    const onSelectPlan = vi.fn();
    renderGrid({ onSelectPlan });

    fireEvent.click(screen.getByTestId("billing-annual"));
    fireEvent.click(screen.getByTestId("currency-cad"));

    fireEvent.click(screen.getByRole("button", { name: /Start with Bloom/i }));

    expect(onSelectPlan).toHaveBeenCalledTimes(1);
    expect(onSelectPlan).toHaveBeenCalledWith("bloom", "annual", "cad");
  });

  it("honors controlled billingInterval/currency props from a parent", () => {
    const onBillingIntervalChange = vi.fn();
    const onCurrencyChange = vi.fn();

    const { rerender } = renderGrid({
      billingInterval: "annual",
      onBillingIntervalChange,
      currency: "cad",
      onCurrencyChange,
    });

    expect(screen.getByTestId("billing-annual")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("price-seed")).toHaveTextContent("$1,990 CAD");

    fireEvent.click(screen.getByTestId("billing-monthly"));
    expect(onBillingIntervalChange).toHaveBeenCalledWith("monthly");
    // Internal state should not change while controlled — re-render
    // with the same prop keeps "annual" displayed.
    rerender(
      <MemoryRouter>
        <PricingCardsGrid
          billingInterval="annual"
          onBillingIntervalChange={onBillingIntervalChange}
          currency="cad"
          onCurrencyChange={onCurrencyChange}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("billing-annual")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
