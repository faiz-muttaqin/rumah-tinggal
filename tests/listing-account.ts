import type { Page } from "@playwright/test";
import type { Listing } from "../src/types.ts";

// Entirely fictional Firebase persistence/API replies. No Google login or live
// account is used, and the token is only accepted by the intercepted QA API.
export async function mockListingAccount(
  page: Page,
  listings: Listing[],
): Promise<void> {
  const apiKey = "excel-offline-key";
  const uid = "excel-offline-owner";
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "none" })}.${encode({
    sub: uid,
    user_id: uid,
    aud: "excel-offline-project",
    iss: "https://securetoken.google.com/excel-offline-project",
    exp: 4_102_444_800,
    iat: 1_700_000_000,
    auth_time: 1_700_000_000,
    email: "excel@example.invalid",
    email_verified: true,
    firebase: { sign_in_provider: "google.com", identities: {} },
  })}.offline`;
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: {
        authConfigured: true,
        firebase: {
          apiKey,
          authDomain: "excel.example.invalid",
          projectId: "excel-offline-project",
          appId: "excel-offline-app",
        },
      },
    }),
  );
  await page.route("https://identitytoolkit.googleapis.com/**", (route) =>
    route.fulfill({
      json: {
        users: [
          {
            localId: uid,
            displayName: "Akun Uji",
            email: "excel@example.invalid",
            emailVerified: true,
            providerUserInfo: [{ providerId: "google.com", rawId: uid }],
            lastLoginAt: "1700000000000",
            createdAt: "1700000000000",
          },
        ],
      },
    }),
  );
  await page.route("**/api/listings", (route) =>
    route.fulfill({ json: { listings } }),
  );
  await page.route("**/api/pins", (route) =>
    route.fulfill({ json: { pins: [] } }),
  );
  await page.addInitScript(
    ({ key, user }) => {
      sessionStorage.setItem(key, JSON.stringify(user));
    },
    {
      key: `firebase:authUser:${apiKey}:[DEFAULT]`,
      user: {
        uid,
        displayName: "Akun Uji",
        email: "excel@example.invalid",
        emailVerified: true,
        isAnonymous: false,
        providerData: [
          {
            providerId: "google.com",
            uid,
            displayName: "Akun Uji",
            email: "excel@example.invalid",
            photoURL: null,
            phoneNumber: null,
          },
        ],
        stsTokenManager: {
          refreshToken: "offline-refresh",
          accessToken: token,
          expirationTime: 4_102_444_800_000,
        },
        createdAt: "1700000000000",
        lastLoginAt: "1700000000000",
        apiKey,
        appName: "[DEFAULT]",
      },
    },
  );
}
