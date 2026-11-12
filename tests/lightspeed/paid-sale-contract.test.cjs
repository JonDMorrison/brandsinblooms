require('./register-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildStripePaidLightspeedSale } = require('../../supabase/functions/_shared/lightspeed-storefront/paid-sale-contract.ts');
const ORDER='2c9c6edf-ea51-41b3-a0b7-6a68751781ee';
const SITE='ecee4ff0-2534-491f-98b2-3b63a0639f43';
const ID='1e0d30b2-92e1-4a1f-ae25-f42095bc8441';
const SECOND='f199983e-ed31-4b25-8e0f-fb796a24b526';
function paid(overrides={}) {
  return {
    orderId: ORDER, siteId:SITE, stripePaymentIntentId:'pi_3abcdef12345678',
    stripePaymentSucceeded:true, orderPaymentStatus:'paid', currency:'CAD', totalMinor:2260,
    authorId:ID, outletId:SECOND, registerId:ID, externalPaymentTypeConfigId:SECOND,
    externalPaymentTypeVerified:true,outletVerified:true,taxMappingVerified:true,sourceStockFresh:true,
    lines:[{productId:ID,sku:'001-123',quantity:2,unitPriceMinor:1000,
      unitDiscountMinor:0,unitTaxMinor:130,taxId:SECOND}], ...overrides,
  };
}
test('builds a deterministic pending POS sale with a bookkeeping-only Stripe payment reference',()=>{
  const sale=buildStripePaidLightspeedSale(paid());
  assert.equal(sale.id,undefined); // Provider generates the sale UUID.
  assert.equal(sale.source.id,ORDER);
  assert.equal(sale.source.type,'BloomSites');
  assert.equal(sale.state,'pending');
  assert.equal(sale.payments.length,1);
  assert.equal(sale.payments[0].amount,'22.60');
  assert.equal(sale.line_items[0].product.id,ID);
  assert.equal(sale.line_items[0].tax.amount,'1.30');
  assert.match(sale.note,/do not charge again/i);
  assert.deepEqual(sale,buildStripePaidLightspeedSale(paid()));
});
for(const [name,override] of [
  ['unpaid',{stripePaymentSucceeded:false}],
  ['not canonical paid',{orderPaymentStatus:'pending'}],
  ['wrong currency',{currency:'USD'}],
  ['unverified payment type',{externalPaymentTypeVerified:false}],
  ['unverified outlet',{outletVerified:false}],
  ['unverified tax',{taxMappingVerified:false}],
  ['stale inventory',{sourceStockFresh:false}],
  ['mismatched total',{totalMinor:2261}],
  ['missing Stripe intent',{stripePaymentIntentId:'missing'}],
  ['non-UUID cashier',{authorId:'unknown'}],
  ['no lines',{lines:[]}],
  ['unmapped tax',{lines:[{...paid().lines[0],taxId:null}]}],
  ['invalid quantity',{lines:[{...paid().lines[0],quantity:0}]}],
  ['excess discount',{lines:[{...paid().lines[0],unitDiscountMinor:1100}]}],
])test('fails closed: '+name,()=>assert.throws(()=>buildStripePaidLightspeedSale(paid(override)),/lightspeed_sale_preflight_/));
test('requires exact line sum and does not infer tax or delivery amounts',()=>{
  const sale=paid({lines:[{...paid().lines[0],quantity:1}],totalMinor:1130});
  assert.equal(buildStripePaidLightspeedSale(sale).payments[0].amount,'11.30');
  assert.throws(()=>buildStripePaidLightspeedSale(paid({lines:[{...paid().lines[0],unitTaxMinor:0}]})),/total_mismatch/);
});
