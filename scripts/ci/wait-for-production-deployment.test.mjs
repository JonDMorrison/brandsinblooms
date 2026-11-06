import assert from "node:assert/strict";
import test from "node:test";
import {
  selectExactDeployment,
  waitForProductionDeployment,
} from "./wait-for-production-deployment.mjs";

const SHA = "a".repeat(40);
const REPOSITORY = "JonDMorrison/brandsinblooms";
const silentLogger = { log() {} };

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

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
      return jsonResponse([{ state: "success" }]);
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

  const deployment = await waitForProductionDeployment({
    repository: REPOSITORY,
    sha: SHA,
    token: "test-token",
    fetchImpl,
    logger: silentLogger,
  });

  assert.equal(deployment.id, 42);
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
        { state: statusRequestCount === 1 ? "pending" : "success" },
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

test("waitForProductionDeployment times out instead of accepting another commit", async () => {
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
    /deployment not created/,
  );
});
