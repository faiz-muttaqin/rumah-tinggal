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
    ids.add(property.id);
    if (feature.geometry) {
      const [lng, lat] = feature.geometry.coordinates;
      assert.ok(lng >= 106.3 && lng <= 107.31 && lat >= -6.85 && lat <= -5.75);
    } else assert.equal(property.listingBasis, "islamic", property.id);
    assert.ok(Number.isInteger(property.price.min), property.id);
    assert.ok(property.price.min >= 50_000_000, property.id);
    assert.equal(property.price.currency, "IDR");
    assert.match(property.price.url, /^https?:\/\//);
    assert.ok(property.price.quote.length <= 150, property.id);
    const closest = property.nearest[0] ?? property.nearestPlanned[0];
    if (property.listingBasis === "islamic")
      assert.ok(property.islamic?.claims.length, `${property.id} needs claims`);
    else
      assert.ok(closest && closest.km <= metadata.maxDistanceKm, property.id);
    for (const station of property.nearestPlanned)
      assert.ok(
        metadata.planned.qualifyingStatuses.includes(station.status),
        `${property.id} planned station status`,
      );
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
    [
      {
        ...valid,
        social: [
          {
            platform: "instagram",
            url: "https://www.facebook.com/uji",
            owner: "project",
            via: "search-result",
          },
        ],
      },
      /bukan instagram/,
    ],
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

test("planned stations qualify a project only when formally planned or being built", {
  skip: python,
}, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rumah-planned-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const entry = {
    id: "prj-uji-rencana",
    name: "Hunian Uji Rencana",
    kind: "Rumah",
    locationText: "Wilayah uji",
    status: "dipasarkan",
    verdict: "partial",
    lastChecked: "2026-10-30",
    corridor: "uji",
    price: {
      min: 900_000_000,
      basis: "harga mulai",
      quote: "Mulai Rp 900 Juta",
      url: "https://portal.example.invalid/rencana",
    },
    // Lebih dari 3 km dari stasiun aplikasi mana pun.
    coordinate: {
      lat: -6.62,
      lng: 106.86,
      method: "uji",
      url: "https://osm.example.invalid/rencana",
      precision: "titik uji",
    },
    sources: [
      {
        url: "https://portal.example.invalid/rencana",
        kind: "portal",
        title: "Portal uji",
        fetched: true,
        supports: ["harga"],
      },
    ],
  };
  const plan = (status: string) => ({
    checkedAt: "2026-10-30",
    lines: [
      {
        id: "lrt-uji",
        name: "LRT Uji",
        mode: "LRT",
        segment: "A sampai B",
        status,
        statusAsOf: "2026-10-01",
        sources: [
          {
            url: "https://operator.example.invalid/rencana",
            title: "Rencana uji",
            publisher: "Operator Uji",
            kind: "operator",
          },
        ],
      },
    ],
    stations: [
      {
        name: "Stasiun Uji",
        line: "lrt-uji",
        status,
        lat: -6.61,
        lng: 106.86,
        precision: "osm-station-node",
        coordinateUrl: "https://www.openstreetmap.org/node/1",
      },
    ],
    appStatus: [{ mode: "KRL", name: "Bogor", status: "under-construction" }],
  });
  const run = async (status: string, entries: object[] = [entry]) => {
    const input = join(directory, "input.json");
    const planned = join(directory, "planned.json");
    const output = join(directory, "output.geojson");
    await writeFile(
      input,
      JSON.stringify({ checkedAt: "2026-10-30", properties: entries }),
    );
    await writeFile(planned, JSON.stringify(plan(status)));
    const result = build([input, output, "--planned", planned]);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(await readFile(output, "utf8"));
  };
  const built = await run("under-construction");
  assert.equal(built.features.length, 1);
  const property = built.features[0].properties;
  assert.deepEqual(property.nearest, []);
  assert.equal(property.nearestPlanned[0].name, "Stasiun Uji");
  assert.equal(property.nearestPlanned[0].status, "under-construction");
  assert.ok(property.nearestPlanned[0].km < 1.2);
  assert.equal(built.metadata.planned.lines[0].id, "lrt-uji");

  const study = await run("proposed-study");
  assert.equal(study.features.length, 0, "a proposal alone must not publish");
  assert.match(study.metadata.excluded[0].reason, /di luar radius/);

  // Stasiun aplikasi yang ditandai belum beroperasi membawa statusnya.
  const nearBogor = await run("under-construction", [
    {
      ...entry,
      id: "prj-uji-bogor",
      coordinate: { ...entry.coordinate, lat: -6.6, lng: 106.795 },
    },
  ]);
  const bogor = nearBogor.features[0].properties.nearest.find(
    (s: { name: string }) => s.name === "Bogor",
  );
  assert.equal(bogor.status, "under-construction");
});

test("rentals and unverified leads keep privacy and labels", {
  skip: python,
}, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rumah-rental-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const rental = {
    id: "sewa-uji",
    title: "Kontrakan Uji",
    rentalType: "kontrakan",
    kind: "Rumah",
    area: "Bekasi",
    locationText: "Bekasi Timur, Kota Bekasi",
    rent: {
      amount: 2_500_000,
      period: "monthly",
      quote: "Rp 2,5 Juta/bulan",
      url: "https://portal.example.invalid/sewa",
      pageDate: "2026-10-20",
    },
    evidence: [
      {
        quote: "Dekat masjid, lingkungan keluarga muslim",
        url: "https://portal.example.invalid/sewa",
      },
    ],
    listingUrl: "https://portal.example.invalid/sewa",
    sourcePortal: "Portal uji",
    ownerType: "individual",
    social: [],
    verdict: "partial",
    lastChecked: "2026-10-30",
  };
  const lead = {
    id: "lead-uji",
    name: "Akun Uji",
    type: "rental",
    status: "unreached",
    area: "Depok",
    claim: "Disebut kontrakan keluarga muslim.",
    links: [
      {
        label: "Instagram @akun.uji",
        url: "https://www.instagram.com/akun.uji/",
      },
    ],
  };
  const run = async (rentals: object[], leads: object[] = [lead]) => {
    const files = {
      input: join(directory, "input.json"),
      leads: join(directory, "leads.json"),
      rentals: join(directory, "rentals.json"),
      output: join(directory, "output.geojson"),
    };
    await writeFile(
      files.input,
      JSON.stringify({ checkedAt: "2026-10-30", properties: [] }),
    );
    await writeFile(
      files.leads,
      JSON.stringify({
        checkedAt: "2026-10-30",
        source: "Uji",
        note: "Belum diverifikasi.",
        leads,
      }),
    );
    await writeFile(
      files.rentals,
      JSON.stringify({ checkedAt: "2026-10-30", note: "Uji.", rentals }),
    );
    const result = build([
      files.input,
      files.output,
      "--leads",
      files.leads,
      "--rentals",
      files.rentals,
    ]);
    return {
      result,
      data:
        result.status === 0
          ? JSON.parse(await readFile(files.output, "utf8"))
          : null,
    };
  };
  const ok = await run([rental]);
  assert.equal(ok.result.status, 0, ok.result.stderr);
  assert.equal(ok.data.metadata.rentals.rentals[0].rent.amount, 2_500_000);
  assert.equal(ok.data.metadata.rentals.rentals[0].coordinates, undefined);
  assert.equal(ok.data.metadata.leads.leads[0].status, "unreached");

  const pinned = await run([
    {
      ...rental,
      coordinates: {
        lat: -6.2,
        lng: 107,
        url: "https://x.invalid",
        method: "uji",
      },
    },
  ]);
  assert.notEqual(pinned.result.status, 0);
  assert.match(pinned.result.stderr, /perorangan tidak boleh berkoordinat/);

  const noEvidence = await run([{ ...rental, evidence: [] }]);
  assert.match(noEvidence.result.stderr, /evidence wajib/);

  const unsafeHighlight = await run([
    {
      ...rental,
      areaHighlights: [
        {
          kind: "Kajian",
          name: "Masjid Uji",
          description: "Jadwal belum dikonfirmasi.",
          url: "https://masjid.example.invalid/",
          relation: "Jarak belum diketahui.",
          relationUrl: "javascript:alert(1)",
        },
      ],
    },
  ]);
  assert.notEqual(unsafeHighlight.result.status, 0);
  assert.match(unsafeHighlight.result.stderr, /URL/);

  const odd = await run([{ ...rental, rent: { ...rental.rent, amount: 50 } }]);
  assert.match(odd.result.stderr, /rentang wajar/);

  const withContact = await run(
    [rental],
    [{ ...lead, contactUrl: "https://ini.bio/akun-uji" }],
  );
  assert.equal(
    withContact.data.metadata.leads.leads[0].contactUrl,
    "https://ini.bio/akun-uji",
  );
  for (const contactUrl of [
    "https://wa.me/6281200000000",
    "https://api.whatsapp.com/send?phone=6281200000000",
    "https://bio.example.invalid/kontak?no=081200000000",
  ]) {
    const phone = await run([rental], [{ ...lead, contactUrl }]);
    assert.match(phone.result.stderr, /bukan nomor atau WhatsApp/);
  }

  const verified = await run([rental], [{ ...lead, status: "confirmed" }]);
  assert.match(verified.result.stderr, /type atau status/);

  const bare = await run([rental], [{ ...lead, links: [] }]);
  assert.match(bare.result.stderr, /links wajib/);
});

test("sale ads need Islamic evidence and never carry a coordinate", {
  skip: python,
}, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rumah-sale-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const ad = {
    id: "jual-uji",
    title: "Rumah uji",
    category: "rumah",
    kind: "Rumah",
    area: "Bogor",
    locationText: "Kampung Uji",
    price: {
      amount: 650_000_000,
      quote: "Rp 650 JT",
      url: "https://portal.example.invalid/jual",
    },
    nearMosque: {
      name: "Masjid Uji",
      quote: "dekat Masjid Uji",
      url: "https://portal.example.invalid/jual",
    },
    listingUrl: "https://portal.example.invalid/jual",
    sourcePortal: "Portal uji",
    verdict: "partial",
    lastChecked: "2026-10-30",
  };
  const run = async (ads: object[]) => {
    const input = join(directory, "input.json");
    const sale = join(directory, "sale.json");
    const output = join(directory, "output.geojson");
    await writeFile(
      input,
      JSON.stringify({ checkedAt: "2026-10-30", properties: [] }),
    );
    await writeFile(
      sale,
      JSON.stringify({
        checkedAt: "2026-10-30",
        hub: "Masjid Uji",
        note: "Uji.",
        ads,
      }),
    );
    const result = build([input, output, "--sale-ads", sale]);
    return {
      result,
      data:
        result.status === 0 ? JSON.parse(await readFile(output, "utf8")) : null,
    };
  };
  const ok = await run([ad]);
  assert.equal(ok.result.status, 0, ok.result.stderr);
  assert.equal(ok.data.metadata.saleAds.ads[0].price.amount, 650_000_000);
  const pinned = await run([{ ...ad, coordinate: { lat: -6.4, lng: 106.96 } }]);
  assert.match(pinned.result.stderr, /tidak boleh berkoordinat/);
  const bare = await run([{ ...ad, nearMosque: null, evidence: [] }]);
  assert.match(bare.result.stderr, /wajib ada bukti/);
});
