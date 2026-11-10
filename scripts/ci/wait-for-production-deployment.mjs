import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DEFAULT_ENVIRONMENT = "Production";
const DEFAULT_POLL_INTERVAL_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 12 * 60_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_REQUEST_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 750;
const MAX_RETRY_AFTER_MS = 10_000;
const VERCEL_BOT_LOGIN = "vercel[bot]";
const VERCEL_DEPLOYMENT_HOST =
  /^brandsinblooms-[a-z0-9]+-brands-in-blooms\.vercel\.app$/i;
const TERMINAL_FAILURE_STATES = new Set(["error", "failure", "inactive"]);

function assertRepository(repository) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("GITHUB_REPOSITORY must use the owner/repository format");
  }
}

function assertSha(sha) {
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error("GITHUB_SHA must be a full 40-character commit SHA");
  }
}

function isTransientStatus(status) {
  return (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function retryAfterMs(response, now) {
  const value = response.headers?.get?.("retry-after")?.trim();
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, MAX_RETRY_AFTER_MS);
  }

  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return null;
  return Math.min(Math.max(0, retryAt - now()), MAX_RETRY_AFTER_MS);
}

function errorMessage(error) {
  if (error instanceof Error && error.name === "AbortError") {
    return "request timed out";
  }
  return error instanceof Error ? error.message : String(error);
}

async function requestJson(
  fetchImpl,
  url,
  token,
  {
    requestTimeoutMs,
    requestAttempts,
    retryDelayMs,
    remainingMs,
    now,
    sleep,
    logger,
  },
) {
  let lastFailure = "unknown failure";

  for (let attempt = 1; attempt <= requestAttempts; attempt += 1) {
    const availableMs = remainingMs();
    if (availableMs <= 0) {
      throw new Error(
        `GitHub deployments API request deadline expired (${lastFailure})`,
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(1, Math.min(requestTimeoutMs, availableMs)),
    );
    let response;

    try {
      response = await fetchImpl(url, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "bloomsuite-production-e2e",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: controller.signal,
      });
    } catch (error) {
      lastFailure = errorMessage(error);
      if (attempt === requestAttempts) {
        clearTimeout(timeout);
        throw new Error(
          `GitHub deployments API request failed after ${attempt} attempts (${lastFailure})`,
        );
      }
    }

    if (response?.ok) {
      try {
        const body = await response.json();
        clearTimeout(timeout);
        return body;
      } catch (error) {
        lastFailure = `invalid JSON: ${errorMessage(error)}`;
        if (attempt === requestAttempts) {
          clearTimeout(timeout);
          throw new Error(
            `GitHub deployments API request failed after ${attempt} attempts (${lastFailure})`,
          );
        }
      }
    } else if (response) {
      lastFailure = `HTTP ${response.status}`;
      if (!isTransientStatus(response.status) || attempt === requestAttempts) {
        clearTimeout(timeout);
        throw new Error(
          `GitHub deployments API returned HTTP ${response.status}`,
        );
      }
    }
    clearTimeout(timeout);

    const retryWindowMs = remainingMs();
    if (retryWindowMs <= 0) {
      throw new Error(
        `GitHub deployments API request deadline expired (${lastFailure})`,
      );
    }
    const delayMs = Math.min(
      retryAfterMs(response ?? {}, now) ?? retryDelayMs * 2 ** (attempt - 1),
      retryWindowMs,
    );
    logger.log(
      `Retrying GitHub deployments API after ${lastFailure} (attempt ${attempt + 1}/${requestAttempts}).`,
    );
    if (delayMs > 0) await sleep(delayMs);
  }

  throw new Error(`GitHub deployments API request failed (${lastFailure})`);
}

export function validateVercelDeploymentUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "Successful Vercel deployment did not provide a valid environment URL",
    );
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !VERCEL_DEPLOYMENT_HOST.test(url.hostname)
  ) {
    throw new Error(
      "Successful Vercel deployment did not provide the expected immutable deployment origin",
    );
  }

  return url.origin;
}

export function selectExactDeployment(deployments, sha, environment) {
  if (!Array.isArray(deployments)) {
    throw new Error("GitHub deployments API returned an invalid response");
  }

  return deployments
    .filter(
      (deployment) =>
        deployment?.sha === sha &&
        deployment?.environment?.toLowerCase() === environment.toLowerCase() &&
        deployment?.creator?.login === VERCEL_BOT_LOGIN,
    )
    .sort((left, right) => {
      const createdDifference =
        Date.parse(right.created_at ?? "") - Date.parse(left.created_at ?? "");
      if (Number.isFinite(createdDifference) && createdDifference !== 0) {
        return createdDifference;
      }
      return Number(right.id ?? 0) - Number(left.id ?? 0);
    })[0];
}

export async function waitForProductionDeployment({
  repository,
  sha,
  token,
  environment = DEFAULT_ENVIRONMENT,
  fetchImpl = fetch,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  requestAttempts = DEFAULT_REQUEST_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  now = Date.now,
  sleep = (durationMs) =>
    new Promise((resolve) => setTimeout(resolve, durationMs)),
  logger = console,
}) {
  assertRepository(repository);
  assertSha(sha);
  if (!token) {
    throw new Error("GITHUB_TOKEN is required to inspect deployment readiness");
  }
  if (
    pollIntervalMs <= 0 ||
    timeoutMs < 0 ||
    requestTimeoutMs <= 0 ||
    requestAttempts <= 0 ||
    retryDelayMs <= 0
  ) {
    throw new Error("Deployment polling and request limits must be positive");
  }

  const apiBase = `https://api.github.com/repos/${repository}`;
  const deploymentsUrl =
    `${apiBase}/deployments?sha=${encodeURIComponent(sha)}` +
    `&environment=${encodeURIComponent(environment)}&per_page=100`;
  const startedAt = now();
  const deadlineAt = startedAt + timeoutMs;
  const remainingMs = () => deadlineAt - now();
  const requestOptions = {
    requestTimeoutMs,
    requestAttempts,
    retryDelayMs,
    remainingMs,
    now,
    sleep,
    logger,
  };
  let lastObservation = "deployment not created";

  while (now() - startedAt <= timeoutMs) {
    const deployments = await requestJson(
      fetchImpl,
      deploymentsUrl,
      token,
      requestOptions,
    );
    const deployment = selectExactDeployment(deployments, sha, environment);

    if (deployment) {
      const statuses = await requestJson(
        fetchImpl,
        `${apiBase}/deployments/${deployment.id}/statuses?per_page=1`,
        token,
        requestOptions,
      );
      if (!Array.isArray(statuses)) {
        throw new Error(
          "GitHub deployment statuses API returned an invalid response",
        );
      }

      const status = statuses[0];
      const state = status?.state?.toLowerCase();
      lastObservation = state
        ? `deployment ${deployment.id} is ${state}`
        : `deployment ${deployment.id} has no status yet`;

      if (state === "success") {
        const url = validateVercelDeploymentUrl(status.environment_url);
        logger.log(
          `Production deployment ${deployment.id} is ready for commit ${sha.slice(0, 12)}.`,
        );
        return { deployment, status, url };
      }

      if (TERMINAL_FAILURE_STATES.has(state)) {
        throw new Error(
          `Production deployment ${deployment.id} for commit ${sha.slice(0, 12)} ended with ${state}`,
        );
      }
    }

    if (now() - startedAt >= timeoutMs) {
      break;
    }

    logger.log(`Waiting for commit ${sha.slice(0, 12)}: ${lastObservation}.`);
    const availableMs = remainingMs();
    if (availableMs <= 0) break;
    await sleep(Math.min(pollIntervalMs, availableMs));
  }

  throw new Error(
    `Timed out waiting for the exact production deployment for commit ${sha.slice(0, 12)} (${lastObservation})`,
  );
}

export function writeDeploymentOutputs(outputFile, result) {
  if (!outputFile) return;
  appendFileSync(
    outputFile,
    `url=${result.url}\ndeployment_id=${result.deployment.id}\n`,
    "utf8",
  );
}

async function main() {
  const result = await waitForProductionDeployment({
    repository: process.env.GITHUB_REPOSITORY ?? "",
    sha: process.env.GITHUB_SHA ?? "",
    token: process.env.GITHUB_TOKEN ?? "",
  });
  writeDeploymentOutputs(process.env.GITHUB_OUTPUT, result);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
