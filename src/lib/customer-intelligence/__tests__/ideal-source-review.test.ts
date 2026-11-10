import {describe,expect,it} from "vitest";
import {idealReportHint,inspectIdealSource,transformIdealCrystalSales} from "../../../../supabase/functions/_shared/customer-intelligence/ideal-source-review";
import {sameIdealSourceEvent} from "../../../../supabase/functions/_shared/customer-intelligence/source-event-replay";
import {completedIdealImportReplay} from "../../../../supabase/functions/_shared/customer-intelligence/import-replay";
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
  it("keeps missing expiry unknown and rejects ambiguous or impossible supplied expiry",()=>{
    const base={CODE:"000123","Coupon Code":"000009","Issue Date":"2026-10-15T12:30:00-07:00"};
    const review=(row:Record<string,unknown>)=>inspectIdealSource("Coupons Issued.xls",Object.keys(row),[row]).review;
    expect(review(base).accepted).toBe(1);
    expect(review({...base,"Expiry Date":"2026-10-14T12:30:00-07:00"}).errors.join(" ")).toContain("precedes");
    for(const expiry of ["2026-10-21","2026-02-30T12:00:00-08:00","2026-10-21T24:00:00-07:00"]){
      expect(review({...base,"Expiry Date":expiry}).errors.join(" ")).toContain("expiry timestamp");
    }
    expect(review({...base,"Expiry Date":"2028-02-29T12:00:00-08:00"}).accepted).toBe(1);
    expect(review({...base,"Issue Date":"2026-02-30T12:00:00-08:00"}).rejected).toBe(1);
  });
  it("never replaces missing or malformed currency with zero",()=>{
    for(const value of ["","not a number","$", "1.234",undefined]){
      expect(normalizeIdealRow("customer_sales",{"Customer Code":"000123","Dollar Amount Bought":value}).amount).toBeNull();
    }
    expect(normalizeIdealRow("customer_sales",{"Customer Code":"000123","Dollar Amount Bought":"0.00"}).amount).toBe(0);
  });
  it.each(["coupons_issued", "coupons_redeemed"] as const)("keeps customer CODE distinct from coupon identity for %s",(reportType)=>{
    const row={CODE:"000123","Issue Date":"2026-10-15T12:30:00-07:00","Redemption Date":"2026-10-16T12:30:00-07:00"};
    expect(normalizeIdealRow(reportType,row)).toMatchObject({customerCode:"000123",couponCode:null});
    const filename=reportType==="coupons_issued"?"Coupons Issued.xls":"Coupons Redeemed.xls";
    const missing=inspectIdealSource(filename,Object.keys(row),[row]);
    expect(missing.review.accepted).toBe(0);
    expect(missing.review.errors.join(" ")).toContain("Coupon identifier missing");
    const distinct={...row,"Coupon Code":"000009"};
    expect(normalizeIdealRow(reportType,distinct)).toMatchObject({customerCode:"000123",couponCode:"000009"});
    expect(inspectIdealSource(filename,Object.keys(distinct),[distinct]).review.accepted).toBe(1);
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
    const base={"Customer Code":"000123","Department":"Perennials","Quantity":"1","Dollar Amount Bought":"7.99","Transaction ID":"sale-001","Line ID":"line-01"};
    const bad=inspectIdealSource("Customer Sales Report.xls",Object.keys(base),[{...base,"Transaction Date":"2026-10-15"}]);
    expect(bad.review.rejected).toBe(1);
    expect(bad.review.canMeasureVisits).toBe(false);
    const good=inspectIdealSource("Customer Sales Report.xls",Object.keys(base),[{...base,"Transaction Date":"2026-10-15T12:30:00-07:00"}]);
    expect(good.review.accepted).toBe(1);
    expect(good.review.canMeasureVisits).toBe(true);
  });
  it("rejects a dated sale without stable per-line identity",()=>{
    const out=inspectIdealSource("Customer Sales Report.xls",["Customer Code","Transaction ID"],[
      {"Customer Code":"000123","Transaction ID":"sale-001","Transaction Date":"2026-10-15T12:30:00-07:00","Department":"Perennials","Quantity":"1","Dollar Amount Bought":"7.99"}
    ]);
    expect(out.review.rejected).toBe(1);
    expect(out.review.errors.join(" ")).toContain("line ID");
    expect(out.review.canMeasureVisits).toBe(false);
  });
  it("does not mistake a repeated file for a completed import after interruption or rejection",()=>{
    expect(completedIdealImportReplay(null)).toBe("new");
    expect(completedIdealImportReplay({status:"completed"})).toBe("completed");
    for(const status of ["processing","failed","completed_with_errors",null,undefined])expect(completedIdealImportReplay({status})).toBe("recovery_required");
  });
  it("checks event values omitted from legacy fingerprints before accepting a duplicate",()=>{
    const fact={customer_id:"customer",event_type:"coupon_issued",external_customer_code:"000123",external_transaction_id:null,coupon_code:"000009",points_delta:null,amount:5,occurred_at:"2026-10-15T19:30:00Z",expires_at:"2026-10-22T19:30:00Z"};
    expect(sameIdealSourceEvent({...fact,amount:"5.00",expires_at:"2026-10-22T12:30:00-07:00"},fact)).toBe(true);
    expect(sameIdealSourceEvent({...fact,expires_at:"2026-10-23T19:30:00Z"},fact)).toBe(false);
    expect(sameIdealSourceEvent({...fact,points_delta:50},fact)).toBe(false);
    expect(sameIdealSourceEvent({...fact,customer_id:"other"},fact)).toBe(false);
    expect(sameIdealSourceEvent({...fact,amount:""},fact)).toBe(false);
  });
  it("fails closed on an unknown report",()=>expect(()=>inspectIdealSource("Unknown.xlsx",["Foo"],[{Foo:1}])).toThrow("Cannot identify"));
});
