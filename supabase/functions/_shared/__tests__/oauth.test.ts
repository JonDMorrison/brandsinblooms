import { assert, assertEquals, assertMatch, assertRejects } from "@std/assert";
import {
  calculateJwkThumbprint,
  exportPKCS8,
  generateKeyPair,
  jwtVerify,
} from "npm:jose@6.2.2";

import {
  generateAuthorizationCode,
  generateRefreshToken,
  hashToken,
  parsePrivateKey,
  signJWT,
  validateRedirectUri,
  validateScopes,
  verifyPKCE,
} from "../oauth.ts";

Deno.test("generateAuthorizationCode returns a URL-safe random string", () => {
  const code = generateAuthorizationCode();
  assert(code.length >= 64);
  assertMatch(code, /^[A-Za-z0-9_-]+$/);
});

Deno.test("generateRefreshToken returns a URL-safe random string", () => {
  const refreshToken = generateRefreshToken();
  assert(refreshToken.length >= 86);
  assertMatch(refreshToken, /^[A-Za-z0-9_-]+$/);
});

Deno.test("hashToken returns a deterministic SHA-256 hex digest", async () => {
  const firstHash = await hashToken("oauth-refresh-token");
  const secondHash = await hashToken("oauth-refresh-token");

  assertEquals(firstHash, secondHash);
  assertEquals(firstHash.length, 64);
  assertMatch(firstHash, /^[a-f0-9]{64}$/);
});

Deno.test("hashToken rejects empty input", async () => {
  await assertRejects(() => hashToken(""), Error, "Token cannot be empty.");
});

Deno.test("verifyPKCE validates RFC 7636 S256 examples", async () => {
  const isValid = await verifyPKCE(
    "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    "S256",
  );

  assertEquals(isValid, true);
});

Deno.test("verifyPKCE rejects mismatched verifier values", async () => {
  const isValid = await verifyPKCE(
    "wrong-verifier",
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    "S256",
  );

  assertEquals(isValid, false);
});

Deno.test("validateRedirectUri requires an exact registered URI match", () => {
  const registeredUris = [
    "http://localhost:3000/api/auth/crm/callback",
    "https://cms.example.com/api/auth/crm/callback",
  ];

  assertEquals(
    validateRedirectUri(
      "http://localhost:3000/api/auth/crm/callback",
      registeredUris,
    ),
    true,
  );
  assertEquals(
    validateRedirectUri(
      "http://localhost:3000/api/auth/crm/callback/extra",
      registeredUris,
    ),
    false,
  );
  assertEquals(
    validateRedirectUri(
      "http://localhost:3000/api/auth/crm/callback?foo=bar",
      registeredUris,
    ),
    false,
  );
});

Deno.test("validateScopes enforces requested scopes as a strict subset", () => {
  assertEquals(
    validateScopes(
      ["openid", "profile", "subscription"],
      ["openid", "profile", "email", "subscription"],
    ),
    true,
  );
  assertEquals(
    validateScopes(
      ["openid", "admin"],
      ["openid", "profile", "email", "subscription"],
    ),
    false,
  );
});

Deno.test(
  "parsePrivateKey accepts both raw PEM and base64-encoded PEM",
  async () => {
    const { privateKey } = await generateKeyPair("RS256", {
      modulusLength: 2048,
      extractable: true,
    });
    const privatePem = await exportPKCS8(privateKey);
    const base64Pem = btoa(privatePem);

    const importedFromPem = await parsePrivateKey(privatePem);
    const importedFromBase64 = await parsePrivateKey(base64Pem);

    const pemSignature = await signJWT(
      { sub: "user-1" },
      importedFromPem,
      "kid-1",
    );
    const base64Signature = await signJWT(
      { sub: "user-1" },
      importedFromBase64,
      "kid-1",
    );

    assert(pemSignature.length > 0);
    assert(base64Signature.length > 0);
  },
);

Deno.test("signJWT signs a JWT with the provided key ID", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    modulusLength: 2048,
    extractable: true,
  });
  const kid = await calculateJwkThumbprint(
    await crypto.subtle.exportKey("jwk", publicKey),
  );

  const signedToken = await signJWT(
    {
      sub: "crm-user-id",
      aud: "bloomsuite-cms",
      iss: "https://bloomsuite.app",
      exp: Math.floor(Date.now() / 1000) + 900,
    },
    privateKey,
    kid,
  );

  const { payload, protectedHeader } = await jwtVerify(signedToken, publicKey, {
    audience: "bloomsuite-cms",
    issuer: "https://bloomsuite.app",
  });

  assertEquals(payload.sub, "crm-user-id");
  assertEquals(protectedHeader.alg, "RS256");
  assertEquals(protectedHeader.kid, kid);
});
