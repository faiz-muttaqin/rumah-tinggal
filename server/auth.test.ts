import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTPayload,
  SignJWT,
} from "jose";
import { AuthError, createTokenVerifier } from "./auth.ts";

// Ephemeral offline keys: no Firebase requests or real credentials.
const { privateKey, publicKey } = await generateKeyPair("RS256");
const keys = createLocalJWKSet({
  keys: [
    { ...(await exportJWK(publicKey)), kid: "offline-test", alg: "RS256" },
  ],
});

function token(overrides: JWTPayload = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: "https://securetoken.google.com/offline-test-project",
    aud: "offline-test-project",
    sub: "offline-user",
    iat: now - 5,
    exp: now + 300,
    auth_time: now - 10,
    email: "owner@example.invalid",
    email_verified: true,
    firebase: { sign_in_provider: "google.com" },
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "offline-test" })
    .sign(privateKey);
}

test("a signed Firebase Google identity is verified with pinned issuer and audience", async () => {
  const verify = createTokenVerifier("offline-test-project", [], keys);
  assert.deepEqual(await verify(await token()), {
    uid: "offline-user",
    email: "owner@example.invalid",
  });
});

test("invalid Firebase claims, non-Google providers, and invalid tokens are rejected", async () => {
  const verify = createTokenVerifier("offline-test-project", [], keys);
  const now = Math.floor(Date.now() / 1000);
  for (const claims of [
    { iss: "https://example.invalid" },
    { aud: "another-project" },
    { exp: now - 1 },
    { iat: now + 100 },
    { auth_time: now + 100 },
    { auth_time: undefined },
    { sub: "" },
    { sub: "x".repeat(129) },
    { email_verified: false },
    { email: "invalid" },
    { firebase: { sign_in_provider: "password" } },
    { firebase: null },
  ]) {
    await assert.rejects(verify(await token(claims)), AuthError);
  }
  await assert.rejects(verify("invalid-offline-token"), AuthError);
  await assert.rejects(
    createTokenVerifier("", [], keys)(await token()),
    AuthError,
  );
});

test("the optional email allowlist denies other valid Google identities", async () => {
  const verify = createTokenVerifier(
    "offline-test-project",
    ["OWNER@example.invalid"],
    keys,
  );
  assert.equal((await verify(await token())).uid, "offline-user");
  await assert.rejects(
    verify(await token({ email: "other@example.invalid" })),
    (error: unknown) => error instanceof AuthError && error.status === 403,
  );
});
