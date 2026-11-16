// Read-only activity evidence. Billing contacts and Notion dates are not identity.
type ObjectValue = Record<string, unknown>;
const object = (v: unknown): ObjectValue => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as ObjectValue : {};
const text = (v: unknown): string => typeof v === 'string' ? v : '';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const richText = (v: unknown): string => Array.isArray(v) ? v.map(x => text(object(x).plain_text) || text(object(object(x).text).content)).join('') : '';
export interface Page { id: string; name: string; tenantId: string; stage: string; notionLogin: string | null; notionAmount: number | null; nextAction: string }
export interface Member { id: string; tenant_id: string | null }
export interface AuthUser { id: string; last_sign_in_at?: string | null }
export interface Evidence { page_id: string; name: string; signal: string; detail: string; notion_login: string | null; notion_amount: number | null; next_action: string }
export function parsePage(value: unknown): Page {
  const p = object(value), props = object(p.properties);
  if (!uuid.test(text(p.id)) || !p.properties) throw new Error('Incomplete Notion page');
  const property = (name: string) => object(props[name]);
  const amount = property('MRR').number;
  return { id: text(p.id), name: richText(property('Garden Center').title) || 'Unnamed pipeline record',
    tenantId: richText(property('Supabase Tenant ID').rich_text).trim().toLowerCase(), stage: text(object(property('Stage').select).name),
    notionLogin: text(object(property('Last Login').date).start) || null,
    notionAmount: typeof amount === 'number' && Number.isFinite(amount) ? amount : null,
    nextAction: richText(property('Next Action').rich_text) };
}
export function assessActivity(pages: Page[], tenants: string[], members: Member[], authUsers: AuthUser[], now: number): Evidence[] {
  const validTenants = new Set(tenants);
  const auth = new Map(authUsers.map(u => [u.id, u]));
  return pages.filter(p => p.stage === 'Active').map(p => {
    let signal = 'identity_review', detail = 'Verify the CRM tenant link; billing-contact email is not used to infer activity.';
    if (uuid.test(p.tenantId) && validTenants.has(p.tenantId) && pages.filter(x => x.tenantId === p.tenantId).length === 1) {
      const linked = members.filter(m => m.tenant_id === p.tenantId);
      const dates = linked.map(m => auth.get(m.id)?.last_sign_in_at).map(d => d ? Date.parse(d) : NaN);
      const known = dates.filter(d => Number.isFinite(d) && d <= now);
      const latest = known.length ? Math.max(...known) : null;
      if (latest !== null && now - latest < 14 * 86400000) {
        signal = 'recent_sign_in'; detail = 'A linked CRM user signed in within 14 days. This is not proof of customer usage or billing.';
      } else if (!linked.length || known.length !== linked.length) {
        signal = 'activity_unknown'; detail = 'Linked-user sign-in evidence is incomplete. Review activity; do not infer inactivity from missing data.';
      } else {
        signal = 'no_recent_sign_in'; detail = `No sign-in within 14 days was observed among ${linked.length} linked CRM users. Latest recorded sign-in: ${new Date(latest!).toISOString()}. Verify actual usage before outreach.`;
      }
    }
    return { page_id: p.id, name: p.name, signal, detail, notion_login: p.notionLogin, notion_amount: p.notionAmount, next_action: p.nextAction };
  });
}
export const escape = (s: string): string => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export function renderActivity(rows: Evidence[]): string {
  return '<h2>Activity evidence to review</h2><p>These are changes in recorded signals, not verified customer inactivity or billing. Existing follow-up tasks were not changed.</p><ul>' + rows.map(r => `<li><strong>${escape(r.name)}</strong>: ${escape(r.detail)}<br>Notion Last Login (unverified): ${escape(r.notion_login ?? 'Not recorded')}<br>Notion amount (unverified; currency and billing not checked): ${r.notion_amount === null ? 'Not recorded' : escape(String(r.notion_amount))}<br>Existing next action: ${escape(r.next_action || 'Not recorded')}<br><a href="https://www.notion.so/${r.page_id.replaceAll('-','')}">Review pipeline record</a></li>`).join('') + '</ul>';
}
export async function notionPages(read: (cursor?: string) => Promise<unknown>): Promise<Page[]> {
  const rows: Page[] = [], seen = new Set<string>(); let cursor: string | undefined;
  for (let page = 0; page < 1000; page++) {
    const data = object(await read(cursor));
    if (!Array.isArray(data.results) || typeof data.has_more !== 'boolean') throw new Error('Incomplete Notion snapshot');
    rows.push(...data.results.map(parsePage));
    if (!data.has_more) {
      if (new Set(rows.map(r=>r.id)).size !== rows.length) throw new Error('Duplicate Notion pages');
      return rows;
    }
    const next = text(data.next_cursor); if (!next || seen.has(next)) throw new Error('Invalid Notion pagination');
    seen.add(next); cursor = next;
  }
  throw new Error('Notion snapshot limit reached');
}
export async function pagedRows<T>(read: (offset: number, limit: number) => Promise<{rows:T[]; total:number}>, size = 1000): Promise<T[]> {
  const rows: T[] = []; let total: number | undefined;
  for (let page = 0; page < 10000; page++) {
    const next = await read(rows.length,size);
    if (!Array.isArray(next.rows) || !Number.isSafeInteger(next.total) || next.total < 0 || (total !== undefined && total !== next.total)) throw new Error('Incomplete or changing database snapshot');
    total = next.total; rows.push(...next.rows);
    if (rows.length === total) return rows;
    if (!next.rows.length || rows.length > total) throw new Error('Incomplete database pagination');
  }
  throw new Error('Database snapshot limit reached');
}
export interface ActivityConfig { notionKey: string; databaseId: string; supabaseUrl: string; serviceKey: string; resendKey: string; recipient: string }
export async function reconcileActivity(c: ActivityConfig, dryRun: boolean, request: typeof fetch = fetch, now = Date.now()) {
  const json = async (url: string, init: RequestInit = {}, inspect?: (response:Response)=>void): Promise<unknown> => {
    const response = await request(url,{...init,signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`Activity evidence request failed (${response.status}) at ${new URL(url).hostname}`);
    inspect?.(response);
    return response.status === 204 ? null : await response.json();
  };
  const db = (path: string, init: RequestInit = {}) => json(`${c.supabaseUrl}/rest/v1/${path}`,{...init,headers:{apikey:c.serviceKey,Authorization:`Bearer ${c.serviceKey}`,'Content-Type':'application/json',...init.headers}});
  const pages = await notionPages(cursor => json(`https://api.notion.com/v1/databases/${c.databaseId}/query`,{
    method:'POST',headers:{Authorization:`Bearer ${c.notionKey}`,'Notion-Version':'2022-06-28','Content-Type':'application/json'},
    body:JSON.stringify({page_size:100,...(cursor?{start_cursor:cursor}:{})})}));
  const dbRows = async <T>(table:string,select:string) => await pagedRows<T>(async(offset,limit)=>{
    let total = NaN;
    const rows = await json(`${c.supabaseUrl}/rest/v1/${table}?select=${select}&order=id&offset=${offset}&limit=${limit}`,{
      headers:{apikey:c.serviceKey,Authorization:`Bearer ${c.serviceKey}`,Prefer:'count=exact'}
    }, response => {
      const range = response.headers.get('content-range')?.match(/^(?:[0-9]+-[0-9]+|\*)\/([0-9]+)$/);
      if (range) total = Number(range[1]);
    });
    return {rows:rows as T[],total};
  });
  const tenants = await dbRows<{id:string}>('tenants','id');
  const members = await dbRows<Member>('users','id,tenant_id');
  let authPage = 0;
  const authUsers = await pagedRows<AuthUser>(async(_offset,limit)=>{
    let total = NaN;
    const result = object(await json(`${c.supabaseUrl}/auth/v1/admin/users?page=${++authPage}&per_page=${limit}`,{headers:{apikey:c.serviceKey,Authorization:`Bearer ${c.serviceKey}`}}, response=>{
      const count = response.headers.get('x-total-count');
      if (count !== null && /^[0-9]+$/.test(count)) total=Number(count);
    }));
    if (!Array.isArray(result.users)) throw new Error('Incomplete auth snapshot');
    return {rows:result.users as AuthUser[],total};
  });
  if (authUsers.some(u=>!uuid.test(u.id)) || members.some(u=>!uuid.test(u.id) || (u.tenant_id !== null && !uuid.test(u.tenant_id))) || tenants.some(t=>!uuid.test(t.id)) ||
    new Set(authUsers.map(u=>u.id)).size !== authUsers.length || new Set(members.map(u=>u.id)).size !== members.length || new Set(tenants.map(t=>t.id)).size !== tenants.length) throw new Error('Inconsistent paginated snapshot');
  const evidence = assessActivity(pages,tenants.map(t=>t.id),members,authUsers,now);
  if (dryRun) return {dry_run:true,records_checked:evidence.length,evidence};
  const claim = object(await db('rpc/reconcile_support_activity_snapshot',{method:'POST',body:JSON.stringify({p_scope:c.databaseId,p_recipient:c.recipient,p_rows:evidence,p_observed_at:new Date(now).toISOString()})}));
  if (claim.batch_id) {
    const rows = claim.rows as Evidence[];
    // Persist sending intent first. Uncertain outcomes are not blindly retried.
    try {
      const result = object(await json('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${c.resendKey}`,'Content-Type':'application/json','Idempotency-Key':`support-activity-${claim.batch_id}`},body:JSON.stringify({from:'BloomSuite System <system@bloomsuite.app>',to:c.recipient,subject:`BloomSuite activity review — ${rows.length} changed signals`,html:renderActivity(rows)})}));
      if (typeof result.id !== 'string' || !result.id) throw new Error('Delivery receipt missing');
      await db('rpc/complete_support_activity_notice',{method:'POST',body:JSON.stringify({p_batch:claim.batch_id,p_provider_id:result.id})});
    } catch {
      throw new Error('Activity notice delivery needs reconciliation; no automatic resend. Review support_activity_notifications.');
    }
  }
  if (claim.unconfirmed) throw new Error('Earlier activity notice delivery needs reconciliation; no automatic resend.');
  return {records_checked:evidence.length,changed_signals:claim.batch_id ? (claim.rows as Evidence[]).length : 0};
}
