import type { User } from "firebase/auth";
import type { AppConfig } from "./types.ts";

let currentUser: User | null = null;
let authPromise: Promise<import("firebase/auth").Auth> | undefined;

export async function initializeAuth(
  config: AppConfig,
  onChange: (user: User | null) => void,
): Promise<void> {
  if (!config.authConfigured) return;
  authPromise = (async () => {
    const [
      { initializeApp },
      {
        getAuth,
        onAuthStateChanged,
        browserSessionPersistence,
        setPersistence,
      },
    ] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
    const auth = getAuth(initializeApp(config.firebase));
    await setPersistence(auth, browserSessionPersistence);
    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      onChange(user);
    });
    return auth;
  })();
  await authPromise;
}

export async function login(): Promise<void> {
  if (!authPromise)
    throw new Error("Konfigurasi login Google belum tersedia di server.");
  const auth = await authPromise;
  const { signInWithPopup, GoogleAuthProvider } = await import("firebase/auth");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider);
}

export function loginErrorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  return code === "auth/popup-closed-by-user"
    ? "Jendela login ditutup. Kamu bisa mencoba lagi."
    : code === "auth/unauthorized-domain"
      ? "Domain ini perlu ditambahkan ke Authorized domains Firebase."
      : code === "auth/popup-blocked"
        ? "Izinkan popup untuk masuk dengan Google."
        : error instanceof Error && !code
          ? error.message
          : "Login belum berhasil. Periksa koneksi dan pengaturan Google/Firebase.";
}

export async function logout(): Promise<void> {
  if (authPromise)
    await (await import("firebase/auth")).signOut(await authPromise);
}

export function getUser(): User | null {
  return currentUser;
}

export class AccountRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function privateAPI<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const user = currentUser;
  if (!user)
    throw new Error("Masuk dengan Google untuk membuka listing pribadi.");
  const token = await user.getIdToken();
  if (currentUser !== user) throw new Error("Akun berubah. Coba lagi.");
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(path, {
    ...options,
    headers,
  });
  const result = await response.json();
  if (!response.ok)
    throw new AccountRequestError(
      response.status,
      result.error || "Permintaan belum berhasil. Coba kembali.",
    );
  return result as T;
}
