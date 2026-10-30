import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const python =
  spawnSync("python3", ["--version"]).status === 0
    ? false
    : "python3 tidak tersedia";
const CONTACT = /(?:\+?62|\b0)8\d{2}[\s.-]?\d{3,4}[\s.-]?\d{3,5}|wa\.me\//;

function build(args: string[]) {
  return spawnSync("python3", ["-I", "scripts/build-properties.py", ...args], {
    encoding: "utf8",
  });
}

test("published research data matches its curated source", {
  skip: python,
}, () => {
  const result = build(["--check"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("published research keeps sourced prices, evidence and computed distances", async () => {
  const data = JSON.parse(
    await readFile("public/data/properties.geojson", "utf8"),
  );
  const { metadata, features } = data;
  assert.match(metadata.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(metadata.currency, "IDR");
  assert.ok(features.length > 0);
  assert.doesNotMatch(JSON.stringify(data), CONTACT);
  const ids = new Set();
  for (const feature of features) {
    const property = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;
    ids.add(property.id);
    assert.ok(lng >= 106.3 && lng <= 107.31 && lat >= -6.85 && lat <= -5.75);
    assert.ok(Number.isInteger(property.price.min), property.id);
    assert.ok(property.price.min >= 50_000_000, property.id);
    assert.equal(property.price.currency, "IDR");
    assert.match(property.price.url, /^https?:\/\//);
    assert.ok(property.price.quote.length <= 150, property.id);
    assert.ok(property.nearest[0].km <= metadata.maxDistanceKm, property.id);
    assert.ok(property.lastChecked <= metadata.checkedAt, property.id);
    assert.ok(
      property.sources.some(
        (source: { fetched: boolean; supports: string[] }) =>
          source.fetched && source.supports.includes("harga"),
      ),
      `${property.id} needs an opened price source`,
    );
    for (const source of property.sources)
      assert.ok(
        !(source.fetched && /instagram\.com|facebook\.com/.test(source.url)),
        `${property.id} must not mark social media as fetched`,
      );
  }
  assert.equal(ids.size, features.length);
});

test("the builder rejects unsafe or unsupported entries", {
  skip: python,
}, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rumah-research-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = {
    url: "https://portal.example.invalid/uji",
    kind: "portal",
    title: "Portal uji",
    fetched: true,
    supports: ["harga", "status"],
  };
  const valid = {
    id: "prj-uji-cisauk",
    name: "Hunian Uji Cisauk",
    developer: "Developer Uji",
    kind: "Rumah",
    locationText: "Cisauk, Kabupaten Tangerang",
    status: "dipasarkan",
    verdict: "confirmed",
    lastChecked: "2026-10-30",
    corridor: "uji",
    price: {
      min: 450_000_000,
      max: null,
      basis: "harga mulai",
      quote: "Mulai Rp 450 Juta",
      url: "https://portal.example.invalid/uji",
    },
    coordinate: {
      lat: -6.33,
      lng: 106.645,
      method: "uji",
      url: "https://osm.example.invalid/uji",
      precision: "titik uji",
    },
    sources: [source],
  };
  const run = async (entry: object) => {
    const input = join(directory, "input.json");
    const output = join(directory, "output.geojson");
    await writeFile(
      input,
      JSON.stringify({ checkedAt: "2026-10-30", properties: [entry] }),
    );
    return { result: build([input, output]), output };
  };

  const ok = await run(valid);
  assert.equal(ok.result.status, 0, ok.result.stderr);
  const built = JSON.parse(await readFile(ok.output, "utf8")).features[0];
  assert.equal(built.properties.nearest[0].name, "Cisauk");
  assert.equal(built.properties.area, "Tangerang");

  const far = await run({
    ...valid,
    coordinate: { ...valid.coordinate, lat: -6.8, lng: 106.35 },
  });
  assert.equal(far.result.status, 0);
  assert.match(far.result.stderr, /Dilewati/);
  assert.equal(
    JSON.parse(await readFile(far.output, "utf8")).features.length,
    0,
  );

  const unmapped = await run({ ...valid, coordinate: null });
  assert.equal(unmapped.result.status, 0);
  assert.match(unmapped.result.stderr, /belum ada koordinat/);
  const excluded = JSON.parse(await readFile(unmapped.output, "utf8")).metadata
    .excluded;
  assert.deepEqual(excluded[0].id, "prj-uji-cisauk");

  const unavailable = await run({
    ...valid,
    excludeReason: "Sumber harga sudah tidak tersedia.",
  });
  assert.equal(unavailable.result.status, 0);
  const omitted = JSON.parse(await readFile(unavailable.output, "utf8"));
  assert.equal(omitted.features.length, 0);
  assert.equal(
    omitted.metadata.excluded[0].reason,
    "Sumber harga sudah tidak tersedia.",
  );

  for (const [entry, message] of [
    [
      { ...valid, price: { ...valid.price, quote: "Hubungi 0812-3456-7890" } },
      /telepon/,
    ],
    [
      {
        ...valid,
        sources: [
          {
            ...source,
            url: "https://www.instagram.com/p/uji/",
            kind: "instagram",
          },
        ],
      },
      /media sosial/,
    ],
    [
      { ...valid, sources: [{ ...source, fetched: false }] },
      /harga harus didukung/,
    ],
    [
      { ...valid, price: { ...valid.price, url: "javascript:alert(1)" } },
      /URL/,
    ],
    [{ ...valid, price: { ...valid.price, min: 450 } }, /rentang wajar/],
    [{ ...valid, coordinate: { lat: "x" } }, /coordinate/],
  ] as const) {
    const { result } = await run(entry);
    assert.notEqual(result.status, 0, String(message));
    assert.match(result.stderr, message);
  }
});

test("population estimates stay tied to the point they were computed for", {
  skip: python,
}, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rumah-population-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const context = JSON.parse(
    await readFile("research/context/population.json", "utf8"),
  );
  assert.equal(context.source.licence, "CC BY 4.0");
  assert.match(context.source.sha256, /^[0-9a-f]{64}$/);
  const published = JSON.parse(
    await readFile("public/data/properties.geojson", "utf8"),
  );
  assert.equal(published.metadata.population.source.id, context.source.id);
  for (const feature of published.features) {
    const estimate = context.properties[feature.properties.id];
    if (!feature.properties.population) continue;
    const [lng, lat] = feature.geometry.coordinates;
    assert.equal(Number(estimate.lng.toFixed(6)), lng, feature.properties.id);
    assert.equal(Number(estimate.lat.toFixed(6)), lat, feature.properties.id);
    assert.ok(
      feature.properties.population.within500m <=
        feature.properties.population.within1km,
      feature.properties.id,
    );
  }

  const research = JSON.parse(
    await readFile("research/properties.json", "utf8"),
  );
  const entry = research.properties.find(
    (item: { id: string }) => context.properties[item.id],
  );
  const run = async (coordinate: object) => {
    const input = join(directory, "input.json");
    const output = join(directory, "output.geojson");
    await writeFile(
      input,
      JSON.stringify({
        checkedAt: research.checkedAt,
        properties: [{ ...entry, coordinate }],
      }),
    );
    assert.equal(build([input, output]).status, 0);
    return JSON.parse(await readFile(output, "utf8")).features[0];
  };
  assert.ok((await run(entry.coordinate)).properties.population);
  const moved = await run({
    ...entry.coordinate,
    lat: entry.coordinate.lat + 0.002,
  });
  assert.equal(moved.properties.population, null);
});
