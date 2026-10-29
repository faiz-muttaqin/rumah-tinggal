import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";

export interface Identity {
  uid: string;
  email: string;
}

export type TokenVerifier = (token: string) => Promise<Identity>;

export class AuthError extends Error {
  status: number;

  constructor(status = 401) {
    super(
      status === 403
        ? "Akses akun belum diizinkan."
        : "Login Google diperlukan.",
    );
    this.status = status;
  }
}

const firebaseKeys = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

export function createTokenVerifier(
  projectId: string,
  allowedEmails: readonly string[] = [],
  keys: JWTVerifyGetKey = firebaseKeys,
): TokenVerifier {
  const allowlist = new Set(
    allowedEmails.map((email) => email.trim().toLowerCase()),
  );
  return async (token) => {
    if (!projectId) throw new AuthError();
    let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
    try {
      ({ payload } = await jwtVerify(token, keys, {
        algorithms: ["RS256"],
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
        requiredClaims: ["sub", "exp", "iat", "auth_time"],
      }));
    } catch {
      throw new AuthError();
    }
    const now = Math.floor(Date.now() / 1000);
    const firebase = payload.firebase;
    if (
      typeof payload.sub !== "string" ||
      payload.sub.length < 1 ||
      payload.sub.length > 128 ||
      typeof payload.iat !== "number" ||
      !Number.isInteger(payload.iat) ||
      payload.iat < 0 ||
      payload.iat > now ||
      typeof payload.exp !== "number" ||
      !Number.isInteger(payload.exp) ||
      payload.exp <= now ||
      typeof payload.auth_time !== "number" ||
      !Number.isInteger(payload.auth_time) ||
      payload.auth_time < 0 ||
      payload.auth_time > now ||
      payload.auth_time > payload.iat ||
      typeof payload.email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) ||
      payload.email_verified !== true ||
      typeof firebase !== "object" ||
      firebase === null ||
      Array.isArray(firebase) ||
      (firebase as Record<string, unknown>).sign_in_provider !== "google.com"
    ) {
      throw new AuthError();
    }
    if (allowlist.size && !allowlist.has(payload.email.toLowerCase())) {
      throw new AuthError(403);
    }
    return { uid: payload.sub, email: payload.email };
  };
}
