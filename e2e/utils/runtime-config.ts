const DEFAULT_E2E_BASE_URL = 'http://127.0.0.1:8080';

export const E2E_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.BASE_URL ||
  DEFAULT_E2E_BASE_URL;