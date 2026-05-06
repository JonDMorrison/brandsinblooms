import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  calculateJwkThumbprint,
  exportJWK,
  exportPKCS8,
  generateKeyPair,
} from "jose";

const DEFAULT_ISSUER = "https://bloomsuite.app";
const DEFAULT_CMS_REDIRECT_URI = "http://localhost:3000/api/auth/crm/callback";
const DEFAULT_CMS_PRODUCTION_REDIRECT_URI =
  "https://cms.invalid/api/auth/crm/callback";
const DEFAULT_ACCESS_TOKEN_TTL = "900";
const DEFAULT_REFRESH_TOKEN_TTL = "2592000";
const DEFAULT_AUTHORIZATION_CODE_TTL = "600";

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = nextValue;
    index += 1;
  }

  return args;
}

function base64UrlRandom(lengthInBytes) {
  return randomBytes(lengthInBytes).toString("base64url");
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlTextArray(values) {
  if (!values.length) {
    return "ARRAY[]::text[]";
  }

  return `ARRAY[${values.map((value) => sqlLiteral(value)).join(", ")}]::text[]`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const issuer = args.issuer || DEFAULT_ISSUER;
  const cmsRedirectUri = args["cms-redirect-uri"] || DEFAULT_CMS_REDIRECT_URI;
  const cmsProductionRedirectUri =
    args["cms-production-redirect-uri"] ||
    DEFAULT_CMS_PRODUCTION_REDIRECT_URI;
  const accessTokenTtl =
    args["access-token-ttl"] || DEFAULT_ACCESS_TOKEN_TTL;
  const refreshTokenTtl =
    args["refresh-token-ttl"] || DEFAULT_REFRESH_TOKEN_TTL;
  const authorizationCodeTtl =
    args["authorization-code-ttl"] || DEFAULT_AUTHORIZATION_CODE_TTL;

  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    modulusLength: 2048,
    extractable: true,
  });

  const privateKeyPem = await exportPKCS8(privateKey);
  const encodedPrivateKeyPem = Buffer.from(privateKeyPem, "utf8").toString(
    "base64",
  );
  const publicJwk = await exportJWK(publicKey);
  const signingKey = {
    ...publicJwk,
    use: "sig",
    alg: "RS256",
  };
  const kid = await calculateJwkThumbprint(signingKey, "sha256");

  const cmsClientSecret = base64UrlRandom(48);
  const m2mClientSecret = base64UrlRandom(48);

  const workspaceRoot = process.cwd();
  const envFilePath = path.join(workspaceRoot, ".env.oauth.local");
  const tempDirectory = path.join(workspaceRoot, "supabase", ".temp");
  const publicArtifactPath = path.join(
    tempDirectory,
    "oauth-bootstrap.public.json",
  );
  const sqlArtifactPath = path.join(tempDirectory, "oauth-bootstrap.sql");

  ensureDirectory(tempDirectory);

  const envFileContents = [
    "# OAuth bootstrap secrets generated locally.",
    "# This file is gitignored by .env.* rules.",
    `OAUTH_JWT_PRIVATE_KEY=${encodedPrivateKeyPem}`,
    `OAUTH_JWT_KEY_ID=${kid}`,
    `OAUTH_ISSUER=${issuer}`,
    `OAUTH_ACCESS_TOKEN_TTL=${accessTokenTtl}`,
    `OAUTH_REFRESH_TOKEN_TTL=${refreshTokenTtl}`,
    `OAUTH_AUTHORIZATION_CODE_TTL=${authorizationCodeTtl}`,
    `OAUTH_CMS_CLIENT_ID=bloomsuite-cms`,
    `OAUTH_CMS_CLIENT_SECRET=${cmsClientSecret}`,
    `OAUTH_CMS_M2M_CLIENT_ID=bloomsuite-cms-m2m`,
    `OAUTH_CMS_M2M_CLIENT_SECRET=${m2mClientSecret}`,
  ].join("\n");

  const publicArtifact = {
    issuer,
    kid,
    alg: "RS256",
    kty: signingKey.kty,
    publicKeyJwk: {
      ...signingKey,
      kid,
    },
    cmsClient: {
      clientId: "bloomsuite-cms",
      redirectUris: [cmsRedirectUri, cmsProductionRedirectUri],
      allowedScopes: ["openid", "profile", "email", "subscription"],
      grantTypes: [
        "authorization_code",
        "refresh_token",
        "client_credentials",
      ],
    },
    cmsM2MClient: {
      clientId: "bloomsuite-cms-m2m",
      redirectUris: [],
      allowedScopes: ["user:provision", "subscription:read"],
      grantTypes: ["client_credentials"],
    },
    envDefaults: {
      OAUTH_ACCESS_TOKEN_TTL: accessTokenTtl,
      OAUTH_REFRESH_TOKEN_TTL: refreshTokenTtl,
      OAUTH_AUTHORIZATION_CODE_TTL: authorizationCodeTtl,
    },
  };

  const signingKeyJson = JSON.stringify(publicArtifact.publicKeyJwk);
  const sqlArtifact = `-- OAuth bootstrap SQL generated locally.
-- Contains sensitive client secrets. Keep this file local.

UPDATE public.oauth_clients
SET
  client_secret_hash = crypt(${sqlLiteral(cmsClientSecret)}, gen_salt('bf', 12)),
  redirect_uris = ${sqlTextArray([cmsRedirectUri, cmsProductionRedirectUri])},
  allowed_scopes = ${sqlTextArray(["openid", "profile", "email", "subscription"])},
  grant_types = ${sqlTextArray(["authorization_code", "refresh_token", "client_credentials"])},
  is_first_party = true,
  is_active = true,
  updated_at = now()
WHERE client_id = 'bloomsuite-cms';

UPDATE public.oauth_clients
SET
  client_secret_hash = crypt(${sqlLiteral(m2mClientSecret)}, gen_salt('bf', 12)),
  redirect_uris = ARRAY[]::text[],
  allowed_scopes = ${sqlTextArray(["user:provision", "subscription:read"])},
  grant_types = ${sqlTextArray(["client_credentials"])},
  is_first_party = true,
  is_active = true,
  updated_at = now()
WHERE client_id = 'bloomsuite-cms-m2m';

INSERT INTO public.oauth_signing_keys (
  kid,
  kty,
  alg,
  public_key_jwk,
  is_active
)
VALUES (
  ${sqlLiteral(kid)},
  'RSA',
  'RS256',
  ${sqlLiteral(signingKeyJson)}::jsonb,
  true
)
ON CONFLICT (kid) DO UPDATE
SET
  kty = EXCLUDED.kty,
  alg = EXCLUDED.alg,
  public_key_jwk = EXCLUDED.public_key_jwk,
  is_active = EXCLUDED.is_active;
`;

  fs.writeFileSync(envFilePath, `${envFileContents}\n`, "utf8");
  fs.writeFileSync(
    publicArtifactPath,
    `${JSON.stringify(publicArtifact, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(sqlArtifactPath, sqlArtifact, "utf8");

  console.log(
    `OAuth bootstrap secrets written to ${path.relative(workspaceRoot, envFilePath)}`,
  );
  console.log(
    `OAuth public artifact written to ${path.relative(workspaceRoot, publicArtifactPath)}`,
  );
  console.log(
    `OAuth SQL bootstrap written to ${path.relative(workspaceRoot, sqlArtifactPath)}`,
  );
  console.log(`Generated signing key kid: ${kid}`);
}

main().catch((error) => {
  console.error("Failed to generate OAuth bootstrap artifacts:", error);
  process.exitCode = 1;
});