import assert from "node:assert/strict";
import test from "node:test";
import { importPosts, parseExport } from "./instagram-import.ts";

const watchlist = {
  accounts: [{ username: "proyek.contoh", owner: "project", area: "Bekasi" }],
};
const row = {
  user_posted: "proyek.contoh",
  url: "https://www.instagram.com/p/contoh_1/?igsh=tracking",
  description:
    "Rumah Bekasi Rp 450 juta dekat masjid dan TPQ. WA 0812-3456-7890 atau sales@contoh.invalid. Referensi Rp 081234567890",
  date_posted: "2026-10-31T01:00:00Z",
  content_type: "Posts",
  latest_comments: [
    { comment_user: "orang.pribadi", comment: "data yang tidak dibutuhkan" },
  ],
  phone: "081234567890",
  profile_name: "Nama pribadi tidak diperlukan",
};

test("imports relevant organization posts and drops contacts, comments, and profile data", () => {
  const result = importPosts([row], "brightdata", watchlist);
  assert.equal(result.networkRequests, 0);
  assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.candidates[0].prices, ["Rp 450 juta"]);
  assert.deepEqual(result.candidates[0].areas, ["Bekasi"]);
  assert.equal(
    result.candidates[0].permalink,
    "https://www.instagram.com/p/contoh_1/",
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /0812|sales@|orang\.pribadi|latest_comments|profile_name|Nama pribadi/,
  );
});

test("excludes private accounts and outsiders, rejects unsafe links, and deduplicates aliases", () => {
  const result = importPosts(
    [
      row,
      { ...row, url: "https://instagram.com/reel/contoh_1/" },
      { ...row, user_posted: "orang.pribadi" },
      { ...row, is_private: true },
      { ...row, url: "https://example.invalid/p/contoh_2/" },
      { ...row, error: "private response that must not be copied" },
    ],
    "brightdata",
    watchlist,
  );
  assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.skipped, {
    unavailable: 2,
    outsideWatchlist: 1,
    irrelevant: 1,
    duplicate: 1,
  });
  assert.doesNotMatch(
    JSON.stringify(result),
    /private response|orang\.pribadi/,
  );
});

test("imports Apify captions about education without needing a house price", () => {
  const result = importPosts(
    [
      {
        ownerUsername: "Proyek.Contoh",
        caption: "Kajian rutin dan tahfidz anak di Bekasi",
        url: "https://www.instagram.com/reel/sekolah_1/",
        timestamp: "invalid timestamp 081234567890",
        type: "Video",
      },
    ],
    "apify",
    watchlist,
  );
  assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.candidates[0].prices, []);
  assert.equal(result.candidates[0].mediaType, "VIDEO");
  assert.equal(result.candidates[0].timestamp, "");
});

test("reads JSON and NDJSON exports and rejects unsupported watchlists or oversized batches", () => {
  assert.deepEqual(parseExport(JSON.stringify([row])), [row]);
  assert.deepEqual(
    parseExport(`${JSON.stringify(row)}\n${JSON.stringify(row)}\n`),
    [row, row],
  );
  assert.deepEqual(parseExport(""), []);
  assert.throws(() => parseExport("not json"));
  assert.throws(() =>
    importPosts([row], "brightdata", {
      accounts: [
        { username: "orang.pribadi", owner: "individual", area: "Bekasi" },
      ],
    }),
  );
  assert.throws(
    () => importPosts(Array(1001).fill(row), "brightdata", watchlist),
    /1.000/,
  );
});
