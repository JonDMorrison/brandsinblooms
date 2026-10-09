import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { SuiteConfigurator } from "./SuiteConfigurator";

afterEach(cleanup);
const setup = () => render(<MemoryRouter><SuiteConfigurator /></MemoryRouter>);
describe("customer suite configurator", () => {
  it("changes goals, recommended products and quote inquiry without Checkout", () => {
    setup(); expect(screen.getByTestId("suite-total").textContent).toBe("$249.00/month");
    fireEvent.click(screen.getByRole("button", {name: /Complete from/}));
    expect(screen.getByTestId("suite-total").textContent).toBe("$399.00/month");
    const href = screen.getByRole("link", {name: /Ask us to review/}).getAttribute("href")!;
    expect(href).toMatch(/^\/contact\?product=suite/); expect(decodeURIComponent(href)).toContain("not a purchase");
  });
  it("makes commerce depend on website and permits a standalone CRM", () => {
    setup(); fireEvent.click(screen.getByRole("checkbox", {name: /Get discovered/}));
    expect(screen.getByTestId("suite-total").textContent).toBe("$199.00/month");
    fireEvent.click(screen.getByRole("checkbox", {name: /Sell online/}));
    expect(screen.getByRole("checkbox", {name: /Get discovered/})).toBeChecked();
    expect(screen.getByTestId("suite-total").textContent).toBe("$299.00/month");
  });
  it("discloses contact quote floors and does not silently create a subscription", () => {
    setup(); fireEvent.change(screen.getByLabelText(/Marketable contacts/), {target: {value: "30000"}});
    expect(screen.getByText("Budget floor · quote required")).toBeInTheDocument();
    expect(screen.getByText(/Contact pricing above 25,000 is excluded/)).toBeInTheDocument();
    expect(screen.queryByRole("button", {name: /checkout|buy now/i})).not.toBeInTheDocument();
  });
});
