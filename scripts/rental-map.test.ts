import assert from "node:assert/strict";
import test from "node:test";
import {
  filterMapRentals,
  rentalPinGroups,
  rentalPopupHTML,
} from "../src/rental-map.ts";
import type { ResearchRental } from "../src/research-data.ts";
import { researchFixture } from "../tests/research-fixture.ts";

test("rental pins group shared coordinates and filters preserve unlocated rentals", () => {
  const base = researchFixture.metadata.rentals.rentals[0] as ResearchRental;
  const location = {
    lat: -6.256,
    lng: 107.032,
    precision: "complex" as const,
    label: "Kompleks uji",
    url: "https://example.invalid/location",
    method: "Peta publik",
    note: "Acuan kompleks",
    checkedAt: "2026-11-02",
  };
  const nearby = [{ id: "masjid-uji", name: "Masjid Kajian", km: 0.3 }];
  const located = { ...base, id: "located", location, nearbyMosques: nearby };
  const kos = { ...located, id: "kos", rentalType: "kos-keluarga" as const };
  const unlocated = { ...base, id: "unlocated", location: null };
  const filters = {
    kinds: new Set(["kos", "kontrakan"] as const),
    area: "Semua",
    query: "",
    maxMonthlyRent: 0,
    sort: "recommended",
  };
  assert.deepEqual(rentalPinGroups([unlocated, located, kos]), [
    [located, kos],
  ]);
  assert.deepEqual(filterMapRentals([unlocated, located, kos], filters), [
    located,
    kos,
    unlocated,
  ]);
  assert.deepEqual(
    filterMapRentals([unlocated, located, kos], { ...filters, mosque: "near" }),
    [located, kos],
  );
  assert.deepEqual(
    filterMapRentals([unlocated, located, kos], {
      ...filters,
      mosque: "missing",
    }),
    [],
  );
  assert.deepEqual(
    filterMapRentals([unlocated, located, kos], {
      ...filters,
      query: "Masjid Kajian",
    }),
    [located, kos],
  );
  const html = rentalPopupHTML([
    { ...located, title: '<img src=x onerror="fail()">' },
  ]);
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("bukan jarak dari pintu unit"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(
    rentalPopupHTML([unlocated]).includes('data-testid="rental-popup"'),
  );
});
