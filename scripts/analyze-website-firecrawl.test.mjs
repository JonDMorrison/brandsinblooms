import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

// Execute the actual Edge handler, replacing only runtime imports, env and network.
const source = readFileSync(new URL('../supabase/functions/analyze-website/index.ts', import.meta.url), 'utf8');
const executable = stripTypeScriptTypes(source.replace(/^import .*;\n/gm, ''));
const content = 'Synthetic Garden Center sells plants and offers gardening advice. '.repeat(8);
const html = `<html><body>${content}<footer>Portland, OR 97201</footer></body></html>`;
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });

function harness({ directFails = true, fallbackStatus = 200, fallbackSuccess = true, brandingFails = false, malformedFallback = false, signedIn = true, member = true } = {}) {
  let handler;
  const calls = [];
  const context = vm.createContext({
    Response, Request, URL, AbortController, setTimeout: (fn, ms) => setTimeout(fn, ms).unref(), clearTimeout,
    console: { log() {}, error() {} },
    Deno: { env: { get: () => 'synthetic-test-key' } },
    serve: (fn) => { handler = fn; },
    // The caller check (central-login 59, crm-r2-F16): a verified session and a CRM member, without network.
    createClient: () => ({ auth: { getUser: async () => (signedIn ? { data: { user: { id: 'synthetic-user' } }, error: null } : { data: { user: null }, error: { message: 'invalid token' } }) } }),
    callerTenantId: async () => (member ? 'synthetic-tenant' : null),
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url === 'https://example.com') {
        if (directFails) throw new Error('Synthetic direct fetch failure');
        return new Response(html, { headers: { "content-type": "text/html" } });
      }
      if (url === 'https://api.firecrawl.dev/v2/scrape') {
        const body = JSON.parse(options.body);
        if (body.formats.includes('branding')) {
          if (brandingFails) return json({ error: 'unavailable' }, 503);
          return json({ success: true, data: { branding: { colors: { primary: '#123456', textPrimary: '#111111' }, images: { logo: 'https://example.com/logo.png' }, colorScheme: 'light', fonts: [{ family: 'Arial' }] } } });
        }
        if (malformedFallback) return new Response('not json');
        return json({ success: fallbackSuccess, data: { markdown: content, html } }, fallbackStatus);
      }
      if (url === 'https://api.openai.com/v1/chat/completions') return json({ choices: [{ message: { content: JSON.stringify({ businessName: 'Synthetic Garden Center' }) } }] });
      throw new Error(`Unexpected network call: ${url}`);
    },
    // The public-website check (central-login 59, crm-r2-F17) imports this from the Bloom Support module.
    isPrivateVerificationHost: (host) => host === 'localhost' || host.endsWith('.internal'),
  });
  vm.runInContext(executable, context);
  const request = (body = { websiteUrl: 'https://example.com' }, authenticated = true) => handler(new Request('https://local.test', { method: 'POST', headers: authenticated ? { Authorization: 'Bearer synthetic' } : {}, body: JSON.stringify(body) }));
  return { request, calls };
}

test('fallback and branding use v2 and preserve consumer output', async () => {
  const { request, calls } = harness();
  const response = await request();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.extractionMethod, 'firecrawl');
  assert.equal(result.brandingData.primaryColor, '#123456');
  assert.equal(result.brandingData.logo, 'https://example.com/logo.png');
  assert.equal(result.locationExtraction.postal_code, '97201');
  const providerCalls = calls.filter(c => c.url.includes('firecrawl'));
  assert.equal(providerCalls.length, 2);
  assert.deepEqual(providerCalls.map(c => JSON.parse(c.options.body).formats), [['markdown', 'html'], ['branding']]);
  assert.equal(JSON.parse(providerCalls[0].options.body).onlyMainContent, false);
  assert.equal(JSON.parse(providerCalls[0].options.body).timeout, 15000);
  assert.equal(JSON.parse(providerCalls[1].options.body).timeout, 10000);
});

test('successful direct fetch skips paid fallback; branding remains optional', async () => {
  const { request, calls } = harness({ directFails: false, brandingFails: true });
  const response = await request();
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.extractionMethod, 'direct');
  assert.equal(result.brandingData, null);
  assert.equal(calls.filter(c => c.url.includes('firecrawl')).length, 1);
});

for (const options of [{ fallbackStatus: 402 }, { fallbackStatus: 429 }, { fallbackStatus: 503 }, { fallbackSuccess: false }, { malformedFallback: true }]) {
  test(`fallback failure does not retry or start branding: ${JSON.stringify(options)}`, async () => {
    const { request, calls } = harness(options);
    assert.equal((await request()).status, 422);
    assert.equal(calls.filter(c => c.url.includes('firecrawl')).length, 1);
    assert.equal(calls.filter(c => c.url.includes('openai')).length, 0);
  });
}

test('missing authorization fails before any network call', async () => {
  const { request, calls } = harness();
  assert.equal((await request({}, false)).status, 401);
  assert.equal(calls.length, 0);
});

test('an unverified token or a non-member is refused before any provider call', async () => {
  for (const [options, status] of [[{ signedIn: false }, 401], [{ member: false }, 403]]) {
    const { request, calls } = harness(options);
    assert.equal((await request()).status, status);
    assert.equal(calls.length, 0);
  }
});

test('no runtime Firecrawl v1 endpoint remains', () => {
  assert.doesNotMatch(source, /api\.firecrawl\.dev\/v1\//);
});

test('a private or internal website address is refused before any network call', async () => {
  for (const websiteUrl of ['http://localhost:8080/', 'http://10.0.0.1/', 'http://[::1]/', 'https://metadata.google.internal/', 'https://user@example.com/']) {
    const { request, calls } = harness();
    assert.equal((await request({ websiteUrl })).status, 400, websiteUrl);
    assert.equal(calls.length, 0, websiteUrl);
  }
});
