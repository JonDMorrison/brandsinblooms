import { fireEvent,render,screen,cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { afterEach,describe,expect,it } from "vitest";
import { SuiteConfigurator } from "./SuiteConfigurator";
afterEach(cleanup);
describe("modular price calculator",()=>{
 it("starts at $250 and updates as products are selected",()=>{
  render(<MemoryRouter><SuiteConfigurator/></MemoryRouter>);
  expect(screen.getByTestId("suite-total")).toHaveTextContent("$250.00/month");
  fireEvent.click(screen.getByRole("checkbox",{name:/BloomSuite POS/}));expect(screen.getByTestId("suite-total")).toHaveTextContent("$198.00/month");
  fireEvent.click(screen.getByRole("button",{name:/Complete BloomSuite/}));expect(screen.getByTestId("suite-total")).toHaveTextContent("$250.00/month");
  fireEvent.change(screen.getByLabelText("Emails per month"),{target:{value:"40000"}});expect(screen.getByTestId("suite-total")).toHaveTextContent("$310.00/month");
  const href=screen.getByRole("link",{name:/Ask us to review/}).getAttribute("href")!;expect(href).toMatch(/^\/contact\?product=suite/);expect(decodeURIComponent(href)).toContain("not a purchase");
  expect(screen.queryByRole("button",{name:/checkout|buy now/i})).not.toBeInTheDocument();
 });
 it("can start with a single product and doesn't bill unselected products",()=>{
  render(<MemoryRouter><SuiteConfigurator initialProduct="site"/></MemoryRouter>);expect(screen.getByTestId("suite-total")).toHaveTextContent("$99.00/month");expect(screen.queryByLabelText("Emails per month")).not.toBeInTheDocument();
 });
});