import assert from "node:assert/strict";
import test from "node:test";
import {
  selectExactDeployment,
  validateVercelDeploymentUrl,
  waitForProductionDeployment,
} from "./wait-for-production-deployment.mjs";

const SHA = "a".repeat(40);
const REPOSITORY = "JonDMorrison/brandsinblooms";
const DEPLOYMENT_URL =
  "https://brandsinblooms-1sx02rtd4-brands-in-blooms.vercel.app";
const silentLogger = { log() {} };

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const successfulStatus = () => ({
  state: "success",
  environment_url: DEPLOYMENT_URL,
});

test("validateVercelDeploymentUrl accepts only the immutable CRM deployment origin", () => {
  assert.equal(validateVercelDeploymentUrl(DEPLOYMENT_URL), DEPLOYMENT_URL);
  assert.throws(
    () => validateVercelDeploymentUrl("https://www.bloomsuite.app"),
    /expected immutable deployment origin/,
  );
  assert.throws(
    () =>
      validateVercelDeploymentUrl(
        "https://brandsinblooms-abc-brands-in-blooms.vercel.app.evil.test",
      ),
    /expected immutable deployment origin/,
  );
});

test("selectExactDeployment ignores another commit and environment", () => {
  const matching = {
    id: 3,
    sha: SHA,
    environment: "Production",
    creator: { login: "vercel[bot]" },
    created_at: "2026-11-06T12:00:00Z",
  };

  assert.equal(
    selectExactDeployment(
      [
        { ...matching, id: 1, sha: "b".repeat(40) },
        { ...matching, id: 2, environment: "Preview" },
        { ...matching, id: 4, creator: { login: "another-deployer[bot]" } },
        matching,
      ],
      SHA,
      "Production",
    ),
    matching,
  );
});

test("waitForProductionDeployment returns only after the exact deployment succeeds", async () => {
  const requestedUrls = [];
  const fetchImpl = async (url) => {
    requestedUrls.push(String(url));
    if (String(url).includes("/statuses")) {
      return jsonResponse([successfulStatus()]);
    }
    return jsonResponse([
      {
        id: 42,
        sha: SHA,
        environment: "Production",
        creator: { login: "vercel[bot]" },
        created_at: "2026-11-06T12:00:00Z",
      },
    ]);
  };

  const result = await waitForProductionDeployment({
    repository: REPOSITORY,
    sha: SHA,
    token: "test-token",
    fetchImpl,
    logger: silentLogger,
  });

  assert.equal(result.deployment.id, 42);
  assert.equal(result.url, DEPLOYMENT_URL);
  assert.match(requestedUrls[0], new RegExp(`deployments\\?sha=${SHA}`));
  assert.match(requestedUrls[1], /deployments\/42\/statuses\?per_page=1$/);
});

test("waitForProductionDeployment keeps polling a pending deployment", async () => {
  let statusRequestCount = 0;
  let nowMs = 0;
  const fetchImpl = async (url) => {
    if (String(url).includes("/statuses")) {
      statusRequestCount += 1;
      return jsonResponse([
        statusRequestCount === 1 ? { state: "pending" } : successfulStatus(),
      ]);
    }
    return jsonResponse([
      {
        id: 84,
        sha: SHA,
        environment: "Production",
        creator: { login: "vercel[bot]" },
        created_at: "2026-11-06T12:00:00Z",
      },
    ]);
  };

  await waitForProductionDeployment({
    repository: REPOSITORY,
    sha: SHA,
    token: "test-token",
    fetchImpl,
    pollIntervalMs: 1_000,
    timeoutMs: 2_000,
    now: () => nowMs,
    sleep: async (durationMs) => {
      nowMs += durationMs;
    },
    logger: silentLogger,
  });

  assert.equal(statusRequestCount, 2);
});

test("waitForProductionDeployment fails on a terminal deployment state", async () => {
  const fetchImpl = async (url) =>
    String(url).includes("/statuses")
      ? jsonResponse([{ state: "failure" }])
      : jsonResponse([
          {
            id: 126,
            sha: SHA,
            environment: "Production",
            creator: { login: "vercel[bot]" },
            created_at: "2026-11-06T12:00:00Z",
          },
        ]);

  await assert.rejects(
    waitForProductionDeployment({
      repository: REPOSITORY,
      sha: SHA,
      token: "test-token",
      fetchImpl,
      logger: silentLogger,
    }),
    /ended with failure/,
  );
});

test("waitForProductionDeployment expires instead of accepting another commit", async () => {
  const fetchImpl = async () =>
    jsonResponse([
      {
        id: 168,
        sha: "b".repeat(40),
        environment: "Production",
        creator: { login: "vercel[bot]" },
        created_at: "2026-11-06T12:00:00Z",
      },
    ]);

  await assert.rejects(
    waitForProductionDeployment({
      repository: REPOSITORY,
      sha: SHA,
      token: "test-token",
      fetchImpl,
      timeoutMs: 0,
      logger: silentLogger,
    }),
    /Timed out waiting for the exact production deployment/,
  );
});

test("waitForProductionDeployment retries a transient GitHub API response", async () => {
  let deploymentRequests = 0;
  let nowMs = 0;
  const delays = [];
  const fetchImpl = async (url) => {
    if (String(url).includes("/statuses")) {
      return jsonResponse([successfulStatus()]);
    }
    deploymentRequests += 1;
    if (deploymentRequests === 1) {
      return jsonResponse({ message: "temporary" }, 503);
    }
    return jsonResponse([
      {
        id: 210,
        sha: SHA,
        environment: "Production",
        creator: { login: "vercel[bot]" },
        created_at: "2026-11-06T12:00:00Z",
      },
    ]);
  };

  const result = await waitForProductionDeployment({
    repository: REPOSITORY,
    sha: SHA,
    token: "test-token",
    fetchImpl,
    retryDelayMs: 25,
    now: () => nowMs,
    sleep: async (durationMs) => {
      delays.push(durationMs);
      nowMs += durationMs;
    },
    logger: silentLogger,
  });

  assert.equal(result.deployment.id, 210);
  assert.equal(deploymentRequests, 2);
  assert.deepEqual(delays, [25]);
});

test("waitForProductionDeployment accepts Retry-After zero as an immediate retry", async () => {
  let deploymentRequests = 0;
  const fetchImpl = async (url) => {
    if (String(url).includes("/statuses")) {
      return jsonResponse([successfulStatus()]);
    }
    deploymentRequests += 1;
    if (deploymentRequests === 1) {
      return jsonResponse({ message: "temporary" }, 429, {
        "retry-after": "0",
      });
    }
    return jsonResponse([
      {
        id: 211,
        sha: SHA,
        environment: "Production",
        creator: { login: "vercel[bot]" },
        created_at: "2026-11-06T12:00:00Z",
      },
    ]);
  };

  const result = await waitForProductionDeployment({
    repository: REPOSITORY,
    sha: SHA,
    token: "test-token",
    fetchImpl,
    sleep: async () => {
      throw new Error("Retry-After zero must not sleep");
    },
    logger: silentLogger,
  });

  assert.equal(result.deployment.id, 211);
  assert.equal(deploymentRequests, 2);
});

test("waitForProductionDeployment bounds each GitHub API request", async () => {
  const fetchImpl = async (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        reject(new DOMException("aborted", "AbortError"));
      });
    });

  await assert.rejects(
    waitForProductionDeployment({
      repository: REPOSITORY,
      sha: SHA,
      token: "test-token",
      fetchImpl,
      requestAttempts: 1,
      requestTimeoutMs: 5,
      timeoutMs: 100,
      logger: silentLogger,
    }),
    /request timed out/,
  );
});

test("waitForProductionDeployment also bounds response body reads", async () => {
  const fetchImpl = async (_url, init) => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      }),
  });

  await assert.rejects(
    waitForProductionDeployment({
      repository: REPOSITORY,
      sha: SHA,
      token: "test-token",
      fetchImpl,
      requestAttempts: 1,
      requestTimeoutMs: 5,
      timeoutMs: 100,
      logger: silentLogger,
    }),
    /invalid JSON: request timed out/,
  );
});
