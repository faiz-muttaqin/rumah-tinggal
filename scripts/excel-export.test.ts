import assert from "node:assert/strict";
import test from "node:test";
import {
  createExcelBlob,
  listingSheets,
  researchSheets,
} from "../src/excel-export.ts";
import type { ResearchData } from "../src/research-data.ts";
import type { Listing } from "../src/types.ts";
import { readExcel } from "../tests/excel-workbook.ts";
import { researchFixture } from "../tests/research-fixture.ts";

test("Excel export writes numeric prices, Unicode, multiline notes and formula-like text safely", async () => {
  const notes =
    '=HYPERLINK("https://example.invalid", "uji")\nMasjid & sekolah <dekat> 🏡';
  const listing: Listing = {
    id: "listing-uji",
    title: "+Judul uji",
    notes,
    area: "Bekasi",
    district: "Uji",
    type: "Rumah",
    price: 500_000_000,
    bedrooms: 0,
    landArea: 60,
    lat: -6.2,
    lng: 107.01,
    createdAt: "2026-10-31T12:00:00.000Z",
    sourceUrl: "javascript:alert(1)",
  };
  const sheets = listingSheets([listing], [], [["Daerah", "Bekasi"]]);
  const blob = await createExcelBlob(sheets);
  assert.equal(
    blob.type,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  const workbook = readExcel(Buffer.from(await blob.arrayBuffer()));
  assert.deepEqual(Object.keys(workbook), ["Listingku", "Catatan"]);
  const row = workbook.Listingku.rows[0];
  assert.equal(row["Nama hunian"], listing.title);
  assert.equal(row["Harga beli (Rp)"], 500_000_000);
  assert.equal(row["Kamar tidur"], 0);
  assert.equal(row.Latitude, -6.2);
  assert.equal(row["Catatan survei"], notes);
  assert.equal(row["Tautan sumber"], null);
  assert.equal(row["Jarak KRL (km garis lurus)"], null);
  assert.match(String(row["Google Maps"]), /query=-6.2%2C107.01/);
  assert.equal(workbook.Listingku.formulaCount, 0);
  assert.equal(workbook.Listingku.frozenRows, 1);
});

test("research workbook preserves uncertain locations, planned stations and yearly rent provenance", async () => {
  const research = {
    ...researchFixture.metadata,
    properties: researchFixture.features.map((feature) => ({
      ...feature.properties,
      lng: feature.geometry?.coordinates[0] ?? null,
      lat: feature.geometry?.coordinates[1] ?? null,
    })),
  } as unknown as ResearchData;
  assert.ok(research.rentals);
  const rental = structuredClone(research.rentals.rentals[0]);
  rental.rent.amount = 43_000_000;
  rental.rent.period = "yearly";
  const selection = {
    properties: research.properties,
    rentals: [rental],
    saleAds: research.saleAds?.ads ?? [],
    mosques: research.mosques?.items ?? [],
    leads: research.leads?.leads ?? [],
  };
  const blob = await createExcelBlob(researchSheets(selection, research, []));
  const workbook = readExcel(Buffer.from(await blob.arrayBuffer()));
  assert.deepEqual(Object.keys(workbook), [
    "Proyek Developer",
    "Sewa",
    "Iklan Dijual",
    "Masjid",
    "Petunjuk",
    "Catatan",
  ]);
  const projects = workbook["Proyek Developer"].rows;
  const unlocated = projects.find((row) => row.ID === "prj-uji-islami-jauh");
  assert.equal(unlocated?.Latitude, null);
  assert.equal(unlocated?.Longitude, null);
  assert.equal(projects[0]["Harga maksimum (Rp)"], 620_000_000);
  assert.equal(projects[0]["Sumber harga"], research.properties[0].price.url);
  const bekasi = projects.find((row) => row.ID === "prj-uji-bekasi-timur");
  assert.match(String(bekasi?.["Stasiun rencana terdekat"]), /Rencana Uji/);
  assert.match(String(bekasi?.["Masjid dengan kajian"]), /Masjid Uji/);
  assert.equal(workbook.Sewa.rows[0]["Harga sewa (Rp)"], 43_000_000);
  assert.equal(workbook.Sewa.rows[0].Periode, "Per tahun");
  assert.equal(
    workbook.Sewa.rows[0]["Setara bulanan (Rp, perkiraan)"],
    3_583_333,
  );
  assert.equal(
    workbook.Masjid.rows[0]["Jadwal profil dibatalkan (bila diperiksa)"],
    null,
  );
  assert.equal(
    workbook.Masjid.rows[1]["Jadwal profil dibatalkan (bila diperiksa)"],
    1,
  );
  assert.match(String(workbook.Petunjuk.rows[0].Status), /Belum/);
  for (const sheet of Object.values(workbook)) {
    assert.equal(sheet.formulaCount, 0);
    assert.equal(sheet.frozenRows, 1);
  }
});
