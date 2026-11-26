import { randomUUID } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { extname, isAbsolute, relative, resolve } from "node:path";
import {
  type AppConfig,
  AREAS,
  type Listing,
  PIN_CATEGORIES,
  type Pin,
  type SavedRentalFields,
} from "../src/types.ts";
import { AuthError, createTokenVerifier, type TokenVerifier } from "./auth.ts";
import {
  createPhotonSearch,
  createRateLimiter,
  type PlaceSearch,
} from "./places.ts";
import { catalogRentalReader, SavedRentalStore } from "./saved-rentals.ts";
import {
  ListingStore,
  MAX_LISTINGS_PER_OWNER,
  MAX_PINS_PER_OWNER,
} from "./store.ts";

const BODY_LIMIT = 32 * 1024;
const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".ttf", "font/ttf"],
  [".geojson", "application/geo+json; charset=utf-8"],
]);
// Situs tidak untuk mesin pencari: noindex di setiap respons (header) dan halaman (meta).
// Perayapan sengaja tidak diblokir agar noindex terbaca dan halaman lama terhapus dari indeks.
const ROBOTS_TAG = "noindex, nofollow, noarchive";
const ROBOTS_TXT = [
  "# Rumah Tinggal tidak untuk mesin pencari.",
  "# Setiap halaman memakai noindex (header X-Robots-Tag dan meta robots).",
  "# Perayapan tidak diblokir agar noindex terbaca dan halaman lama terhapus dari indeks.",
  "User-agent: *",
  "Disallow:",
  "",
].join("\n");

const publicGeoJsonPaths = new Set([
  "/data/regions.geojson",
  "/data/transit.geojson",
  "/data/mobility.geojson",
  "/data/properties.geojson",
]);
// Halaman statis tambahan hasil build Vite multi-page.
const pagePaths = new Map([
  ["/riset", "/riset.html"],
  ["/riset/", "/riset.html"],
]);
const privateSegments = new Set([
  "data",
  "storage",
  "private",
  "local",
  "credentials",
  "secrets",
  "node_modules",
  "server",
  "src",
]);

export interface ServerConfig extends AppConfig {
  port: number;
  appOrigin?: string;
  allowedEmails: string[];
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(env.PORT || "3100");
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    (env.HOST && env.HOST !== "127.0.0.1")
  ) {
    throw new Error("Konfigurasi server tidak valid.");
  }
  let appOrigin: string | undefined;
  if (env.APP_ORIGIN) {
    const origin = new URL(env.APP_ORIGIN);
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.origin !== env.APP_ORIGIN
    ) {
      throw new Error("Origin aplikasi tidak valid.");
    }
    appOrigin = origin.origin;
  }
  const firebase = {
    apiKey: env.FIREBASE_API_KEY || "",
    authDomain: env.FIREBASE_AUTH_DOMAIN || "",
    projectId: env.FIREBASE_PROJECT_ID || "",
    appId: env.FIREBASE_APP_ID || "",
    messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || "",
    storageBucket: env.FIREBASE_STORAGE_BUCKET || "",
  };
  return {
    port,
    appOrigin,
    firebase,
    authConfigured: Boolean(
      firebase.apiKey &&
        firebase.authDomain &&
        firebase.projectId &&
        firebase.appId,
    ),
    allowedEmails: (env.ALLOWED_EMAILS || "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean),
  };
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function checkWriteOrigin(
  request: IncomingMessage,
  config: ServerConfig,
): void {
  let expected = config.appOrigin;
  if (!expected) {
    const host = request.headers.host || "";
    const match = host.match(/^(localhost|127\.0\.0\.1)(?::([0-9]{1,5}))?$/);
    if (
      !match ||
      (match[2] && (Number(match[2]) < 1 || Number(match[2]) > 65535))
    ) {
      throw new HttpError(403, "Origin permintaan tidak diizinkan.");
    }
    expected = `http://${host}`;
  }
  if (request.headers.origin !== expected) {
    throw new HttpError(403, "Origin permintaan tidak diizinkan.");
  }
}

function readJson(request: IncomingMessage): Promise<unknown> {
  if (
    request.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() !==
    "application/json"
  ) {
    request.resume();
    throw new HttpError(415, "Gunakan application/json.");
  }
  if (Number(request.headers["content-length"]) > BODY_LIMIT) {
    request.resume();
    throw new HttpError(413, "Data terlalu besar.");
  }
  return new Promise((accept, reject) => {
    let size = 0;
    let done = false;
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      if (done) return;
      size += chunk.length;
      if (size > BODY_LIMIT) {
        done = true;
        chunks.length = 0;
        reject(new HttpError(413, "Data terlalu besar."));
      } else {
        chunks.push(chunk);
      }
    });
    request.on("end", () => {
      if (done) return;
      done = true;
      try {
        accept(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new HttpError(400, "JSON tidak valid."));
      }
    });
    const interrupted = () => {
      if (!done) {
        done = true;
        reject(new HttpError(400, "Permintaan terputus."));
      }
    };
    request.on("error", interrupted);
    request.on("aborted", interrupted);
  });
}

function authenticate(request: IncomingMessage, verify: TokenVerifier) {
  const bearer =
    request.headers.authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!bearer || bearer.length > 8192) throw new AuthError();
  return verify(bearer);
}

function readShareToken(request: IncomingMessage): string {
  const token = request.headers["x-rental-share"];
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(token))
    throw new HttpError(404, "Tautan hunian tidak tersedia.");
  return token;
}

function inputObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "Isian tidak valid.");
  return value as Record<string, unknown>;
}

function savedRentalFields(value: unknown): Partial<SavedRentalFields> {
  const input = inputObject(value);
  const fields: Partial<SavedRentalFields> = {};
  for (const [key, limit] of [
    ["title", 200],
    ["locationText", 240],
    ["note", 4000],
  ] as const) {
    const field = input[key];
    if (field === undefined) continue;
    if (
      typeof field !== "string" ||
      field.length > limit ||
      (key !== "note" && !field.trim())
    )
      throw new HttpError(400, "Nama, kawasan, atau catatan tidak valid.");
    fields[key] = field.trim();
  }
  if (input.amount !== undefined) {
    if (
      typeof input.amount !== "number" ||
      !Number.isSafeInteger(input.amount) ||
      input.amount < 1
    )
      throw new HttpError(400, "Harga sewa tidak valid.");
    fields.amount = input.amount;
  }
  if (input.period !== undefined) {
    if (input.period !== "monthly" && input.period !== "yearly")
      throw new HttpError(400, "Periode sewa tidak valid.");
    fields.period = input.period;
  }
  const minimum = input.minimumMonths;
  if (minimum !== undefined) {
    if (
      minimum !== null &&
      (typeof minimum !== "number" ||
        !Number.isInteger(minimum) ||
        minimum < 1 ||
        minimum > 120)
    )
      throw new HttpError(400, "Minimum sewa harus 1–120 bulan.");
    fields.minimumMonths = minimum;
  }
  if (!Object.keys(fields).length)
    throw new HttpError(400, "Belum ada isian yang dapat disimpan.");
  return fields;
}

export function validateListing(value: unknown): Listing {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Data hunian tidak valid.");
  }
  const input = value as Record<string, unknown>;
  const text = (
    key: string,
    maximum: number,
    optional = false,
  ): string | undefined => {
    if (optional && (input[key] === undefined || input[key] === ""))
      return undefined;
    if (
      typeof input[key] !== "string" ||
      !input[key].trim() ||
      input[key].length > maximum
    ) {
      throw new HttpError(400, `Isian ${key} tidak valid.`);
    }
    return input[key].trim();
  };
  const number = (
    key: string,
    min: number,
    max: number,
    integer = false,
  ): number => {
    const field = input[key];
    if (
      typeof field !== "number" ||
      !Number.isFinite(field) ||
      field < min ||
      field > max ||
      (integer && !Number.isInteger(field))
    ) {
      throw new HttpError(400, `Isian ${key} tidak valid.`);
    }
    return field;
  };
  if (
    !AREAS.includes(input.area as Listing["area"]) ||
    !["Rumah", "Apartemen", "Kos"].includes(input.type as string)
  ) {
    throw new HttpError(400, "Wilayah atau jenis hunian tidak valid.");
  }
  const sourceUrl = text("sourceUrl", 2048, true);
  if (sourceUrl) {
    let url: URL;
    try {
      url = new URL(sourceUrl);
    } catch {
      throw new HttpError(400, "URL sumber tidak valid.");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new HttpError(400, "URL sumber tidak valid.");
    }
  }
  return {
    id: randomUUID(),
    title: text("title", 160) as string,
    area: input.area as Listing["area"],
    district: text("district", 120) as string,
    price: number("price", 1, 100_000_000_000_000, true),
    type: input.type as Listing["type"],
    bedrooms: number("bedrooms", 0, 50, true),
    landArea: number("landArea", 0, 10_000_000),
    lat: number("lat", -6.85, -5.75),
    lng: number("lng", 106.3, 107.31),
    stationId: text("stationId", 100, true),
    sourceUrl,
    notes: text("notes", 4000, true),
    createdAt: new Date().toISOString(),
  };
}

function safePath(rawUrl: string): string {
  let path: string;
  try {
    path = decodeURIComponent(rawUrl.split("?")[0] || "/");
  } catch {
    throw new HttpError(400, "Path tidak valid.");
  }
  if (
    !path.startsWith("/") ||
    /[\\\0%]/.test(path) ||
    path
      .split("/")
      .some(
        (segment) =>
          segment.startsWith(".") ||
          (privateSegments.has(segment.toLowerCase()) &&
            !publicGeoJsonPaths.has(path)),
      )
  ) {
    throw new HttpError(404, "Tidak ditemukan.");
  }
  return path;
}

async function serveStatic(
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
  distDir: string,
): Promise<void> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    throw new HttpError(405, "Metode tidak diizinkan.");
  }
  const extension = extname(path).toLowerCase();
  if (
    extension &&
    (!contentTypes.has(extension) ||
      (extension === ".geojson" && !publicGeoJsonPaths.has(path)))
  )
    throw new HttpError(404, "Tidak ditemukan.");
  let root: string;
  let file: string;
  try {
    root = await realpath(distDir);
    file = await realpath(
      resolve(root, `.${path === "/" ? "/index.html" : path}`),
    );
  } catch {
    if (extension) throw new HttpError(404, "Tidak ditemukan.");
    try {
      root = await realpath(distDir);
      file = await realpath(resolve(root, "index.html"));
    } catch {
      throw new HttpError(404, "Frontend belum tersedia.");
    }
  }
  const inside = relative(root, file);
  const isPublicGeoJson =
    publicGeoJsonPaths.has(path) &&
    `/${inside.split(/[\\/]/).join("/")}` === path;
  if (
    inside.startsWith("..") ||
    isAbsolute(inside) ||
    (publicGeoJsonPaths.has(path) && !isPublicGeoJson) ||
    (extname(file).toLowerCase() === ".geojson" && !isPublicGeoJson) ||
    inside
      .split(/[\\/]/)
      .some(
        (segment) =>
          segment.startsWith(".") ||
          (privateSegments.has(segment.toLowerCase()) && !isPublicGeoJson),
      ) ||
    !contentTypes.has(extname(file).toLowerCase()) ||
    !(await stat(file)).isFile()
  ) {
    throw new HttpError(404, "Tidak ditemukan.");
  }
  const body = await readFile(file);
  response.writeHead(200, {
    "Content-Type": contentTypes.get(extname(file).toLowerCase()),
    "Content-Length": body.length,
    "Cache-Control":
      extname(file) === ".html" || isPublicGeoJson
        ? "no-cache"
        : "public, max-age=3600",
  });
  response.end(request.method === "HEAD" ? undefined : body);
}

export function validatePin(value: unknown): Pin {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Data pin tidak valid.");
  }
  const input = value as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 160)
    throw new HttpError(400, "Isian name tidak valid.");
  if (!PIN_CATEGORIES.includes(input.category as Pin["category"]))
    throw new HttpError(400, "Kategori pin tidak valid.");
  const coordinate = (key: string, min: number, max: number): number => {
    const field = input[key];
    if (
      typeof field !== "number" ||
      !Number.isFinite(field) ||
      field < min ||
      field > max
    )
      throw new HttpError(400, `Isian ${key} tidak valid.`);
    return field;
  };
  let notes: string | undefined;
  if (input.notes !== undefined && input.notes !== "") {
    if (typeof input.notes !== "string" || input.notes.length > 2000)
      throw new HttpError(400, "Isian notes tidak valid.");
    notes = input.notes.trim() || undefined;
  }
  return {
    id: randomUUID(),
    name,
    category: input.category as Pin["category"],
    lat: coordinate("lat", -6.85, -5.75),
    lng: coordinate("lng", 106.3, 107.31),
    notes,
    createdAt: new Date().toISOString(),
  };
}

export interface AppOptions {
  config?: ServerConfig;
  dataDir?: string;
  savedRentalsDataDir?: string;
  distDir?: string;
  verifyToken?: TokenVerifier;
  searchPlaces?: PlaceSearch;
}

export function createApp(options: AppOptions = {}) {
  const config = options.config ?? readConfig();
  const dataDir = options.dataDir ?? process.env.DATA_DIR ?? "./data";
  const store = new ListingStore(dataDir);
  let savedStore: SavedRentalStore;
  try {
    savedStore = new SavedRentalStore(
      options.savedRentalsDataDir ??
        options.dataDir ??
        (process.env.SAVED_RENTALS_DATA_DIR || dataDir),
    );
  } catch (error) {
    store.close();
    throw error;
  }
  const distDir = resolve(options.distDir ?? "./dist");
  const catalogRental = catalogRentalReader(
    resolve(distDir, "data/properties.geojson"),
  );
  const verify =
    options.verifyToken ??
    createTokenVerifier(config.firebase.projectId, config.allowedEmails);
  const verifyRental =
    options.verifyToken ?? createTokenVerifier(config.firebase.projectId);
  const searchPlaces = options.searchPlaces ?? createPhotonSearch();
  const clientLimit = createRateLimiter(40);
  const globalLimit = createRateLimiter(300);
  const commentLimit = createRateLimiter(30);
  const server = createServer((request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("X-Robots-Tag", ROBOTS_TAG);
    void (async () => {
      const path = safePath(request.url ?? "/");
      if (path === "/robots.txt" && request.method === "GET") {
        response.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        });
        response.end(ROBOTS_TXT);
        return;
      }
      if (path === "/api/health" && request.method === "GET") {
        json(response, 200, { ok: true, port: config.port });
        return;
      }
      if (path === "/api/config" && request.method === "GET") {
        json(response, 200, {
          firebase: config.firebase,
          authConfigured: config.authConfigured,
        });
        return;
      }
      if (path === "/api/places" && request.method === "GET") {
        const query = (
          new URL(request.url ?? "/", "http://local").searchParams.get("q") ??
          ""
        )
          .replace(/\s+/g, " ")
          .trim();
        if (query.length < 3 || query.length > 120)
          throw new HttpError(400, "Kata kunci 3–120 karakter.");
        const realIp = request.headers["x-real-ip"];
        const client =
          (typeof realIp === "string" && realIp) ||
          request.socket.remoteAddress ||
          "";
        if (!clientLimit(client) || !globalLimit("*"))
          throw new HttpError(429, "Terlalu banyak pencarian, coba lagi.");
        let places: Awaited<ReturnType<PlaceSearch>>;
        try {
          places = await searchPlaces(query);
        } catch {
          throw new HttpError(502, "Pencarian tempat belum tersedia.");
        }
        json(response, 200, { places });
        return;
      }
      if (path === "/api/shared-rentals" && request.method === "GET") {
        const shared = savedStore.shared(readShareToken(request));
        if (!shared) throw new HttpError(404, "Tautan hunian tidak tersedia.");
        json(response, 200, shared);
        return;
      }
      if (
        path === "/api/shared-rentals/comments" &&
        request.method === "POST"
      ) {
        const identity = await authenticate(request, verifyRental);
        checkWriteOrigin(request, config);
        const token = readShareToken(request);
        const { text } = inputObject(await readJson(request));
        if (typeof text !== "string" || !text.trim() || text.length > 2000)
          throw new HttpError(400, "Isi komentar 1–2.000 karakter.");
        if (!commentLimit(identity.uid))
          throw new HttpError(429, "Terlalu banyak komentar. Coba lagi nanti.");
        const comment = savedStore.comment(token, identity, text.trim());
        if (!comment) {
          if (!savedStore.shared(token))
            throw new HttpError(404, "Tautan hunian tidak tersedia.");
          throw new HttpError(409, "Belum ada catatan yang dapat dikomentari.");
        }
        json(response, 201, { comment });
        return;
      }
      if (
        path === "/api/saved-rentals" ||
        path.startsWith("/api/saved-rentals/")
      ) {
        const { uid } = await authenticate(request, verifyRental);
        if (path === "/api/saved-rentals" && request.method === "GET") {
          json(response, 200, { rentals: savedStore.list(uid) });
          return;
        }
        const match = path.match(
          /^\/api\/saved-rentals\/([A-Za-z0-9_-]{1,160})(\/share)?$/,
        );
        if (!match) throw new HttpError(404, "Simpanan tidak ditemukan.");
        const [, id, share] = match;
        const method = request.method;
        if (
          !method ||
          !["PUT", "PATCH", "DELETE"].includes(method) ||
          (share && method === "PATCH")
        )
          throw new HttpError(405, "Metode tidak diizinkan.");
        checkWriteOrigin(request, config);
        if (share) {
          const rental = savedStore.setSharing(uid, id, method === "PUT");
          if (!rental) throw new HttpError(404, "Simpanan tidak ditemukan.");
          json(response, 200, { rental });
        } else if (method === "PUT") {
          let rental = savedStore.get(uid, id);
          if (!rental) {
            const original = await catalogRental(id);
            if (!original)
              throw new HttpError(404, "Iklan sewa tidak ditemukan.");
            rental = savedStore.save(uid, original);
          }
          json(response, 200, { rental });
        } else if (method === "PATCH") {
          const rental = savedStore.update(
            uid,
            id,
            savedRentalFields(await readJson(request)),
          );
          if (!rental) throw new HttpError(404, "Simpanan tidak ditemukan.");
          json(response, 200, { rental });
        } else {
          if (!savedStore.remove(uid, id))
            throw new HttpError(404, "Simpanan tidak ditemukan.");
          json(response, 200, { ok: true });
        }
        return;
      }
      if (path === "/api/pins" || path.startsWith("/api/pins/")) {
        const identity = await authenticate(request, verify);
        if (request.method === "GET" && path === "/api/pins") {
          json(response, 200, { pins: store.listPins(identity.uid) });
          return;
        }
        if (request.method === "POST" && path === "/api/pins") {
          checkWriteOrigin(request, config);
          const pin = validatePin(await readJson(request));
          if (!store.addPin(identity.uid, pin)) {
            throw new HttpError(
              409,
              `Maksimal ${MAX_PINS_PER_OWNER} pin per akun. Hapus pin sebelum menambah lagi.`,
            );
          }
          json(response, 201, { pin });
          return;
        }
        const id = path.match(/^\/api\/pins\/([A-Za-z0-9-]+)$/)?.[1];
        if (request.method === "DELETE" && id) {
          checkWriteOrigin(request, config);
          if (!store.removePin(identity.uid, id))
            throw new HttpError(404, "Pin tidak ditemukan.");
          json(response, 200, { ok: true });
          return;
        }
        throw new HttpError(405, "Metode tidak diizinkan.");
      }
      if (path === "/api/listings" || path.startsWith("/api/listings/")) {
        const identity = await authenticate(request, verify);
        if (request.method === "GET" && path === "/api/listings") {
          json(response, 200, { listings: store.list(identity.uid) });
          return;
        }
        if (request.method === "POST" && path === "/api/listings") {
          checkWriteOrigin(request, config);
          const listing = validateListing(await readJson(request));
          if (!store.add(identity.uid, listing)) {
            throw new HttpError(
              409,
              `Maksimal ${MAX_LISTINGS_PER_OWNER} hunian per akun. Hapus hunian sebelum menambah lagi.`,
            );
          }
          json(response, 201, { listing });
          return;
        }
        const id = path.match(/^\/api\/listings\/([A-Za-z0-9-]+)$/)?.[1];
        if (request.method === "DELETE" && id) {
          checkWriteOrigin(request, config);
          if (!store.remove(identity.uid, id))
            throw new HttpError(404, "Hunian tidak ditemukan.");
          json(response, 200, { ok: true });
          return;
        }
        throw new HttpError(405, "Metode tidak diizinkan.");
      }
      if (path === "/api" || path.startsWith("/api/"))
        throw new HttpError(404, "Tidak ditemukan.");
      await serveStatic(
        request,
        response,
        pagePaths.get(path) ?? path,
        distDir,
      );
    })().catch((error: unknown) => {
      if (response.headersSent || response.destroyed) return;
      if (error instanceof HttpError || error instanceof AuthError) {
        json(response, error.status, { error: error.message });
      } else {
        json(response, 500, { error: "Permintaan belum dapat diproses." });
      }
    });
  });
  server.maxHeadersCount = 32;
  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  let closed = false;
  return {
    server,
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      if (server.listening) {
        await new Promise<void>((accept, reject) => {
          server.close((error) => (error ? reject(error) : accept()));
        });
      }
      store.close();
      savedStore.close();
    },
  };
}
