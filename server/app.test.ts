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
import {
  type ResearchProperty,
  researchToListing,
  researchToPin,
} from "../src/research-data.ts";
import type {
  BookmarkChange,
  BookmarkLibrary,
  Listing,
  OwnedBookmark,
  SharedBookmark,
} from "../src/types.ts";
import { researchFixture } from "../tests/research-fixture.ts";
import { createApp, readConfig } from "./app.ts";
import { AuthError } from "./auth.ts";
import { createPhotonSearch, parsePhoton } from "./places.ts";
import { SavedRentalStore } from "./saved-rentals.ts";
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
    extraHeaders?: HeadersInit,
  ) => {
    const headers = new Headers(extraHeaders);
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

test("every response asks search engines not to index the site", async (t) => {
  const { api } = await fixture(t);
  for (const path of ["/api/health", "/api/listings", "/missing.txt"]) {
    assert.equal(
      (await api(path)).headers.get("x-robots-tag"),
      "noindex, nofollow, noarchive",
      path,
    );
  }
  const robots = await api("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(robots.headers.get("content-type") ?? "", /^text\/plain/);
  const body = await robots.text();
  assert.match(body, /^User-agent: \*$/m);
  // Perayapan tidak diblokir, agar noindex dapat dibaca.
  assert.doesNotMatch(body, /^Disallow: \/$/m);
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

test("saved rentals isolate accounts and share notes with revocable links", async (t) => {
  const { api, app, dataDir, distDir } = await fixture(t);
  await mkdir(join(distDir, "data"));
  await writeFile(
    join(distDir, "data", "properties.geojson"),
    JSON.stringify(researchFixture),
  );
  const original = researchFixture.metadata.rentals.rentals[0];
  const savedPath = "/api/saved-rentals";
  const rentalPath = `${savedPath}/${original.id}`;
  const sharedPath = "/api/shared-rentals";
  assert.equal((await api(savedPath, "GET", undefined, null)).status, 401);
  assert.equal((await api(rentalPath, "PUT", undefined, null)).status, 401);
  assert.equal((await api(`${savedPath}/missing`, "PUT")).status, 404);
  const saved = await Promise.all([
    api(rentalPath, "PUT"),
    api(rentalPath, "PUT"),
  ]);
  for (const response of saved) {
    assert.equal(response.status, 200);
    const { rental } = await response.json();
    assert.equal(rental.rentalId, original.id);
    assert.equal(rental.amount, original.rent.amount);
    assert.equal(rental.shareToken, null);
  }
  assert.equal((await (await api(savedPath)).json()).rentals.length, 1);
  assert.deepEqual(
    await (await api(savedPath, "GET", undefined, "bob")).json(),
    { rentals: [] },
  );
  assert.equal(
    (await api(rentalPath, "PATCH", { note: "Catatan lain" }, "bob")).status,
    404,
  );
  assert.equal(
    (await api(`${rentalPath}/share`, "PUT", undefined, "bob")).status,
    404,
  );
  assert.equal((await api(rentalPath, "DELETE", undefined, "bob")).status, 404);
  assert.equal(
    (await api(rentalPath, "PATCH", { minimumMonths: 0 })).status,
    400,
  );
  assert.equal(
    (
      await api(
        rentalPath,
        "PATCH",
        { note: "Asing" },
        "alice",
        "http://other.invalid",
      )
    ).status,
    403,
  );
  const note = "Periksa dapur.\nBawa meteran.";
  const edited = await api(rentalPath, "PATCH", {
    title: "Simpanan uji",
    amount: 2_150_000,
    note,
  });
  assert.equal(edited.status, 200);
  assert.equal((await edited.json()).rental.note, note);
  assert.equal((await api(sharedPath, "GET", undefined, null)).status, 404);

  const {
    rental: { shareToken },
  } = await (await api(`${rentalPath}/share`, "PUT")).json();
  assert.match(shareToken, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(
    (await (await api(`${rentalPath}/share`, "PUT")).json()).rental.shareToken,
    shareToken,
  );
  const shareHeader = { "X-Rental-Share": shareToken };
  const shareRead = () =>
    api(sharedPath, "GET", undefined, null, null, shareHeader);
  const guest = await shareRead();
  assert.equal(guest.status, 200);
  assert.equal(guest.headers.get("cache-control"), "no-store");
  const content = await guest.json();
  assert.equal(content.rental.note, note);
  assert.equal(content.rental.title, "Simpanan uji");
  assert.equal(content.rental.amount, 2_150_000);
  assert.equal("shareToken" in content.rental, false);
  assert.equal("owner_uid" in content.rental, false);
  const commentPath = `${sharedPath}/comments`;
  assert.equal(
    (
      await api(
        commentPath,
        "POST",
        { text: "Tanya" },
        null,
        APP_ORIGIN,
        shareHeader,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await api(
        commentPath,
        "POST",
        { text: "   " },
        "bob",
        APP_ORIGIN,
        shareHeader,
      )
    ).status,
    400,
  );
  const comment = await api(
    commentPath,
    "POST",
    { text: "Tanya dapur" },
    "bob",
    APP_ORIGIN,
    shareHeader,
  );
  assert.equal(comment.status, 201);
  assert.deepEqual(Object.keys((await comment.json()).comment).sort(), [
    "author",
    "createdAt",
    "id",
    "text",
  ]);
  assert.equal(
    (await (await shareRead()).json()).comments[0].text,
    "Tanya dapur",
  );

  assert.equal((await api(`${rentalPath}/share`, "DELETE")).status, 200);
  assert.equal((await shareRead()).status, 404);
  assert.equal(
    (
      await api(
        commentPath,
        "POST",
        { text: "Terlambat" },
        "bob",
        APP_ORIGIN,
        shareHeader,
      )
    ).status,
    404,
  );
  const replacement = (await (await api(`${rentalPath}/share`, "PUT")).json())
    .rental.shareToken;
  assert.notEqual(replacement, shareToken);
  const fresh = await api(sharedPath, "GET", undefined, null, null, {
    "X-Rental-Share": replacement,
  });
  assert.deepEqual((await fresh.json()).comments, []);
  assert.equal((await api(rentalPath, "PUT")).status, 200);
  await app.close();
  const reopened = new SavedRentalStore(dataDir);
  try {
    assert.equal(reopened.get("alice", original.id)?.note, note);
    assert.equal(reopened.shared(shareToken), undefined);
    assert.equal(reopened.shared(replacement)?.rental.amount, 2_150_000);
  } finally {
    reopened.close();
  }
  assert.equal(
    (await stat(join(dataDir, "saved-rentals.sqlite"))).mode & 0o777,
    0o600,
  );
});

test("named collections scope collaboration and record atomic edits", async (t) => {
  const { api, distDir, app, dataDir } = await fixture(t);
  await mkdir(join(distDir, "data"));
  await writeFile(
    join(distDir, "data", "properties.geojson"),
    JSON.stringify(researchFixture),
  );
  const [first, second] = researchFixture.metadata.rentals.rentals;
  const library = "/api/bookmark-collections";
  const shared = "/api/shared-bookmark-collection";
  const collectionFrom = async (response: Response) =>
    (await response.json()).collection as OwnedBookmark;
  assert.equal((await api(library, "GET", undefined, null)).status, 401);
  assert.equal((await api(library, "POST", { name: "  " })).status, 400);
  assert.equal(
    (await api(library, "POST", { name: "Gagal", rentalId: "missing" })).status,
    404,
  );
  assert.deepEqual(
    ((await (await api(library)).json()) as BookmarkLibrary).collections,
    [],
  );

  let owned = await collectionFrom(
    await api(library, "POST", { name: "Pilihan survei", rentalId: first.id }),
  );
  const privateCopy = await collectionFrom(
    await api(library, "POST", { name: "Catatan pribadi", rentalId: first.id }),
  );
  const path = `${library}/${owned.id}`;
  const item = `/items/${first.id}`;
  assert.equal(owned.items[0].rental.rentalId, first.id);
  assert.equal((await api(path, "GET", undefined, "bob")).status, 404);
  assert.equal(
    (await api(`${path}/history`, "GET", undefined, "bob")).status,
    404,
  );
  owned = await collectionFrom(
    await api(`${path}${item}`, "PATCH", {
      revision: owned.revision,
      note: "Catatan sebelum",
    }),
  );
  const duplicate = await collectionFrom(
    await api(`${path}${item}`, "PUT", { revision: owned.revision - 1 }),
  );
  assert.equal(duplicate.revision, owned.revision);
  owned = await collectionFrom(
    await api(`${path}/share`, "PUT", {
      revision: owned.revision,
      permission: "view",
    }),
  );
  assert.ok(owned.share);
  const token = owned.share.token;
  const guest = (
    suffix = "",
    method = "GET",
    body?: unknown,
    user: string | null = null,
  ) =>
    api(`${shared}${suffix}`, method, body, user, APP_ORIGIN, {
      "X-Rental-Share": token,
    });
  const publicView = await guest();
  assert.equal(publicView.headers.get("cache-control"), "no-store");
  const { collection: visible } = (await publicView.json()) as {
    collection: SharedBookmark;
  };
  assert.deepEqual(Object.keys(visible).sort(), [
    "items",
    "name",
    "permission",
    "revision",
  ]);
  assert.equal(visible.items[0].rental.note, "Catatan sebelum");
  assert.equal((await guest("/pin", "PUT")).status, 401);
  assert.equal((await guest("/pin", "PUT", undefined, "alice")).status, 409);
  const pinResponse = await guest("/pin", "PUT", undefined, "bob");
  assert.equal(pinResponse.status, 200);
  const { pinned } = (await pinResponse.json()) as BookmarkLibrary;
  assert.deepEqual(
    pinned.map(({ name, permission, rentalIds }) => ({
      name,
      permission,
      rentalIds,
    })),
    [{ name: "Pilihan survei", permission: "view", rentalIds: [first.id] }],
  );
  assert.deepEqual(
    (
      (await (
        await guest("/pin", "PUT", undefined, "bob")
      ).json()) as BookmarkLibrary
    ).pinned,
    pinned,
  );
  assert.deepEqual(
    ((await (await api(library)).json()) as BookmarkLibrary).pinned,
    [],
  );
  const reopenedPin = new SavedRentalStore(dataDir);
  try {
    assert.deepEqual(
      reopenedPin.bookmarks.list({ uid: "bob", email: "bob@example.invalid" })
        .pinned,
      pinned,
    );
  } finally {
    reopenedPin.close();
  }
  assert.equal(
    (await guest(`${item}/comments`, "POST", { text: "Tamu" })).status,
    401,
  );
  assert.equal(
    (await guest(`${item}/comments`, "POST", { text: "Tamu" }, "bob")).status,
    403,
  );
  assert.equal(
    (
      await guest(
        item,
        "PATCH",
        { revision: owned.revision, note: "Gagal" },
        "bob",
      )
    ).status,
    403,
  );

  owned = await collectionFrom(
    await api(`${path}/share`, "PUT", {
      revision: owned.revision,
      permission: "comment",
    }),
  );
  assert.equal(owned.share?.token, token);
  assert.equal(
    (await guest(`${item}/comments`, "POST", { text: "Boleh survei?" }, "bob"))
      .status,
    201,
  );
  assert.equal(
    (
      await guest(
        item,
        "PATCH",
        { revision: owned.revision, note: "Gagal" },
        "bob",
      )
    ).status,
    403,
  );
  owned = await collectionFrom(
    await api(`${path}/share`, "PUT", {
      revision: owned.revision,
      permission: "edit",
    }),
  );
  assert.equal((await guest("/history")).status, 404);
  assert.equal(
    (
      await guest(
        "/share",
        "PUT",
        { revision: owned.revision, permission: "view" },
        "bob",
      )
    ).status,
    403,
  );
  const simultaneous = await Promise.all([
    guest(
      item,
      "PATCH",
      { revision: owned.revision, note: "Catatan editor" },
      "bob",
    ),
    api(`${path}${item}`, "PATCH", {
      revision: owned.revision,
      note: "Catatan pemilik",
    }),
  ]);
  assert.deepEqual(
    simultaneous.map((response) => response.status).sort(),
    [200, 409],
  );
  let current = await collectionFrom(await api(path));
  const earlierNote = current.items[0].rental.note;
  const updated = await guest(
    item,
    "PATCH",
    { revision: current.revision, note: "Catatan sesudah", amount: 2_100_000 },
    "bob",
  );
  assert.equal(updated.status, 200);
  current = await collectionFrom(await api(path));
  assert.equal(current.items[0].comments[0].text, "Boleh survei?");
  assert.equal(
    (await collectionFrom(await api(`${library}/${privateCopy.id}`))).items[0]
      .rental.note,
    "",
  );
  assert.equal(
    (
      await guest(
        "",
        "PATCH",
        { revision: current.revision, name: "Siap survei" },
        "bob",
      )
    ).status,
    200,
  );
  current = await collectionFrom(await api(path));
  assert.equal(current.name, "Siap survei");
  assert.equal(
    (
      await guest(
        `/items/${second.id}`,
        "PUT",
        { revision: current.revision },
        "bob",
      )
    ).status,
    200,
  );
  current = await collectionFrom(await api(path));
  assert.equal(current.items.length, 2);
  assert.equal(
    (await guest(item, "DELETE", { revision: current.revision }, "bob")).status,
    200,
  );
  current = await collectionFrom(await api(path));
  assert.deepEqual(
    current.items.map(({ rental }) => rental.rentalId),
    [second.id],
  );
  const { changes } = (await (await api(`${path}/history`)).json()) as {
    changes: BookmarkChange[];
  };
  assert.equal(changes[0].action, "remove");
  assert.ok(
    changes[0].fields.some((field) => field.before === "Catatan sesudah"),
  );
  assert.deepEqual(
    changes.find(
      (change) =>
        change.action === "edit" &&
        change.fields.some((field) => field.key === "amount"),
    )?.fields,
    [
      { key: "note", before: earlierNote, after: "Catatan sesudah" },
      { key: "amount", before: first.rent.amount, after: 2_100_000 },
    ],
  );
  assert.equal(changes[0].author, "Kolaborator");
  assert.deepEqual(
    changes.map((change) => change.revision),
    Array.from({ length: current.revision }, (_, i) => current.revision - i),
  );
  const livePin = (
    (await (
      await api(library, "GET", undefined, "bob")
    ).json()) as BookmarkLibrary
  ).pinned[0];
  assert.equal(livePin.id, pinned[0].id);
  assert.equal(livePin.permission, "edit");
  assert.equal(livePin.name, "Siap survei");
  assert.deepEqual(livePin.rentalIds, [second.id]);
  assert.equal((await guest("/pin", "DELETE", undefined, "bob")).status, 200);
  assert.deepEqual(
    (
      (await (
        await api(library, "GET", undefined, "bob")
      ).json()) as BookmarkLibrary
    ).pinned,
    [],
  );
  assert.equal((await guest("/pin", "PUT", undefined, "bob")).status, 200);

  const revoked = await collectionFrom(
    await api(`${path}/share`, "DELETE", { revision: current.revision }),
  );
  assert.equal(revoked.share, null);
  assert.equal((await guest()).status, 404);
  assert.equal((await guest("/pin", "PUT", undefined, "bob")).status, 404);
  assert.deepEqual(
    (
      (await (
        await api(library, "GET", undefined, "bob")
      ).json()) as BookmarkLibrary
    ).pinned,
    [],
  );
  assert.equal(
    (
      await guest(
        `/items/${second.id}`,
        "PATCH",
        { revision: revoked.revision, note: "Terlambat" },
        "bob",
      )
    ).status,
    404,
  );
  await app.close();
  const reopened = new SavedRentalStore(dataDir);
  try {
    const retained = reopened.bookmarks.history(
      { id: current.id, ownerUid: "alice" },
      Number.MAX_SAFE_INTEGER,
    );
    assert.equal(retained.changes[0].action, "share");
    assert.ok(
      retained.changes.some(
        (change) => change.author === "Kolaborator" && change.action === "edit",
      ),
    );
  } finally {
    reopened.close();
  }
});

test("earlier saved rentals enter a private collection once and keep legacy links", async (t) => {
  const { api, distDir, dataDir, app } = await fixture(t);
  await mkdir(join(distDir, "data"));
  await writeFile(
    join(distDir, "data", "properties.geojson"),
    JSON.stringify(researchFixture),
  );
  const [first, second] = researchFixture.metadata.rentals.rentals;
  const old = `/api/saved-rentals/${first.id}`;
  assert.equal((await api(old, "PUT")).status, 200);
  await api(old, "PATCH", { note: "Catatan lama" });
  const legacy = (await (await api(`${old}/share`, "PUT")).json()).rental;
  const path = "/api/bookmark-collections";
  const browse = (await (await api(path)).json()) as BookmarkLibrary;
  assert.equal(browse.hasLegacyRentals, true);
  const [summary] = browse.collections;
  assert.equal(summary.name, "Simpanan lama");
  assert.deepEqual(summary.rentalIds, [first.id]);
  const collection = (await (await api(`${path}/${summary.id}`)).json())
    .collection as OwnedBookmark;
  assert.equal(collection.share, null);
  assert.equal(collection.items[0].rental.note, "Catatan lama");
  assert.equal(
    (
      await api("/api/shared-rentals", "GET", undefined, null, null, {
        "X-Rental-Share": legacy.shareToken,
      })
    ).status,
    200,
  );

  assert.equal(
    (await api(`/api/saved-rentals/${second.id}`, "PUT")).status,
    200,
  );
  assert.deepEqual(
    ((await (await api(path)).json()) as BookmarkLibrary).collections,
    browse.collections,
  );
  assert.equal(
    (
      await api(`${path}/${summary.id}/items/${first.id}`, "DELETE", {
        revision: summary.revision,
      })
    ).status,
    200,
  );
  await app.close();
  const reopened = new SavedRentalStore(dataDir);
  try {
    const owners = reopened.bookmarks.list({
      uid: "alice",
      email: "alice@example.invalid",
    });
    assert.deepEqual(owners.collections[0].rentalIds, []);
    assert.equal(
      reopened.shared(legacy.shareToken)?.rental.note,
      "Catatan lama",
    );
  } finally {
    reopened.close();
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

test("only the four public map files are served as GeoJSON without symlink aliases", async (t) => {
  const { directory, distDir, origin } = await fixture(t);
  const dataDir = join(distDir, "data");
  await mkdir(dataDir);
  const geojson = JSON.stringify({ type: "FeatureCollection", features: [] });
  for (const filename of [
    "regions.geojson",
    "transit.geojson",
    "mobility.geojson",
    "properties.geojson",
  ]) {
    await writeFile(join(dataDir, filename), geojson);
    const response = await fetch(`${origin}/data/${filename}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-cache");
    assert.equal(
      response.headers.get("content-type"),
      "application/geo+json; charset=utf-8",
    );
    assert.equal(await response.text(), geojson);
    const head = await fetch(`${origin}/data/${filename}`, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("cache-control"), "no-cache");
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

test("serves the research page at /riset without widening static access", async (t) => {
  const { distDir, origin } = await fixture(t);
  await writeFile(join(distDir, "riset.html"), "<html>offline-research</html>");
  for (const path of ["/riset", "/riset/", "/riset.html"]) {
    const response = await rawRequest(origin, path);
    assert.equal(response.status, 200, path);
    assert.equal(response.body, "<html>offline-research</html>", path);
  }
  assert.equal(
    (await rawRequest(origin, "/riset/lainnya")).body,
    "<html>offline-test-app</html>",
  );
  for (const path of ["/riset.geojson", "/riset/.env", "/data/riset.html"])
    assert.equal((await rawRequest(origin, path)).status, 404, path);
});

test("research saves to private listings and pins with provenance and account isolation", async (t) => {
  const { api } = await fixture(t);
  const feature = researchFixture.features[0];
  const property = {
    ...feature.properties,
    lng: (feature.geometry?.coordinates ?? [])[0],
    lat: (feature.geometry?.coordinates ?? [])[1],
  } as unknown as ResearchProperty;
  for (const [path, entry, key] of [
    ["/api/listings", researchToListing(property), "listing"],
    ["/api/pins", researchToPin(property), "pin"],
  ] as const) {
    assert.ok(entry);
    assert.equal((await api(path, "POST", entry, null)).status, 401);
    const response = await api(path, "POST", entry);
    assert.equal(response.status, 201);
    const saved = (await response.json())[key];
    assert.equal(saved.lat, property.lat);
    assert.equal(saved.lng, property.lng);
    assert.ok(saved.notes.includes(property.price.url));
    assert.ok(saved.notes.includes("30 Okt 2026"));
    const collectionKey = key === "pin" ? "pins" : "listings";
    assert.deepEqual((await (await api(path)).json())[collectionKey], [saved]);
    assert.deepEqual(
      (await (await api(path, "GET", undefined, "bob")).json())[collectionKey],
      [],
    );
    assert.equal(
      (await api(`${path}/${saved.id}`, "DELETE", undefined, "bob")).status,
      404,
    );
    assert.equal((await api(`${path}/${saved.id}`, "DELETE")).status, 200);
  }
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

test("pins are validated, owner-scoped, and require authentication", async (t) => {
  const { api } = await fixture(t);
  const validPin = {
    name: " Masjid Uji ",
    category: "masjid",
    lat: -6.37,
    lng: 106.83,
    notes: "Dekat gang",
  };
  assert.equal((await api("/api/pins", "GET", undefined, null)).status, 401);
  assert.equal(
    (await api("/api/pins", "POST", validPin, "alice", null)).status,
    403,
  );
  for (const invalid of [
    { ...validPin, name: "" },
    { ...validPin, category: "kasino" },
    { ...validPin, lat: -7.5 },
    { ...validPin, lng: "106.8" },
    { ...validPin, notes: "x".repeat(2001) },
    [validPin],
  ])
    assert.equal((await api("/api/pins", "POST", invalid)).status, 400);
  const created = await api("/api/pins", "POST", {
    ...validPin,
    id: "forged-id",
    owner_uid: "bob",
  });
  assert.equal(created.status, 201);
  const { pin } = await created.json();
  assert.notEqual(pin.id, "forged-id");
  assert.equal(pin.name, "Masjid Uji");
  assert.equal("owner_uid" in pin, false);
  assert.equal((await (await api("/api/pins")).json()).pins.length, 1);
  assert.equal(
    (await (await api("/api/pins", "GET", undefined, "bob")).json()).pins
      .length,
    0,
  );
  assert.equal(
    (await api(`/api/pins/${pin.id}`, "DELETE", undefined, "bob")).status,
    404,
  );
  assert.equal((await api(`/api/pins/${pin.id}`, "DELETE")).status, 200);
  assert.equal((await (await api("/api/pins")).json()).pins.length, 0);
  assert.equal((await api("/api/pins", "PUT", validPin)).status, 405);
});
