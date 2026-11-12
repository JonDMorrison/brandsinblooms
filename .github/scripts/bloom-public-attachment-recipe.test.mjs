import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedRequest, classifyResult, runRecipe, launchTrustedBrowser } from './bloom-public-attachment-recipe.mjs';

const safety = { nonGetAttempts: 0, externalGetBlocked: 0, webSocketAttempts: 0, serviceWorkerAttempts: 0, redirectsBlocked: 0, networkFailures: 0 };
const control = { controlAccepted: true, controlRemoved: true, formUnsubmitted: true };
const red = { ...control, overlongAccepted: true, overlongRejected: false, filenameLimitWarning: false };
const green = { ...control, overlongAccepted: false, overlongRejected: true, filenameLimitWarning: true };

test('shared launcher uses official system Chrome with its sandbox and no fallback', async () => {
  let options;
  const sentinel = {};
  const browser = await launchTrustedBrowser({ launch(value) { options = value; return Promise.resolve(sentinel); } });
  assert.equal(browser, sentinel);
  assert.deepEqual(options, {
    channel: 'chrome', headless: true, chromiumSandbox: true,
    args: ['--disable-background-networking', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],
  });
  let attempts = 0;
  await assert.rejects(launchTrustedBrowser({ launch() { attempts++; return Promise.reject(Error('sandbox unavailable')); } }), /sandbox unavailable/);
  assert.equal(attempts, 1);
});

test('infrastructure preflight accepts only exact safe recipe observations, not release proof', async () => {
  const { assertPreflightObservation } = await import('./bloom-browser-preflight.mjs');
  const observation = { recipe: 'public-support-attachment-name-v1', outcome: 'green', assertions: green, safety };
  assertPreflightObservation(observation);
  assertPreflightObservation({ ...observation, outcome: 'reproduced', assertions: red });
  for (const patch of [{ outcome: 'setup_failure' }, { outcome: 'unknown' }, { recipe: 'other' }, { assertions: red },
    { safety: { ...safety, nonGetAttempts: 1 } }, { assertions: null }, { safety: null }]) {
    assert.throws(() => assertPreflightObservation({ ...observation, ...patch }));
  }
  assert.throws(() => assertPreflightObservation(null));
});

test('only same-origin GET is allowed, never writes, credentials or external requests', () => {
  const origin = 'http://127.0.0.1:4173';
  assert.equal(allowedRequest('GET', `${origin}/assets/app.js`, origin), true);
  for (const method of ['POST','PUT','PATCH','DELETE','OPTIONS','HEAD']) assert.equal(allowedRequest(method, `${origin}/support/contact`, origin), false);
  for (const url of ['https://example.com/a', 'http://127.0.0.1:4174/a', 'http://u:p@127.0.0.1:4173/a', 'data:text/plain,a', 'malformed']) {
    assert.equal(allowedRequest('GET', url, origin), false);
  }
});

test('classifies only the exact boundary failure as reproduced', () => {
  assert.equal(classifyResult(red, safety), 'reproduced');
  assert.equal(classifyResult(green, safety), 'green');
  for (const key of ['controlAccepted','controlRemoved','formUnsubmitted']) {
    assert.equal(classifyResult({ ...red, [key]: false }, safety), 'setup_failure');
    assert.equal(classifyResult({ ...green, [key]: false }, safety), 'setup_failure');
  }
  for (const observation of [{ ...control }, { ...green, filenameLimitWarning: false },
    { ...green, overlongAccepted: true }, { ...red, filenameLimitWarning: true }]) {
    assert.equal(classifyResult(observation, safety), 'setup_failure');
  }
});

test('mutation, websocket and service-worker attempts invalidate either leg', () => {
  for (const key of ['nonGetAttempts','webSocketAttempts','serviceWorkerAttempts','redirectsBlocked','networkFailures']) {
    assert.equal(classifyResult(red, { ...safety, [key]: 1 }), 'setup_failure');
    assert.equal(classifyResult(green, { ...safety, [key]: 1 }), 'setup_failure');
  }
  assert.equal(classifyResult(green, { ...safety, externalGetBlocked: 1 }), 'green');
});

test('setup errors return fixed stage metadata without exposing error text', async () => {
  const result = await runRecipe({ newContext() { throw Error('candidate-controlled text'); } }, 'http://127.0.0.1:4173');
  assert.equal(result.outcome, 'setup_failure');
  assert.equal(result.stage, 'create_context');
  assert.equal(JSON.stringify(result).includes('candidate-controlled'), false);
});

test('rejects noncanonical or credential-bearing origins before creating a browser context', async () => {
  for (const origin of ['https://example.com/path', 'https://u:p@example.com', 'https://example.com/', 'file:///tmp/app']) {
    let created = false;
    const result = await runRecipe({ newContext() { created = true; throw Error(); } }, origin);
    assert.equal(result.outcome, 'setup_failure');
    assert.equal(created, false);
  }
});
