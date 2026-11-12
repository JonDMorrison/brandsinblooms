// Trusted browser-side orchestration. This file is selected from a trusted
// workflow revision, never from the candidate checkout or a candidate report.
// The caller supplies an isolated static app server and a fresh Browser, not a
// signed-in user context. This recipe never submits the public support form.
const TIMEOUT = 15_000;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==', 'base64');
const CONTROL_NAME = `${'c'.repeat(196)}.png`;
const OVERLONG_NAME = `${'r'.repeat(197)}.png`;

// Ubuntu's packaged Chrome is AppArmor-allowlisted at its official path.
// Never fall back to an unsandboxed or caller-supplied browser executable.
export function launchTrustedBrowser(chromium) {
  return chromium.launch({
    channel: 'chrome', headless: true, chromiumSandbox: true,
    args: ['--disable-background-networking', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],
  });
}

export function allowedRequest(method, requestUrl, origin) {
  try {
    const url = new URL(requestUrl);
    return method === 'GET' && url.origin === origin && !url.username && !url.password;
  } catch { return false; }
}

export function classifyResult(assertions, safety) {
  // A broken page, bad control, ambiguous DOM or any mutation attempt cannot
  // stand in for the one expected baseline failure.
  if (safety.nonGetAttempts !== 0 || safety.webSocketAttempts !== 0 ||
      safety.serviceWorkerAttempts !== 0 || safety.redirectsBlocked !== 0 || safety.networkFailures !== 0 || assertions.controlAccepted !== true ||
      assertions.controlRemoved !== true || assertions.formUnsubmitted !== true) return 'setup_failure';
  if (assertions.overlongRejected === true && assertions.filenameLimitWarning === true &&
      assertions.overlongAccepted === false) return 'green';
  if (assertions.overlongAccepted === true && assertions.overlongRejected === false &&
      assertions.filenameLimitWarning === false) return 'reproduced';
  return 'setup_failure';
}

export async function runRecipe(browser, origin) {
  const assertions = {
    controlAccepted: false, controlRemoved: false, overlongAccepted: false,
    overlongRejected: false, filenameLimitWarning: false, formUnsubmitted: false,
  };
  const safety = { nonGetAttempts: 0, externalGetBlocked: 0, webSocketAttempts: 0, serviceWorkerAttempts: 0, redirectsBlocked: 0, networkFailures: 0 };
  let context;
  let stage = 'create_context';
  let result;
  try {
    const target = new URL(origin);
    if (!['http:', 'https:'].includes(target.protocol) || target.origin !== origin ||
      target.username || target.password) throw new Error('Invalid isolated app origin');
    context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false });
    context.setDefaultTimeout(TIMEOUT);
    context.setDefaultNavigationTimeout(TIMEOUT);
    context.on('serviceworker', () => { safety.serviceWorkerAttempts++; });
    await context.route('**/*', async route => {
      const request = route.request();
      if (request.method() !== 'GET') safety.nonGetAttempts++;
      else if (!allowedRequest(request.method(), request.url(), origin)) safety.externalGetBlocked++;
      if (!allowedRequest(request.method(), request.url(), origin)) {
        await route.abort('blockedbyclient');
        return;
      }
      try {
        // Never let a same-origin URL redirect outside the sandbox: routing
        // alone must not be relied on to intercept every redirect hop.
        const response = await route.fetch({ maxRedirects: 0, maxRetries: 0, timeout: TIMEOUT });
        if (response.status() >= 300 && response.status() < 400) {
          safety.redirectsBlocked++;
          await route.abort('blockedbyclient');
        } else await route.fulfill({ response });
      } catch {
        safety.networkFailures++;
        await route.abort('failed').catch(() => {});
      }
    });
    // Fail setup rather than running without WebSocket interception on an old
    // Playwright version. The context is fresh, so none can predate this route.
    await context.routeWebSocket('**/*', socket => {
      safety.webSocketAttempts++;
      socket.close({ code: 1008, reason: 'Recipe blocks WebSockets' });
    });
    const page = await context.newPage();
    stage = 'load_public_support';
    const response = await page.goto(`${origin}/support/contact`, { waitUntil: 'domcontentloaded' });
    if (!response || response.status() !== 200 || new URL(page.url()).origin !== origin || new URL(page.url()).pathname !== '/support/contact') {
      throw new Error('Public support page did not load');
    }
    const picker = page.getByTestId('public-support-files');
    const send = page.getByRole('button', { name: 'Send', exact: true });
    await picker.waitFor({ state: 'attached' });
    await send.waitFor({ state: 'visible' });
    if (!(await send.isDisabled())) throw new Error('Blank support form is not safely disabled');

    stage = 'control_200_character_name';
    await picker.setInputFiles({ name: CONTROL_NAME, mimeType: 'image/png', buffer: PNG });
    const controlChip = page.getByTitle(CONTROL_NAME, { exact: true });
    const controlRemove = page.getByRole('button', { name: `Remove ${CONTROL_NAME}`, exact: true })
      .and(page.locator('button[type="button"]'));
    await controlChip.waitFor({ state: 'visible' });
    await controlRemove.waitFor({ state: 'visible' });
    assertions.controlAccepted = await controlChip.count() === 1 && await controlRemove.count() === 1 &&
      await page.getByRole('alert').count() === 0;
    if (!assertions.controlAccepted) throw new Error('200-character control was not cleanly accepted');
    // The existing Joy chip decorator blocks pointer hits on its IconButton.
    // Use its real accessible keyboard action, not force-click or DOM dispatch;
    // this recipe proves the filename boundary, not that separate pointer bug.
    stage = 'remove_200_character_control';
    if (!(await controlRemove.isEnabled())) throw new Error('Control removal is disabled');
    await controlRemove.focus();
    await controlRemove.press('Enter');
    await controlChip.waitFor({ state: 'detached' });
    assertions.controlRemoved = await controlRemove.count() === 0;

    stage = 'boundary_201_character_name';
    await picker.setInputFiles({ name: OVERLONG_NAME, mimeType: 'image/png', buffer: PNG });
    const overlongChip = page.getByTitle(OVERLONG_NAME, { exact: true });
    const overlongRemove = page.getByRole('button', { name: `Remove ${OVERLONG_NAME}`, exact: true });
    const boundaryWarning = page.getByRole('alert').filter({ hasText: OVERLONG_NAME });
    await overlongChip.or(boundaryWarning).first().waitFor({ state: 'visible' });
    const warningText = await boundaryWarning.count() === 1 ? await boundaryWarning.innerText() : '';
    assertions.overlongAccepted = await overlongChip.count() === 1 && await overlongRemove.count() === 1;
    assertions.overlongRejected = await overlongChip.count() === 0 && await overlongRemove.count() === 0;
    assertions.filenameLimitWarning = warningText.includes(OVERLONG_NAME) && /\b200\b/.test(warningText);
    if (new URL(page.url()).origin !== origin || new URL(page.url()).pathname !== '/support/contact') throw new Error('Recipe left its exact route');
    assertions.formUnsubmitted = await picker.count() === 1 && await send.isVisible() && await send.isDisabled();
    result = { recipe: 'public-support-attachment-name-v1', outcome: classifyResult(assertions, safety), observed_origin: new URL(page.url()).origin, observed_path: new URL(page.url()).pathname, assertions, safety };
  } catch {
    // Never reflect arbitrary candidate page text/error strings into Actions
    // outputs or a receipt. Only these trusted stage names cross that boundary.
    result = { recipe: 'public-support-attachment-name-v1', outcome: 'setup_failure', stage, assertions, safety };
  } finally {
    if (context) {
      try { await context.close(); }
      catch { result = { recipe: 'public-support-attachment-name-v1', outcome: 'setup_failure', stage: 'close_context', assertions, safety }; }
    }
  }
  // Reclassify after closing so a late blocked mutation cannot be overlooked.
  if (result.outcome !== 'setup_failure') result.outcome = classifyResult(assertions, safety);
  return result;
}
