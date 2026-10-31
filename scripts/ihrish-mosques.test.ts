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

const row = `<a data-mosque-row data-mosque-id="m_uji_1"
  href="/masjid/masjid-uji/" data-name="Masjid Uji &amp; Belajar"
  data-address="Jl. Belajar, Blok &quot;A&quot;" data-lat="-6.123456789" data-lng="106.765432123"
  data-route="https://maps.app.goo.gl/example">
  <span data-row-badge>3</span></a>`;
const html = `<h2 data-map-headline>3 kajian di 1 masjid</h2>${row}`;
const profile = `<article data-id="personal-name-1" data-mosque-id="m_uji_1"
  data-starts="2026-10-31T09:00:00+07:00" data-cat="fiqih" data-rutin>
  Nama pemateri rahasia, judul, caption dan kontak 081234567890</article>
  <article data-id="personal-name-2" data-mosque-id="m_uji_1"
    data-starts="2026-11-01T09:00:00+07:00" data-cat="fiqih" data-rutin data-cancelled></article>
  <article data-id="personal-name-3" data-mosque-id="m_uji_1"
    data-starts="2026-11-02T09:00:00+07:00" data-cat="umum"></article>
  <article data-id="personal-name-3" data-mosque-id="m_uji_1"
    data-starts="2026-11-02T09:00:00+07:00" data-cat="umum"></article>
  <article data-id="old" data-mosque-id="m_uji_1"
    data-starts="2026-10-30T09:00:00+07:00" data-rutin></article>
  <article data-id="foreign" data-mosque-id="m_other_1"
    data-starts="2026-11-02T09:00:00+07:00" data-rutin></article>
  <template><article data-id="template" data-mosque-id="m_uji_1"
    data-starts="2026-11-02T09:00:00+07:00" data-rutin></article></template>
  <article data-id="placeholder" data-mosque-id="m_uji_1"
    data-starts="2026-11-02T09:00:00+07:00" data-rutin></article>`;

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const dir = await mkdtemp(join(tmpdir(), "ihrish-mosques-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, "peta.html");
  const out = join(dir, "export");
  await writeFile(input, html);
  await writeFile(join(dir, "masjid-uji.html"), profile);
  const run = (extra: string[] = []) =>
    spawnSync(
      "python3",
      [
        "-I",
        "scripts/import-ihrish-mosques.py",
        input,
        "--checked-at",
        "2026-10-31",
        "--profiles-dir",
        dir,
        "--output-dir",
        out,
        ...extra,
      ],
      { encoding: "utf8" },
    );
  return { input, out, run };
}

test("Ihrish exports decoded coordinates and private-data-free schedule aggregates", {
  skip: python,
}, async (t) => {
  const { out, run } = await fixture(t);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const jsonText = await readFile(join(out, "ihrish-mosques.json"), "utf8");
  const data = JSON.parse(jsonText);
  assert.equal(data.mosques[0].name, "Masjid Uji & Belajar");
  assert.equal(data.mosques[0].lat, -6.123457);
  assert.equal(data.mosques[0].lng, 106.765432);
  assert.equal(data.source.reportedEvents, 3);
  assert.doesNotMatch(jsonText, /personal-name|pemateri rahasia|081234567890/);
  const summary = data.mosques[0].profile;
  assert.equal(summary.listedUpcoming, 3);
  assert.equal(summary.notCancelledUpcoming, 2);
  assert.equal(summary.cancelledUpcoming, 1);
  assert.equal(summary.regularNotCancelled, 1);
  assert.deepEqual(summary.distinctDates, ["2026-10-31", "2026-11-02"]);
  assert.deepEqual(summary.topics, { fiqih: 1, umum: 1 });
  const geo = JSON.parse(
    await readFile(join(out, "ihrish-mosques.geojson"), "utf8"),
  );
  assert.deepEqual(
    geo.features[0].geometry.coordinates,
    [106.765432, -6.123457],
  );
  assert.equal("lat" in geo.features[0].properties, false);
  const csv = await readFile(join(out, "ihrish-mosques.csv"), "utf8");
  assert.ok(csv.includes('"Jl. Belajar, Blok ""A"""'));
  assert.equal(run(["--check"]).status, 0);
});

test("Ihrish fails closed for changed counts, duplicates, bad points and unsafe URLs", {
  skip: python,
}, async (t) => {
  const { input, out, run } = await fixture(t);
  assert.equal(run().status, 0);
  const original = await readFile(join(out, "ihrish-mosques.json"), "utf8");
  const invalid = [
    html.replace("3 kajian", "4 kajian"),
    `<h2 data-map-headline>6 kajian di 2 masjid</h2>${row}${row}`,
    html.replace('data-lat="-6.123456789"', 'data-lat="NaN"'),
    html.replace('data-lat="-6.123456789"', 'data-lat="91"'),
    html.replace('data-lng="106.765432123"', 'data-lng="181"'),
    html.replace("https://maps.app.goo.gl/example", "javascript:alert(1)"),
    html.replace(
      "https://maps.app.goo.gl/example",
      "https://user:secret@maps.app.goo.gl/example",
    ),
    html.replace("/masjid/masjid-uji/", "//example.invalid/masjid/uji/"),
  ];
  for (const value of invalid) {
    await writeFile(input, value);
    const result = run();
    assert.equal(result.status, 1, result.stdout);
    assert.equal(
      await readFile(join(out, "ihrish-mosques.json"), "utf8"),
      original,
    );
  }
});

test("Ihrish --check reports stale exports without overwriting any artifact", {
  skip: python,
}, async (t) => {
  const { out, run } = await fixture(t);
  assert.equal(run().status, 0);
  const target = join(out, "ihrish-mosques.csv");
  await writeFile(target, "stale\n");
  const result = run(["--check"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ihrish-mosques\.csv/);
  assert.equal(await readFile(target, "utf8"), "stale\n");
});

test("Ihrish --check accepts JSON formatting but rejects changed values, array order and malformed JSON", {
  skip: python,
}, async (t) => {
  const { out, run } = await fixture(t);
  assert.equal(run().status, 0);
  const reformatted = new Map<string, string>();
  for (const name of ["ihrish-mosques.json", "ihrish-mosques.geojson"]) {
    const target = join(out, name);
    const data = JSON.parse(await readFile(target, "utf8"));
    const text = JSON.stringify(
      Object.fromEntries(Object.entries(data).reverse()),
    );
    reformatted.set(target, text);
    await writeFile(target, text);
  }
  assert.equal(run(["--check"]).status, 0);
  for (const [target, text] of reformatted) {
    assert.equal(await readFile(target, "utf8"), text);
    const changed = JSON.parse(text);
    if ("mosques" in changed) changed.mosques[0].eventCount += 1;
    else changed.features[0].properties.eventCount += 1;
    const stale = JSON.stringify(changed);
    await writeFile(target, stale);
    assert.equal(run(["--check"]).status, 1);
    assert.equal(await readFile(target, "utf8"), stale);
    await writeFile(target, text);
  }
  const target = join(out, "ihrish-mosques.json");
  const text = reformatted.get(target);
  assert.ok(text);
  const changed = JSON.parse(text);
  changed.mosques[0].profile.distinctDates.reverse();
  await writeFile(target, JSON.stringify(changed));
  assert.equal(run(["--check"]).status, 1);
  await writeFile(target, "{ malformed");
  assert.equal(run(["--check"]).status, 1);
  assert.equal(await readFile(target, "utf8"), "{ malformed");
});
