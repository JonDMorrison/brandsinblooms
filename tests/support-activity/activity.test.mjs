import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessActivity,parsePage,pagedRows,notionPages,renderActivity,reconcileActivity} from '../../supabase/functions/send-support-emails/activity.ts';
const id='10000000-0000-4000-8000-000000000001', tenant='20000000-0000-4000-8000-000000000001', user='30000000-0000-4000-8000-000000000001', other='30000000-0000-4000-8000-000000000002';
const now=Date.parse('2026-11-15T12:00:00Z');
const page={id,name:'Garden <script>',tenantId:tenant,stage:'Active',notionLogin:'2026-01-01',notionAmount:null,nextAction:'Keep current repair'};
const raw={id,properties:{'Garden Center':{title:[{plain_text:page.name}]},'Supabase Tenant ID':{rich_text:[{plain_text:tenant}]},Stage:{select:{name:'Active'}},MRR:{number:null},'Next Action':{rich_text:[{plain_text:'Keep current repair'}]}}};
const members=[{id:user,tenant_id:tenant},{id:other,tenant_id:tenant}];
const users=[{id:user,last_sign_in_at:'2026-01-01'},{id:other,last_sign_in_at:'2026-11-14'}];
test('tenant users override stale billing-contact/Notion date; recent sign-in is not usage',()=>{
 const [r]=assessActivity([page],[tenant],members,users,now);assert.equal(r.signal,'recent_sign_in');assert.match(r.detail,/not proof/);
});
test('missing, conflicting tenant links and incomplete user evidence stay unknown',()=>{
 assert.equal(assessActivity([{...page,tenantId:''}],[tenant],members,users,now)[0].signal,'identity_review');
 assert.equal(assessActivity([page,{...page,id:other}],[tenant],members,users,now)[0].signal,'identity_review');
 assert.equal(assessActivity([page],[tenant],members,users.slice(0,1),now)[0].signal,'activity_unknown');
 assert.equal(assessActivity([page],[tenant],[],[],now)[0].signal,'activity_unknown');
 const stale=assessActivity([page],[tenant],members,users.map(u=>({...u,last_sign_in_at:'2026-01-01'})),now)[0];assert.equal(stale.signal,'no_recent_sign_in');assert.match(stale.detail,/2 linked CRM users/);
});
test('null amount remains unknown; zero distinct, untrusted HTML escaped and next action retained',()=>{
 assert.equal(parsePage(raw).notionAmount,null);
 const html=renderActivity(assessActivity([page],[],[],[],now));assert.match(html,/Not recorded/);assert.doesNotMatch(html,/MRR: 0|<script>/);assert.match(html,/Keep current repair/);assert.match(html,/unverified/);
 assert.match(renderActivity([{...assessActivity([page],[],[],[],now)[0],notion_amount:0}]),/checked\): 0/);
});
test('server-capped pages continue by actual count; changing/missing totals refuse snapshot',async()=>{
 const offsets=[];assert.deepEqual(await pagedRows(async offset=>{offsets.push(offset);return {rows:[offset],total:3}}),[0,1,2]);assert.deepEqual(offsets,[0,1,2]);
 await assert.rejects(pagedRows(async()=>({rows:[],total:2})),/pagination/);
 await assert.rejects(pagedRows(async offset=>({rows:[offset],total:offset?3:2})),/changing/);
 await assert.rejects(pagedRows(async()=>({rows:[],total:NaN})),/Incomplete/);
});
test('Notion pages complete or fail; repeated cursors never return partial evidence',async()=>{
 const rows=await notionPages(async cursor=>cursor?{results:[{...raw,id:other}],has_more:false}:{results:[raw],has_more:true,next_cursor:'next'});assert.equal(rows.length,2);
 await assert.rejects(notionPages(async()=>({results:[raw],has_more:true,next_cursor:'repeat'})),/pagination/);
});
const config={notionKey:'notion',databaseId:'db',supabaseUrl:'https://db.test',serviceKey:'secret',resendKey:'mail',recipient:'staff@example.test'};
function transport({failure,claim={batch_id:null,rows:[],unconfirmed:false},mailFailure=false}={}) {
 const calls=[];
 const fetcher=async(url,init={})=>{calls.push([url,init]);
  if(url.includes('/databases/'))return Response.json({results:[raw],has_more:false});
  if(url.includes('/rest/v1/tenants?'))return Response.json([{id:tenant}],{headers:{'content-range':'0-0/1'}});
  if(url.includes('/rest/v1/users?'))return Response.json([{id:user,tenant_id:tenant}],{headers:failure==='count'?{}:{'content-range':'0-0/1'}});
  if(url.includes('/auth/')){if(failure==='auth')return new Response('failure',{status:503});return Response.json({users:[users[0]]},{headers:{'x-total-count':'1'}});}
  if(url.includes('/rpc/reconcile'))return Response.json(claim);
  if(url.includes('resend')){if(mailFailure)throw Error('uncertain');return Response.json({id:'receipt'});}
  if(url.includes('/rpc/complete'))return new Response(null,{status:204});
  throw Error('unexpected request '+url);
 };return {calls,fetcher};
}
test('dry run reads only and never sends, writes Notion or claims notifications',async()=>{
 const t=transport();const r=await reconcileActivity(config,true,t.fetcher,now);assert.equal(r.evidence[0].signal,'no_recent_sign_in');assert.ok(t.calls.every(([url])=>!url.includes('/rpc/')&&!url.includes('resend')&&!url.includes('/pages/')));
});
test('partial snapshot aborts before notification/state writes',async()=>{for(const failure of ['count','auth']){const t=transport({failure});await assert.rejects(reconcileActivity(config,false,t.fetcher,now));assert.ok(t.calls.every(([u])=>!u.includes('/rpc/')&&!u.includes('resend')));}});
test('unchanged snapshot sends nothing; one claimed batch uses stable key and receipt',async()=>{
 const t=transport();await reconcileActivity(config,false,t.fetcher,now);assert.ok(!t.calls.some(([u])=>u.includes('resend')));
 const claim={batch_id:id,rows:assessActivity([page],[],[],[],now),unconfirmed:false};const c=transport({claim});await reconcileActivity(config,false,c.fetcher,now);
 const mail=c.calls.find(([u])=>u.includes('resend'));assert.equal(mail[1].headers['Idempotency-Key'],'support-activity-'+id);assert.equal(JSON.parse(mail[1].body).to,'staff@example.test');assert.equal(c.calls.filter(([u])=>u.includes('/rpc/complete')).length,1);
});
test('uncertain delivery is not marked sent or retried; unresolved receipt stays visible',async()=>{
 const t=transport({claim:{batch_id:id,rows:assessActivity([page],[],[],[],now)},mailFailure:true});await assert.rejects(reconcileActivity(config,false,t.fetcher,now),/reconciliation/);assert.ok(!t.calls.some(([u])=>u.includes('/rpc/complete')));
 const held=transport({claim:{unconfirmed:true}});await assert.rejects(reconcileActivity(config,false,held.fetcher,now),/Earlier/);assert.ok(!held.calls.some(([u])=>u.includes('resend')));
});
test('handler dry run precedes trial sender and preserves every Next Action',()=>{
 const code=readFileSync('supabase/functions/send-support-emails/index.ts','utf8');assert.ok(code.indexOf('searchParams.get("dry_run")')<code.indexOf('new Resend'));assert.doesNotMatch(code,/'Next Action(?: Date)?':/);assert.doesNotMatch(code,/admin.listUsers|MRR:|client\(s\) inactive/);
});
