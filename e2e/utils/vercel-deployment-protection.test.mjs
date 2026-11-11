import assert from "node:assert/strict";
import test from "node:test";
import {
  authenticateProtectedDeployment,
  immutableDeploymentOrigin,
} from "./vercel-deployment-protection.mjs";

const DEPLOYMENT_URL =
  "https://brandsinblooms-1sx02rtd4-brands-in-blooms.vercel.app";

test("immutableDeploymentOrigin rejects aliases and foreign hosts", () => {
  assert.equal(immutableDeploymentOrigin("https://www.bloomsuite.app"), null);
  assert.equal(
    immutableDeploymentOrigin(
      "https://brandsinblooms-abc-brands-in-blooms.vercel.app.evil.test",
    ),
    null,
  );
  assert.equal(immutableDeploymentOrigin(DEPLOYMENT_URL), DEPLOYMENT_URL);
});

test("authenticateProtectedDeployment does nothing for a public custom domain", async () => {
  let requested = false;
  const context = {
    request: {
      get: async () => {
        requested = true;
      },
    },
  };

  assert.equal(
    await authenticateProtectedDeployment(
      context,
      "https://bloomsuite.app",
      undefined,
    ),
    false,
  );
  assert.equal(requested, false);
});

test("authenticateProtectedDeployment requires the bypass only for an immutable deployment", async () => {
  await assert.rejects(
    authenticateProtectedDeployment({}, DEPLOYMENT_URL, ""),
    /VERCEL_AUTOMATION_BYPASS_SECRET/,
  );
});

test("authenticateProtectedDeployment establishes a host-scoped Vercel cookie", async () => {
  let requestOptions;
  const context = {
    request: {
      get: async (_url, options) => {
        requestOptions = options;
        return {
          headers: () => ({}),
          status: () => 200,
        };
      },
    },
    cookies: async () => [
      {
        name: "_vercel_jwt",
        secure: true,
        domain: "brandsinblooms-1sx02rtd4-brands-in-blooms.vercel.app",
      },
    ],
  };

  assert.equal(
    await authenticateProtectedDeployment(context, DEPLOYMENT_URL, "secret"),
    true,
  );
  assert.equal(requestOptions.maxRedirects, 0);
  assert.equal(requestOptions.headers["x-vercel-protection-bypass"], "secret");
});

test("authenticateProtectedDeployment refuses an external redirect", async () => {
  const context = {
    request: {
      get: async () => ({
        headers: () => ({ location: "https://vercel.com/login" }),
        status: () => 302,
      }),
    },
  };

  await assert.rejects(
    authenticateProtectedDeployment(context, DEPLOYMENT_URL, "secret"),
    /redirected outside/,
  );
});
