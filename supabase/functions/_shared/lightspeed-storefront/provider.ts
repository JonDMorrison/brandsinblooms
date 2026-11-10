/** Edition is bound to OAuth state and persisted credentials, never selected by a read request. */
import { asSourceRecord, LightspeedShapeError, sourceId, type SourceRecord } from './normalize.ts';
import { buildLightspeedAuthorizationUrl, exchangeLightspeedToken, LIGHTSPEED_READ_SCOPES,
  lightspeedRequest, lightspeedStoreOrigin, type LightspeedResource, type LightspeedTokenResponse } from './client.ts';
export type LightspeedEdition = 'x-series' | 'r-series';
export function lightspeedEdition(value: unknown): LightspeedEdition {
  if (value == null || value === 'x-series') return 'x-series';
  if (value === 'r-series') return value;
  throw new LightspeedShapeError('edition');
}
export const R_SCOPES = ['employee:inventory_read'] as const;
const R_AUTH = 'https://cloud.lightspeedapp.com';
const R_API = 'https://api.lightspeedapp.com';
const resources = { products: ['Item', 'itemID'], inventory: ['ItemShop', 'itemShopID'], outlets: ['Shop', 'shopID'] } as const;
function numericId(value: unknown): string {
  const id = sourceId(value);
  if (!id || !/^[1-9]\d{0,18}$/.test(id)) throw new LightspeedShapeError('account_or_record_id');
  return id;
}
function rows(value: unknown): SourceRecord[] {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : [value];
  if (list.length > 100 || list.some(v => !asSourceRecord(v))) throw new LightspeedShapeError('r_series_records');
  return list as SourceRecord[];
}
function flag(value: unknown): boolean | null {
  return value === true || value === 'true' ? true : value === false || value === 'false' ? false : null;
}
export function providerAuthorizationUrl(edition: LightspeedEdition, input: {clientId:string;redirectUri:string;state:string}): string {
  const validated = new URL(buildLightspeedAuthorizationUrl(input));
  if (edition === 'x-series') return validated.toString();
  const url = new URL('/auth/oauth/authorize', R_AUTH);
  url.search = validated.search;
  url.searchParams.set('scope', R_SCOPES.join(' '));
  return url.toString();
}
export function validAuthorizationTarget(url: URL, edition: LightspeedEdition): boolean {
  return !url.username && !url.password && !url.hash && (edition === 'r-series'
    ? url.origin === R_AUTH && url.pathname === '/auth/oauth/authorize'
    : url.origin === 'https://secure.retail.lightspeed.app' && url.pathname === '/connect');
}
export async function providerToken(edition: LightspeedEdition, input: Parameters<typeof exchangeLightspeedToken>[0]): Promise<LightspeedTokenResponse> {
  if (edition === 'x-series') return exchangeLightspeedToken(input);
  if (!input.clientId || !input.clientSecret) throw new LightspeedShapeError('oauth_configuration');
  const body = new URLSearchParams({client_id:input.clientId,client_secret:input.clientSecret,grant_type:input.grant.kind});
  if (input.grant.kind === 'authorization_code') {body.set('code',input.grant.code);body.set('redirect_uri',input.redirectUri);}
  else body.set('refresh_token',input.grant.token);
  const raw = asSourceRecord(await lightspeedRequest(input.fetcher ?? fetch, new URL('/auth/oauth/token',R_AUTH), {
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:body.toString(),
  }));
  const now = input.now ?? Date.now();
  if (!raw || typeof raw.access_token !== 'string' || !raw.access_token || typeof raw.refresh_token !== 'string' || !raw.refresh_token ||
      /[\r\n]/.test(raw.access_token + raw.refresh_token) || String(raw.token_type).toLowerCase() !== 'bearer' ||
      typeof raw.expires_in !== 'number' || !Number.isFinite(raw.expires_in) || raw.expires_in <= 0 || raw.expires_in > 86400) {
    throw new LightspeedShapeError('oauth_token_response');
  }
  // R-Series does not document a scope field in its token response. Request only
  // inventory_read; actual read permissions are verified by account/shop/item GETs.
  const scopes = typeof raw.scope === 'string' ? raw.scope.split(/\s+/) : [...R_SCOPES];
  return {accessToken:raw.access_token,refreshToken:raw.refresh_token,expiresAt:new Date(now+raw.expires_in*1000).toISOString(),domainPrefix:input.prefix,scopes};
}
export function providerScopes(edition: LightspeedEdition): readonly string[] {return edition === 'r-series' ? R_SCOPES : LIGHTSPEED_READ_SCOPES;}
async function get(url: URL, token: string, fetcher: typeof fetch): Promise<unknown> {
  return lightspeedRequest(fetcher,url,{method:'GET',headers:{Accept:'application/json',Authorization:`Bearer ${token}`}});
}
export async function providerRetailer(edition: LightspeedEdition, prefix:string, token:string, fetcher:typeof fetch=fetch):Promise<SourceRecord> {
  if (edition === 'x-series') {
    const envelope = asSourceRecord(await get(new URL('/api/2.0/retailer',lightspeedStoreOrigin(prefix)),token,fetcher));
    const data = asSourceRecord(envelope?.data); if (!data) throw new LightspeedShapeError('retailer');
    // X-Series API 2.0 returns RetailerCurrency {code, symbol}, not a string.
    // Normalize only the provider shape; authority still validates the ISO code.
    const currency = typeof data.currency === 'string' ? data.currency : asSourceRecord(data.currency)?.code;
    return {...data, currency};
  }
  const envelope = asSourceRecord(await get(new URL('/API/V3/Account.json',R_API),token,fetcher));
  const accounts = rows(envelope?.Account);
  if (accounts.length !== 1) throw new LightspeedShapeError('ambiguous_account');
  const id = numericId(accounts[0].accountID);
  const detail = asSourceRecord(await get(new URL(`/API/V3/Account/${id}.json`,R_API),token,fetcher));
  const account = asSourceRecord(detail?.Account) ?? detail;
  const currency = asSourceRecord(account?.defaultCurrency)?.code;
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) throw new LightspeedShapeError('retailer_currency');
  return {id,currency,name:accounts[0].name};
}
/** Canonical source projection consumed by the existing staged importer. IDs are
 * namespaced so switching editions can never collide with X-Series product IDs.
 * Prices are deliberately held for review: R-Series shop price levels and tax
 * inclusion cannot safely be inferred from Item.Prices alone. */
export function projectRRecord(resource: LightspeedResource, row: SourceRecord): SourceRecord | null {
  if (resource === 'products') return {id:`r:${numericId(row.itemID)}`,name:row.description,
    sku: typeof row.customSku === 'string' && row.customSku ? row.customSku : row.systemSku,
    active:flag(row.archived) === null ? null : !flag(row.archived),
    has_inventory:row.itemType === 'non_inventory' ? false : row.itemType === 'default' ? true : null,
    price_excluding_tax:null,price_including_tax:null, r_series_source:row};
  if (resource === 'outlets') return {id:`r:${numericId(row.shopID)}`,name:row.name,
    active:flag(row.archived) === false, r_series_source:row};
  // shopID 0 is the aggregate, not a location. Never count it as pickup stock.
  if (String(row.shopID) === '0') return null;
  return {product_id:`r:${numericId(row.itemID)}`,outlet_id:`r:${numericId(row.shopID)}`,count:row.qoh};
}
export function rPageUrl(accountId:string,resource:LightspeedResource,cursor:unknown):URL {
  const account = numericId(accountId), spec = resources[resource];
  if (!spec) throw new LightspeedShapeError('resource');
  const path = `/API/V3/Account/${account}/${spec[0]}.json`;
  const url = cursor == null ? new URL(path,R_API) :
    typeof cursor === 'string' && cursor.startsWith('r:') && cursor.length <= 2048 ? new URL(cursor.slice(2)) : null;
  if (!url || url.origin !== R_API || url.pathname !== path || url.username || url.password || url.hash) throw new LightspeedShapeError('pagination_scope');
  if (cursor == null) {url.searchParams.set('limit','100');url.searchParams.set('sort',spec[1]);}
  const allowed = new Set(['limit','sort','after']);
  for (const key of url.searchParams.keys()) if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) throw new LightspeedShapeError('pagination_query');
  if (url.searchParams.get('limit') !== '100' || url.searchParams.get('sort') !== spec[1] ||
      (cursor != null && !url.searchParams.get('after'))) throw new LightspeedShapeError('pagination_query');
  return url;
}
export async function rSourcePage(accountId:string,resource:LightspeedResource,cursor:string|null,token:string,fetcher:typeof fetch=fetch):Promise<SourceRecord> {
  const url = rPageUrl(accountId,resource,cursor);
  const raw = asSourceRecord(await get(url,token,fetcher));
  const attrs = asSourceRecord(raw?.['@attributes']);
  if (!raw || !attrs || typeof attrs.next !== 'string') throw new LightspeedShapeError('r_series_page');
  const source = rows(raw[resources[resource][0]]);
  const next = attrs.next ? `r:${rPageUrl(accountId,resource,`r:${attrs.next}`).toString()}` : null;
  if (next && (next === cursor || source.length === 0)) throw new LightspeedShapeError('non_advancing_cursor');
  return {edition:'r-series',data:source.map(row=>projectRRecord(resource,row)).filter(row=>row!==null),nextCursor:next,complete:next===null};
}
