import assert from "node:assert/strict";
import test from "node:test";
import {
  discover,
  redact,
  toCandidate,
  usagePercent,
} from "./instagram-discovery.ts";

const media = (caption: string) => ({
  caption,
  permalink: "https://www.instagram.com/p/offline-example/",
  timestamp: "2026-10-01T00:00:00+0000",
  media_type: "IMAGE",
});

function graphResponse(body: unknown, usage?: object): Response {
  return new Response(JSON.stringify(body), {
    status: (body as { error?: unknown }).error ? 400 : 200,
    headers: usage ? { "X-App-Usage": JSON.stringify(usage) } : {},
  });
}

test("keeps only captions with a price and a transit keyword, redacting contacts", () => {
  const candidate = toCandidate(
    "developer.contoh",
    media(
      "Rumah 2 lantai mulai Rp 450 juta, 5 menit ke Stasiun Cisauk. WA 0812-3456-7890 atau sales@contoh.invalid",
    ),
  );
  assert.ok(candidate);
  assert.deepEqual(candidate.prices, ["Rp 450 juta"]);
  assert.deepEqual(candidate.stations, ["Stasiun Cisauk"]);
  assert.doesNotMatch(candidate.excerpt, /0812|sales@/);
  assert.equal(
    toCandidate("a", media("Promo akhir tahun Rp 450 juta")),
    undefined,
  );
  assert.equal(
    toCandidate("a", media("Dekat stasiun, hubungi kami")),
    undefined,
  );
  assert.equal(redact("wa.me/62812345678 ok"), "[kontak dihapus] ok");
});

test("reads the highest usage from Graph rate limit headers", () => {
  const headers = new Headers({
    "X-App-Usage": JSON.stringify({ call_count: 12, total_time: 40 }),
    "X-Business-Use-Case-Usage": JSON.stringify({
      "123": [{ type: "instagram", call_count: 81, total_cputime: 3 }],
    }),
  });
  assert.equal(usagePercent(headers), 81);
  assert.equal(usagePercent(new Headers({ "X-App-Usage": "{bad" })), 0);
});

test("stops before the rate limit and on throttling errors without retrying", async () => {
  const requested: string[] = [];
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    const fields = url.searchParams.get("fields") ?? "";
    requested.push(fields.match(/username\(([^)]+)\)/)?.[1] ?? "");
    assert.equal(url.pathname, "/v26.0/17841400000000000");
    return graphResponse(
      {
        business_discovery: {
          media: { data: [media("Apartemen Rp 1,2 M dekat MRT Lebak Bulus")] },
        },
      },
      { call_count: 80 },
    );
  }) as typeof fetch;
  const result = await discover({
    userId: "17841400000000000",
    token: "offline-token",
    usernames: ["satu", "dua"],
    fetcher,
  });
  assert.deepEqual(requested, ["satu"]);
  assert.equal(result.candidates.length, 1);
  assert.match(result.stopped ?? "", /80%/);

  const throttled = await discover({
    userId: "17841400000000000",
    token: "offline-token",
    usernames: ["satu", "dua", "bukan akun!"],
    fetcher: (async () =>
      graphResponse({ error: { code: 4, message: "limit" } })) as typeof fetch,
  });
  assert.equal(throttled.requests, 1);
  assert.match(throttled.stopped ?? "", /kode 4/);
});

test("skips invalid or missing accounts and keeps going", async () => {
  let calls = 0;
  const result = await discover({
    userId: "1",
    token: "offline-token",
    usernames: ["bukan akun!", "hilang", "ada"],
    fetcher: (async () => {
      calls += 1;
      return calls === 1
        ? graphResponse({ error: { code: 110, message: "not found" } })
        : graphResponse({ business_discovery: { media: { data: [] } } });
    }) as typeof fetch,
  });
  assert.equal(result.requests, 2);
  assert.deepEqual(
    result.accounts.map((account) => account.status),
    ["nama akun tidak valid", "dilewati (kode 110)", "0 media, 0 kandidat"],
  );
  assert.equal(result.stopped, undefined);
});
