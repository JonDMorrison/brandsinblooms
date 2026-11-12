/** Infrastructure readiness only. Never writes a receipt or grants release authority. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchTrustedBrowser, runRecipe, classifyResult } from './bloom-public-attachment-recipe.mjs';
import { validatedFiles, serve } from './bloom-trusted-reproduction.mjs';

export function assertPreflightObservation(observation) {
  if (observation?.recipe !== 'public-support-attachment-name-v1' ||
      !['reproduced', 'green'].includes(observation.outcome) ||
      !observation.assertions || !observation.safety ||
      classifyResult(observation.assertions, observation.safety) !== observation.outcome) {
    throw Error('Sandboxed browser recipe infrastructure is not ready');
  }
}

export async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const { chromium } = await import('@playwright/test');
  const server = await serve(validatedFiles(path.join(root, 'dist')));
  let browser;
  try {
    browser = await launchTrustedBrowser(chromium);
    const observation = await runRecipe(browser, server.origin);
    assertPreflightObservation(observation);
    console.log(`Sandboxed Chrome ${browser.version()}: local recipe infrastructure ready (${observation.outcome}). No release proof or live verification created.`);
  } finally {
    try { if (browser) await browser.close(); }
    finally { await server.close(); }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
