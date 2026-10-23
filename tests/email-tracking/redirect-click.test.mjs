import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const source = stripTypeScriptTypes(readFileSync(new URL('../../supabase/functions/redirect-click/index.ts', import.meta.url), 'utf8').replace(/^import .*\n/gm, ''));
const cid = '11111111-1111-4111-8111-111111111111';
const lid = '22222222-2222-4222-8222-222222222222';
const tenant = '33333333-3333-4333-8333-333333333333';
function harness() {
  let handler;
  const events = [];
  const db = { from(table) {
    if (table === 'email_tracking_events') return { async insert(row) {
      assert.ok(row.event_data.email_id?.trim(), 'database requires event_data.email_id');
      assert.ok(row.provider_message_id);
      assert.ok(row.event_ts_provider);
      events.push(row);
      return { error: null };
    }};
    const query = { select() { return this; }, eq() { return this; }, async single() { return { data: {url: 'https://example.com/workshop', campaign_id: cid, tenant_id: tenant} }; } };
    return query;
  }};
  vm.runInNewContext(source, { serve: fn => handler = fn, createClient: () => db, Deno: {env: {get: () => 'test'}}, Request, Response, URL, TextEncoder, crypto, console: {log(){},warn(){},error(){}} });
  return { events, click: (ua = 'Mozilla/5.0') => handler(new Request(`https://example.com/?cid=${cid}&lid=${lid}&t=${tenant}`, {headers: {'user-agent': ua}})) };
}
test('click persists required identity and redirects to the original destination', async () => {
  const h = harness();
  const r = await h.click();
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), 'https://example.com/workshop');
  assert.equal(h.events.length, 1);
  assert.equal(h.events[0].event_type, 'clicked');
  assert.equal(h.events[0].event_data.email_id, h.events[0].provider_message_id);
  assert.equal(h.events[0].is_mpp_guess, false);
});
test('repeat clicks retain distinct identities instead of colliding in the unique index', async () => {
  const h = harness(); await h.click(); await h.click();
  assert.notEqual(h.events[0].event_data.email_id, h.events[1].event_data.email_id);
});
test('scanner clicks stay classified separately', async () => {
  const h = harness(); await h.click('curl/8.0');
  assert.equal(h.events[0].is_mpp_guess, true);
});
