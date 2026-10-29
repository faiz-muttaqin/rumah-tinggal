import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import type { Listing } from "../src/types.ts";
import { createApp, readConfig } from "./app.ts";
import { AuthError } from "./auth.ts";
import { createPhotonSearch, parsePhoton } from "./places.ts";
import { ListingStore, MAX_LISTINGS_PER_OWNER } from "./store.ts";

const APP_ORIGIN = "http://localhost:3100";
const validListing = {
  title: "Hunian uji offline",
  area: "Depok",
  district: "Beji",
  price: 800_000_000,
  type: "Rumah",
  bedrooms: 2,
  landArea: 80,
  lat: -6.37,
  lng: 106.83,
};

const placeQueries: string[] = [];

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "rumah-api-test-"));
  const distDir = join(directory, "dist");
  const dataDir = join(directory, "data");
  await mkdir(join(distDir, "assets"), { recursive: true });
  await writeFile(join(distDir, "index.html"), "<html>offline-test-app</html>");
  await writeFile(join(distDir, "assets", "style.css"), "body{color:blue}");
  const config = readConfig({
    HOST: "127.0.0.1",
    PORT: "3100",
    APP_ORIGIN,
    FIREBASE_API_KEY: "offline-browser-config",
    FIREBASE_AUTH_DOMAIN: "offline.example.invalid",
    FIREBASE_PROJECT_ID: "offline-project",
    FIREBASE_APP_ID: "offline-app",
    ALLOWED_EMAILS: "private-owner@example.invalid",
  });
  const app = createApp({
    config,
    dataDir,
    distDir,
    verifyToken: async (value) => {
      if (!["alice", "bob"].includes(value)) throw new AuthError();
      return { uid: value, email: `${value}@example.invalid` };
    },
    searchPlaces: async (query) => {
      placeQueries.push(query);
      if (query === "upstream gagal") throw new Error("offline");
      return [
        {
          id: "W1",
          name: "Taman Uji",
          detail: "Beji, Depok",
          kind: "park",
          lat: -6.37,
          lng: 106.83,
        },
      ];
    },
  });
  t.after(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
  await new Promise<void>((accept, reject) => {
    app.server.once("error", reject);
    app.server.listen(0, "127.0.0.1", accept);
  });
  const origin = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  const api = (
    path: string,
    method = "GET",
    body?: unknown,
    user: string | null = "alice",
    originHeader: string | null = APP_ORIGIN,
  ) => {
    const headers = new Headers();
    if (user) headers.set("Authorization", `Bearer ${user}`);
    if (originHeader) headers.set("Origin", originHeader);
    if (body !== undefined) headers.set("Content-Type", "application/json");
    return fetch(`${origin}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };
  return { directory, distDir, dataDir, app, origin, api };
}

function rawRequest(
  origin: string,
  path: string,
  body?: string,
): Promise<{ status: number; body: string }> {
  return new Promise((accept, reject) => {
    const client = request(
      origin,
      {
        path,
        method: body === undefined ? "GET" : "POST",
        headers:
          body === undefined
            ? {}
            : {
                Authorization: "Bearer alice",
                Origin: APP_ORIGIN,
                "Content-Type": "application/json",
              },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          accept({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
        response.on("error", reject);
      },
    );
    client.on("error", reject);
    if (body !== undefined) {
      client.write(body.slice(0, 20_000));
      client.end(body.slice(20_000));
    } else client.end();
  });
}

test("health and browser config expose only public settings", async (t) => {
  const { api } = await fixture(t);
  assert.deepEqual(await (await api("/api/health")).json(), {
    ok: true,
    port: 3100,
  });
  const response = await api("/api/config");
  const value = await response.json();
  assert.deepEqual(Object.keys(value).sort(), ["authConfigured", "firebase"]);
  assert.equal(value.authConfigured, true);
  assert.equal(JSON.stringify(value).includes("private-owner"), false);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("private listings reject missing and invalid bearer tokens", async (t) => {
  const { api } = await fixture(t);
  for (const user of [null, "invalid"]) {
    assert.equal(
      (await api("/api/listings", "GET", undefined, user)).status,
      401,
    );
  }
});

test("listing creation and deletion stay isolated by verified owner", async (t) => {
  const { api } = await fixture(t);
  const created = await api("/api/listings", "POST", {
    ...validListing,
    id: "forged-id",
    createdAt: "forged-time",
    owner_uid: "bob",
  });
  assert.equal(created.status, 201);
  const { listing } = (await created.json()) as { listing: Listing };
  assert.notEqual(listing.id, "forged-id");
  assert.notEqual(listing.createdAt, "forged-time");
  assert.equal("owner_uid" in listing, false);
  assert.equal((await (await api("/api/listings")).json()).listings.length, 1);
  assert.equal(
    (await (await api("/api/listings", "GET", undefined, "bob")).json())
      .listings.length,
    0,
  );
  assert.equal(
    (await api(`/api/listings/${listing.id}`, "DELETE", undefined, "bob"))
      .status,
    404,
  );
  assert.equal((await (await api("/api/listings")).json()).listings.length, 1);
  assert.deepEqual(
    await (await api(`/api/listings/${listing.id}`, "DELETE")).json(),
    { ok: true },
  );
  assert.equal((await (await api("/api/listings")).json()).listings.length, 0);
});

test("invalid payloads and foreign or missing write origins never persist", async (t) => {
  const { api } = await fixture(t);
  for (const body of [
    null,
    [],
    {},
    { ...validListing, price: -1 },
    { ...validListing, lat: 100 },
    { ...validListing, lat: -6.851 },
    { ...validListing, lat: -5.749 },
    { ...validListing, lng: 106.299 },
    { ...validListing, lng: 107.311 },
    { ...validListing, lat: null },
    { ...validListing, landArea: null },
    { ...validListing, sourceUrl: "javascript:alert(1)" },
    { ...validListing, sourceUrl: "data:text/html,<script>alert(1)</script>" },
    { ...validListing, sourceUrl: "https://user:password@example.invalid" },
  ]) {
    assert.equal((await api("/api/listings", "POST", body)).status, 400);
  }
  for (const origin of [null, "https://foreign.example.invalid"]) {
    assert.equal(
      (await api("/api/listings", "POST", validListing, "alice", origin))
        .status,
      403,
    );
  }
  assert.equal((await (await api("/api/listings")).json()).listings.length, 0);
});

test("listing coordinates include the Jabodetabek coverage edges", async (t) => {
  const { api } = await fixture(t);
  for (const [lat, lng] of [
    [-6.85, 106.3],
    [-5.75, 107.31],
  ]) {
    assert.equal(
      (await api("/api/listings", "POST", { ...validListing, lat, lng }))
        .status,
      201,
    );
  }
});

test("the atomic 500-listing quota is per owner and deletion restores a slot", async (t) => {
  const { api, dataDir } = await fixture(t);
  const seed = new ListingStore(dataDir);
  try {
    for (let index = 0; index < MAX_LISTINGS_PER_OWNER - 1; index++) {
      assert.equal(
        seed.add("alice", {
          ...validListing,
          id: `quota-${index}`,
          createdAt: new Date().toISOString(),
        } as Listing),
        true,
      );
    }
  } finally {
    seed.close();
  }
  const lastSlot = await api("/api/listings", "POST", validListing);
  assert.equal(lastSlot.status, 201);
  const { listing } = (await lastSlot.json()) as { listing: Listing };
  const rejected = await Promise.all(
    Array.from({ length: 8 }, () => api("/api/listings", "POST", validListing)),
  );
  for (const response of rejected) {
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /Maksimal 500 hunian per akun/);
  }
  assert.equal(
    (await api("/api/listings", "POST", validListing, "bob")).status,
    201,
  );
  assert.equal(
    (await (await api("/api/listings")).json()).listings.length,
    MAX_LISTINGS_PER_OWNER,
  );
  assert.equal(
    (await api(`/api/listings/${listing.id}`, "DELETE")).status,
    200,
  );
  const contestedSlot = await Promise.all([
    api("/api/listings", "POST", validListing),
    api("/api/listings", "POST", validListing),
  ]);
  assert.deepEqual(
    contestedSlot.map((response) => response.status).sort(),
    [201, 409],
  );
  for (const response of contestedSlot) await response.arrayBuffer();
  assert.equal(
    (await (await api("/api/listings")).json()).listings.length,
    MAX_LISTINGS_PER_OWNER,
  );
});

test("JSON syntax, content type, and declared or chunked body limits are enforced", async (t) => {
  const { api, origin } = await fixture(t);
  const headers = { Authorization: "Bearer alice", Origin: APP_ORIGIN };
  assert.equal(
    (
      await fetch(`${origin}/api/listings`, {
        method: "POST",
        headers,
        body: "{}",
      })
    ).status,
    415,
  );
  assert.equal(
    (
      await fetch(`${origin}/api/listings`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: "{",
      })
    ).status,
    400,
  );
  const oversized = { ...validListing, notes: "x".repeat(40_000) };
  assert.equal((await api("/api/listings", "POST", oversized)).status, 413);
  assert.equal(
    (await rawRequest(origin, "/api/listings", JSON.stringify(oversized)))
      .status,
    413,
  );
  assert.equal((await (await api("/api/listings")).json()).listings.length, 0);
});

test("static files stay inside dist and private paths cannot use SPA fallback", async (t) => {
  const { directory, distDir, origin } = await fixture(t);
  await mkdir(join(distDir, ".git"));
  await mkdir(join(distDir, "data"));
  await writeFile(join(distDir, ".env"), "SYNTHETIC_PRIVATE_SETTING=offline\n");
  await writeFile(
    join(distDir, ".git", "config"),
    "offline-private-metadata\n",
  );
  await writeFile(
    join(distDir, "data", "private.sqlite"),
    "offline-private-data\n",
  );
  await writeFile(join(distDir, "data", "other.geojson"), "{}");
  await writeFile(join(distDir, "assets", "other.geojson"), "{}");
  await writeFile(
    join(distDir, "archive.sqlite-wal"),
    "offline-private-data\n",
  );
  await writeFile(join(directory, "outside.css"), "offline-private-data\n");
  await symlink(
    join(directory, "outside.css"),
    join(distDir, "assets", "leak.css"),
  );
  for (const path of [
    "/.env",
    "/%2eenv",
    "/.git/config",
    "/data/private.sqlite",
    "/data/other.geojson",
    "/assets/other.geojson",
    "/data/regions.geojson/more",
    "/archive.sqlite-wal",
    "/package.json",
    "/server/index.ts",
    "/../outside.css",
    "/%2e%2e/outside.css",
    "/%252e%252e/outside.css",
    "/%2f..%2foutside.css",
    "/assets/leak.css",
    "/missing.js",
  ]) {
    assert.equal((await rawRequest(origin, path)).status, 404, path);
  }
  assert.equal((await rawRequest(origin, "/search/homes")).status, 200);
  assert.equal(
    (await rawRequest(origin, "/assets/style.css")).body,
    "body{color:blue}",
  );
});

test("only the three public map files are served as GeoJSON without symlink aliases", async (t) => {
  const { directory, distDir, origin } = await fixture(t);
  const dataDir = join(distDir, "data");
  await mkdir(dataDir);
  const geojson = JSON.stringify({ type: "FeatureCollection", features: [] });
  for (const filename of [
    "regions.geojson",
    "transit.geojson",
    "mobility.geojson",
  ]) {
    await writeFile(join(dataDir, filename), geojson);
    const response = await fetch(`${origin}/data/${filename}`);
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("content-type"),
      "application/geo+json; charset=utf-8",
    );
    assert.equal(await response.text(), geojson);
    const head = await fetch(`${origin}/data/${filename}`, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-length"), String(geojson.length));
    assert.equal(await head.text(), "");
  }
  const transitFile = join(dataDir, "transit.geojson");
  await rm(transitFile);
  await writeFile(join(directory, "outside.geojson"), geojson);
  await symlink(join(directory, "outside.geojson"), transitFile);
  assert.equal((await rawRequest(origin, "/data/transit.geojson")).status, 404);
  await rm(transitFile);
  await writeFile(join(dataDir, "private.geojson"), geojson);
  await symlink(join(dataDir, "private.geojson"), transitFile);
  assert.equal((await rawRequest(origin, "/data/transit.geojson")).status, 404);
  await rm(transitFile);
  await symlink(join(distDir, "assets", "style.css"), transitFile);
  assert.equal((await rawRequest(origin, "/data/transit.geojson")).status, 404);
  await symlink(
    join(dataDir, "regions.geojson"),
    join(distDir, "assets", "alias.js"),
  );
  assert.equal((await rawRequest(origin, "/assets/alias.js")).status, 404);
  await writeFile(join(distDir, "assets", "other.geojson"), geojson);
  await symlink(
    join(distDir, "assets", "other.geojson"),
    join(distDir, "assets", "other-alias.js"),
  );
  assert.equal(
    (await rawRequest(origin, "/assets/other-alias.js")).status,
    404,
  );
});

test("SQLite persists owner-scoped data with restricted filesystem permissions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rumah-store-test-"));
  try {
    const listing = {
      ...validListing,
      id: "offline-id",
      createdAt: new Date().toISOString(),
    } as Listing;
    const first = new ListingStore(directory);
    first.add("alice", listing);
    first.close();
    const second = new ListingStore(directory);
    try {
      assert.deepEqual(second.list("alice"), [listing]);
      assert.deepEqual(second.list("bob"), []);
      assert.equal(second.remove("bob", listing.id), false);
    } finally {
      second.close();
    }
    assert.equal((await stat(directory)).mode & 0o777, 0o700);
    assert.equal(
      (await stat(join(directory, "rumah-tinggal.sqlite"))).mode & 0o777,
      0o600,
    );
    assert.ok(
      (await readFile(join(directory, "rumah-tinggal.sqlite"))).length > 0,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("place search validates queries, hides upstream errors, and rate limits", async (t) => {
  const { api } = await fixture(t);
  const response = await api(
    "/api/places?q=%20taman%20%20uji%20",
    "GET",
    undefined,
    null,
    null,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).places[0].name, "Taman Uji");
  assert.equal(placeQueries.at(-1), "taman uji");
  for (const q of ["", "ab", "x".repeat(121)])
    assert.equal(
      (await api(`/api/places?q=${q}`, "GET", undefined, null)).status,
      400,
    );
  assert.equal(
    (await api("/api/places?q=taman", "POST", undefined, null)).status,
    404,
  );
  const failed = await api(
    "/api/places?q=upstream%20gagal",
    "GET",
    undefined,
    null,
  );
  assert.equal(failed.status, 502);
  assert.equal(JSON.stringify(await failed.json()).includes("offline"), false);
  let status = 200;
  for (let index = 0; index < 40 && status !== 429; index += 1)
    status = (await api("/api/places?q=taman", "GET", undefined, null)).status;
  assert.equal(status, 429);
});

test("Photon results are trimmed to Jabodetabek and cached", async () => {
  const feature = (name: string, lng: number, lat: number) => ({
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
      osm_type: "N",
      osm_id: 7,
      osm_value: "train_station",
      name,
      district: "Menteng",
      city: "Jakarta",
    },
  });
  const body = {
    features: [
      feature("Stasiun Uji", 106.8312345678, -6.1912345678),
      feature("Stasiun Uji", 106.83, -6.19),
      feature("Bandung", 107.6, -6.9),
      { geometry: { coordinates: ["x", 1] }, properties: { name: "Rusak" } },
    ],
  };
  assert.deepEqual(parsePhoton(body), [
    {
      id: "N7",
      name: "Stasiun Uji",
      detail: "Menteng, Jakarta",
      kind: "train station",
      lat: -6.191235,
      lng: 106.831235,
    },
  ]);
  assert.deepEqual(parsePhoton({ features: "x" }), []);
  const urls: string[] = [];
  const search = createPhotonSearch((async (url: URL) => {
    urls.push(String(url));
    return Response.json(body);
  }) as typeof fetch);
  await search("Stasiun Uji");
  await search("stasiun uji");
  assert.equal(urls.length, 1);
  assert.match(urls[0] ?? "", /bbox=106\.3%2C-6\.85%2C107\.31%2C-5\.75/);
});
