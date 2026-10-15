import {describe,expect,it} from "vitest";
import {idealReportHint,inspectIdealSource,transformIdealCrystalSales} from "../../../../supabase/functions/_shared/customer-intelligence/ideal-source-review";
import {normalizeIdealRow} from "../../../../supabase/functions/_shared/customer-intelligence/ideal-pos";
describe("IdealPOS six-report source review",()=>{
  it.each([
    ["Coupons Redeemed Report.xls","coupons_redeemed"],
    ["Coupons Report.xls Issued.xls","coupons_issued"],
    ["Customer Points Report.xls detaield.xls","customer_points"],
    ["Customer Spending.xls","customer_spending"],
    ["Customer Sales Report.xls by sales cat.xls","customer_sales_by_category"],
    ["Customer Sales Report.xls","customer_sales"],
  ])("recognizes only a candidate shape for %s", (file,type)=>expect(idealReportHint(file)).toBe(type));
  it("retains leading zero customer codes from raw Crystal grouping without making up transaction IDs",()=>{
    const raw=[
      {B:"Customer 000123 - Example Customer"},
      {B:"Sales Category 2    Nursery"},
      {B:"Line heading",C:"Perennials",H:"4",J:"79.96"},
      {B:"Line heading",C:"Vines",H:"3",J:"74.97"},
      {B:"Subtotal",C:"Nursery",H:"7",J:"154.93"},
    ];
    const out=transformIdealCrystalSales(raw);
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]).toMatchObject({"Customer Code":"000123","Customer Name":"Example Customer","Sales Category":"Nursery","Department":"Perennials","Quantity Bought":4,"Dollar Amount Bought":79.96});
    const review=inspectIdealSource("Customer Sales Report.xls",["A","B","C","H","J"],raw);
    expect(review.review.accepted).toBe(2);
    expect(review.review.reportIsAggregate).toBe(true);
    expect(review.review.canMeasureVisits).toBe(false);
    expect(review.normalizedRows.every(row=>!row["Transaction ID"])).toBe(true);
  });
  it("never replaces missing or malformed currency with zero",()=>{
    for(const value of ["","not a number","$", "1.234",undefined]){
      expect(normalizeIdealRow("customer_sales",{"Customer Code":"000123","Dollar Amount Bought":value}).amount).toBeNull();
    }
    expect(normalizeIdealRow("customer_sales",{"Customer Code":"000123","Dollar Amount Bought":"0.00"}).amount).toBe(0);
  });
  it("does not count a report with missing transactions as verified visits",()=>{
    const out=inspectIdealSource("Customer Sales Report.xls",["Customer Code","Department","Quantity"],[{"Customer Code":"000123","Department":"Perennials","Quantity":"3","Dollar Amount Bought":"79.96"}]);
    expect(out.review.missingDatedTransactions).toBe(1);
    expect(out.review.canMeasureVisits).toBe(false);
    expect(out.notices.join(" ")).toContain("No visit");
  });
  it("flags invalid rows and preserves their source row numbers",()=>{
    const out=inspectIdealSource("Customer Sales Report.xls",["Customer Code","Department","Quantity"],[{"Customer Code":"000123","Department":"Perennials","Quantity":"oops","Dollar Amount Bought":"bogus"}]);
    expect(out.review.rejected).toBe(1);
    expect(out.review.errors[0]).toContain("Source row 2");
  });
  it("accepts only an actual dated transaction with an explicit timezone for visits",()=>{
    const base={"Customer Code":"000123","Department":"Perennials","Quantity":"1","Dollar Amount Bought":"7.99","Transaction ID":"sale-001"};
    const bad=inspectIdealSource("Customer Sales Report.xls",Object.keys(base),[{...base,"Transaction Date":"2026-10-15"}]);
    expect(bad.review.rejected).toBe(1);
    expect(bad.review.canMeasureVisits).toBe(false);
    const good=inspectIdealSource("Customer Sales Report.xls",Object.keys(base),[{...base,"Transaction Date":"2026-10-15T12:30:00-07:00"}]);
    expect(good.review.accepted).toBe(1);
    expect(good.review.canMeasureVisits).toBe(true);
  });
  it("fails closed on an unknown report",()=>expect(()=>inspectIdealSource("Unknown.xlsx",["Foo"],[{Foo:1}])).toThrow("Cannot identify"));
});
