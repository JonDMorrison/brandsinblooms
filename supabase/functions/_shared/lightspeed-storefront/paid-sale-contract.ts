/**
 * Stripe-paid BloomSites order -> Lightspeed X-Series 2026-07 sale preflight.
 *
 * This deliberately performs no I/O. The CRM authority must validate
 * sales:write/sales:read permission, Stripe payment status, merchant-configured
 * external-payment type and tax IDs before a separate, idempotent outbox worker
 * may send this payload. No Lightspeed payment capture is initiated here.
 */
export interface StripePaidLine {
  productId: string;
  sku: string;
  quantity: number;
  unitPriceMinor: number;
  unitTaxMinor: number;
  unitDiscountMinor: number;
  taxId: string;
}
export interface StripePaidSaleInput {
  orderId: string;
  siteId: string;
  stripePaymentIntentId: string;
  stripePaymentSucceeded: boolean;
  orderPaymentStatus: "paid";
  currency: "CAD";
  totalMinor: number;
  authorId: string;
  outletId: string;
  registerId: string;
  externalPaymentTypeConfigId: string;
  externalPaymentTypeVerified: boolean;
  outletVerified: boolean;
  taxMappingVerified: boolean;
  sourceStockFresh: boolean;
  lines: readonly StripePaidLine[];
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(code: string): never {throw new Error("lightspeed_sale_preflight_"+code);}
function uuid(value: unknown, name: string): string {
  if(typeof value!=="string"||!UUID.test(value))fail(name+"_invalid");
  return value as string;
}
function integer(value: unknown, name: string, positive = false): number {
  if(typeof value!=="number"||!Number.isSafeInteger(value)||value<0||(positive&&value===0))fail(name+"_invalid");
  return value as number;
}
function money(minor: number): string {
  return (minor/100).toFixed(2);
}
export function buildStripePaidLightspeedSale(input: StripePaidSaleInput) {
  const orderId=uuid(input.orderId,"order_id");
  uuid(input.siteId,"site_id");
  uuid(input.authorId,"author");
  uuid(input.outletId,"outlet");
  uuid(input.registerId,"register");
  uuid(input.externalPaymentTypeConfigId,"external_payment_type");
  if(!/^pi_[A-Za-z0-9_]{8,200}$/.test(input.stripePaymentIntentId))fail("stripe_identity_invalid");
  if(input.stripePaymentSucceeded!==true||input.orderPaymentStatus!=="paid")fail("not_paid");
  if(input.currency!=="CAD")fail("currency_not_confirmed");
  if(input.externalPaymentTypeVerified!==true)fail("external_payment_type_unverified");
  if(input.outletVerified!==true)fail("outlet_unverified");
  if(input.taxMappingVerified!==true)fail("tax_mapping_unverified");
  if(input.sourceStockFresh!==true)fail("stock_stale");
  const expected=integer(input.totalMinor,"total",true);
  if(!Array.isArray(input.lines)||input.lines.length<1||input.lines.length>200)fail("line_count_invalid");
  let computed=0;
  const line_items=input.lines.map((item,index)=>{
    uuid(item.productId,"product_"+index);
    uuid(item.taxId,"tax_"+index);
    if(typeof item.sku!=="string"||!item.sku.trim()||item.sku.length>128)fail("sku_"+index);
    const quantity=integer(item.quantity,"quantity_"+index,true);
    const unitPrice=integer(item.unitPriceMinor,"price_"+index,true);
    const unitTax=integer(item.unitTaxMinor,"tax_amount_"+index);
    const unitDiscount=integer(item.unitDiscountMinor,"discount_"+index);
    if(unitDiscount>unitPrice)fail("discount_exceeds_price");
    const lineTotal=quantity*(unitPrice-unitDiscount+unitTax);
    if(!Number.isSafeInteger(lineTotal)||!Number.isSafeInteger(computed+lineTotal))fail("total_overflow");
    computed+=lineTotal;
    return {product:{id:item.productId},quantity,pricing:{price:money(unitPrice),discount:money(unitDiscount)},
      tax:{id:item.taxId,amount:money(unitTax)},status:"CONFIRMED" as const};
  });
  // An additional delivery charge, gift card redemption, mixed-source basket,
  // unsupported tax rounding or coupon cannot silently disappear in the POS.
  if(computed!==expected)fail("total_mismatch");
  return {
    id:orderId, state:"pending" as const,
    source:{id:orderId,type:"BloomSites",author_id:input.authorId,register_id:input.registerId,outlet_id:input.outletId},
    fulfillment_outlet_id:input.outletId,
    note:"Stripe-paid BloomSites order "+orderId+"; payment reference "+input.stripePaymentIntentId+
      "; bookkeeper record only, do not charge again.",
    line_items,
    payments:[{type:{config_id:input.externalPaymentTypeConfigId},amount:money(expected),
      source:{register_id:input.registerId}}],
  };
}
