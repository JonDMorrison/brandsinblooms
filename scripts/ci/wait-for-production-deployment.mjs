import { pathToFileURL } from "node:url";

const DEFAULT_ENVIRONMENT = "Production";
const DEFAULT_POLL_INTERVAL_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 12 * 60_000;
const VERCEL_BOT_LOGIN = "vercel[bot]";
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

async function requestJson(fetchImpl, url, token) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "bloomsuite-production-e2e",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub deployments API returned HTTP ${response.status}`);
  }

  return response.json();
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
  if (pollIntervalMs <= 0 || timeoutMs < 0) {
    throw new Error("Deployment polling intervals must be positive");
  }

  const apiBase = `https://api.github.com/repos/${repository}`;
  const deploymentsUrl =
    `${apiBase}/deployments?sha=${encodeURIComponent(sha)}` +
    `&environment=${encodeURIComponent(environment)}&per_page=100`;
  const startedAt = now();
  let lastObservation = "deployment not created";

  while (now() - startedAt <= timeoutMs) {
    const deployments = await requestJson(fetchImpl, deploymentsUrl, token);
    const deployment = selectExactDeployment(deployments, sha, environment);

    if (deployment) {
      const statuses = await requestJson(
        fetchImpl,
        `${apiBase}/deployments/${deployment.id}/statuses?per_page=1`,
        token,
      );
      if (!Array.isArray(statuses)) {
        throw new Error("GitHub deployment statuses API returned an invalid response");
      }

      const state = statuses[0]?.state?.toLowerCase();
      lastObservation = state
        ? `deployment ${deployment.id} is ${state}`
        : `deployment ${deployment.id} has no status yet`;

      if (state === "success") {
        logger.log(
          `Production deployment ${deployment.id} is ready for commit ${sha.slice(0, 12)}.`,
        );
        return deployment;
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
    await sleep(pollIntervalMs);
  }

  throw new Error(
    `Timed out waiting for the exact production deployment for commit ${sha.slice(0, 12)} (${lastObservation})`,
  );
}

async function main() {
  await waitForProductionDeployment({
    repository: process.env.GITHUB_REPOSITORY ?? "",
    sha: process.env.GITHUB_SHA ?? "",
    token: process.env.GITHUB_TOKEN ?? "",
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
