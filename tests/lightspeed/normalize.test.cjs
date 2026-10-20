require('./register-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeLightspeedProduct: product, normalizeLightspeedInventory: inventory,
  resolveLightspeedAvailability: availability, priceToMinor, versionCursor,
} = require('../../supabase/functions/_shared/lightspeed-storefront/normalize.ts');
const NOW = Date.parse('2026-10-09T14:00:00Z');
const config = { currency: 'CAD', taxBasis: 'exclusive' };
const fixture = () => ({ id: 'source-1', name: 'Example plant', sku: '000123',
  price_excluding_tax: 24.95, price_including_tax: 28.1935,
  active: true, has_inventory: true, version: '9007199254740993',
  variant_options: [{name:'Pot size',value:'1 gallon'}] });
const base = () => ({product: product(fixture(), config),
  inventory: [inventory({product_id:'source-1',outlet_id:'orillia',count:8,version:42},new Date(NOW).toISOString())],
  mappedOutletIds:['orillia'], now:NOW, maxAgeMs:15*60*1000 });

test('preserves SKU leading zeros and source ids', () => {
  const p = product(fixture(), config); assert.equal(p.sku,'000123');
  assert.equal(p.externalId,'source-1'); assert.equal(p.priceMinor,2495);
  assert.equal(p.currency,'CAD'); assert.equal(p.version,'9007199254740993');
});
test('legacy family_id is accepted, not mistaken for a new-model response', () => {
  assert.equal(product({...fixture(),family_id:'family-1'},config).externalId,'source-1');
});
test('new active/prices objects are explicitly rejected', () => {
  for (const change of [{active:{in_store:true}}, {prices:{price_excluding_tax:'24.95'}}]) {
    assert.throws(()=>product({...fixture(),...change},config),{code:'product_api_version'});
  }
});
test('unknown prices do not become free', () => {
  for (const raw of [undefined,null,'',NaN,Infinity,-1,'abc',true,'1.234']) {
    assert.equal(priceToMinor(raw),null);
  }
  assert.equal(priceToMinor('0'),0); assert.equal(priceToMinor('24.9500'),2495);
});
test('currency and tax basis are explicitly required', () => {
  for (const c of [{currency:'',taxBasis:'exclusive'},{currency:'JPY',taxBasis:'exclusive'},
    {currency:'cad',taxBasis:'exclusive'},{currency:'CAD',taxBasis:'unknown'}]) {
    assert.throws(()=>product(fixture(),c));
  }
});
test('exclusive price never silently falls back to tax-inclusive price', () => {
  const p=product({...fixture(),price_excluding_tax:null},config);
  assert.equal(p.priceMinor,null); assert.ok(p.issues.includes('invalid_price'));
});
test('numeric SKU does not invent lost leading zeros', () => {
  assert.ok(product({...fixture(),sku:123},config).issues.includes('missing_sku'));
});
test('different products with identical names are never grouped by name', () => {
  assert.notEqual(product(fixture(),config).groupId,product({...fixture(),id:'source-2'},config).groupId);
});
test('explicit parent id links variants', () => {
  assert.equal(product({...fixture(),variant_parent_id:'source-parent'},config).groupId,'source-parent');
});
test('deleted and inactive records cannot be sold', () => {
  for (const change of [{active:false},{deleted_at:'2026-10-09'}, {active:true,is_active:false}]) {
    const b=base(); b.product=product({...fixture(),...change},config);
    assert.equal(availability(b).canPublishForSale,false);
  }
});
test('missing tracking or active flag blocks approval', () => {
  for (const key of ['active','has_inventory']) {
    const f=fixture();delete f[key];const b=base();b.product=product(f,config);
    assert.equal(availability(b).canPublishForSale,false);
  }
});
test('malformed and duplicate variant options require review', () => {
  for(const opts of ['not-an-array',[{name:'Size',value:'1'},{name:'Size',value:'2'}],
    [{name:'__proto__',value:'bad'}],[{name:'Size'}]]) {
    assert.ok(product({...fixture(),variant_options:opts},config).issues.includes('invalid_variant_options'));
  }
});
test('rejects secret-bearing, script and insecure image URLs', () => {
  const p=product({...fixture(),image_url:'javascript:alert(1)',images:[
    'http://images.example.org/a.jpg','https://user:password@images.example.org/a.jpg',
    {url:'https://images.example.org/a.jpg'},{url:'https://images.example.org/a.jpg'}]},config);
  assert.deepEqual(p.imageUrls,['https://images.example.org/a.jpg']);
});
test('source product inventory is never treated as a dedicated fresh inventory read', () => {
  const b=base();b.inventory=[];
  b.product=product({...fixture(),inventory:[{outlet_id:'orillia',count:999}]},config);
  const out=availability(b);assert.equal(out.onHand,null);assert.equal(out.canPublishForSale,false);
});
test('unknown inventory cannot be confused with a verified zero', () => {
  const b=base();b.inventory=[];assert.equal(availability(b).onHand,null);
  b.inventory=[{externalId:'source-1',outletId:'orillia',onHand:0,observedAt:new Date(NOW).toISOString(),version:null}];
  assert.equal(availability(b).onHand,0);assert.ok(availability(b).reasons.includes('out_of_stock'));
});
test('requires explicit location mapping', () => {
  const b=base();b.mappedOutletIds=[];assert.ok(availability(b).reasons.includes('locations_not_mapped'));
});
test('does not use stock at an unmapped outlet', () => {
  const b=base();b.inventory[0].outletId='brechin';assert.equal(availability(b).canPublishForSale,false);
});
test('both mapped outlets require their own verified count', () => {
  const b=base();b.mappedOutletIds.push('brechin');assert.equal(availability(b).canPublishForSale,false);
  b.inventory.push({...b.inventory[0],outletId:'brechin',onHand:2});
  assert.equal(availability(b).onHand,10);assert.equal(availability(b).canPublishForSale,true);
});
test('stale or future-dated inventory blocks selling', () => {
  for(const observedAt of [NOW-16*60000,NOW+61000,NaN]) {
    const b=base();b.inventory[0].observedAt=Number.isFinite(observedAt)?new Date(observedAt).toISOString():'bad';
    assert.equal(availability(b).canPublishForSale,false);
  }
});
test('duplicate outlet stock is ambiguous, not doubled', () => {
  const b=base();b.inventory.push({...b.inventory[0]});assert.equal(availability(b).onHand,null);
});
test('fractional material quantities are held for unit configuration', () => {
  const b=base();b.inventory[0].onHand=1.5;assert.equal(availability(b).canPublishForSale,false);
});
test('negative stock is preserved at source and floored only for selling', () => {
  const i=inventory({product_id:'source-1',outlet_id:'orillia',count:-3},new Date(NOW).toISOString());
  assert.equal(i.onHand,-3);const b=base();b.inventory=[i];assert.equal(availability(b).onHand,0);
});
test('untracked products require an explicit operational decision, never fake 999 stock', () => {
  const b=base();b.product=product({...fixture(),has_inventory:false},config);b.inventory=[];
  assert.equal(availability(b).canPublishForSale,false);
  const out=availability({...b,allowUntracked:true});assert.equal(out.canPublishForSale,true);assert.equal(out.onHand,null);
});
test('source missing photo or plant match does not block an eligible SKU', () => {
  const out=availability(base());assert.equal(out.canPublishForSale,true);
  assert.equal(base().product.imageUrls.length,0);
});
test('free products need explicit confirmation', () => {
  const b=base();b.product.priceMinor=0;assert.equal(availability(b).canPublishForSale,false);
  assert.equal(availability({...b,allowFree:true}).canPublishForSale,true);
});
test('rejects malformed inventory without silently replacing with zero', () => {
  for(const count of [null,undefined,'',true,'1e3','NaN',Infinity,{},Number.MAX_SAFE_INTEGER+1]) {
    assert.throws(()=>inventory({product_id:'p',outlet_id:'o',count},new Date(NOW).toISOString()));
  }
});
test('int64 cursor does not lose precision', () => {
  assert.equal(versionCursor('009007199254740993'),'9007199254740993');
  assert.throws(()=>versionCursor(9007199254740992));
  assert.throws(()=>versionCursor('9223372036854775808'));
  assert.throws(()=>versionCursor('-1'));assert.throws(()=>versionCursor('12junk'));
});
test('overflowing total stock does not produce an unsafe total', () => {
  const b=base();b.mappedOutletIds.push('brechin');b.inventory[0].onHand=Number.MAX_SAFE_INTEGER;
  b.inventory.push({...b.inventory[0],outletId:'brechin',onHand:1});
  const out=availability(b);assert.equal(out.onHand,null);assert.equal(out.canPublishForSale,false);
});
