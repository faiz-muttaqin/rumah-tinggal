import assert from "node:assert/strict";
import test from "node:test";
import {
  filterMapRentals,
  rentalConnections,
  rentalPinGroups,
  rentalPopupHTML,
} from "../src/rental-map.ts";
import type { ResearchMosque, ResearchRental } from "../src/research-data.ts";
import { researchFixture } from "../tests/research-fixture.ts";

test("the Kos filter includes individual offers alongside family offers", () => {
  const base = researchFixture.metadata.rentals.rentals[0] as ResearchRental;
  const individual = { ...base, id: "individual", rentalType: "kos" as const };
  const family = { ...base, id: "family", rentalType: "kos-keluarga" as const };
  assert.deepEqual(
    filterMapRentals([base, individual, family], {
      kinds: new Set(["kos"]),
      area: "Semua",
      query: "",
      maxMonthlyRent: 0,
      sort: "recommended",
    }),
    [individual, family],
  );
});

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

test("map proximity draws one line per shared point and a 1.5 km mosque radius", () => {
  const base = researchFixture.metadata.rentals.rentals[0] as ResearchRental;
  const mosque = researchFixture.metadata.mosques.items[0] as ResearchMosque;
  const located = {
    ...base,
    location: {
      lat: mosque.lat + 0.003,
      lng: mosque.lng,
      precision: "approximate" as const,
      label: "Pin portal",
      url: "https://example.invalid/pin",
      method: "Peta",
      note: "Perkiraan",
      checkedAt: "2026-11-02",
    },
    nearbyMosques: [{ id: mosque.id, name: mosque.name, km: 0.334 }],
  };
  const data = rentalConnections(
    [located, { ...located, id: "same-point" }, { ...base, location: null }],
    [mosque],
    mosque,
  );
  assert.equal(data.features.length, 2);
  const line = data.features[0];
  assert.equal(line.geometry.type, "LineString");
  if (line.geometry.type === "LineString")
    assert.deepEqual(line.geometry.coordinates, [
      [mosque.lng, mosque.lat + 0.003],
      [mosque.lng, mosque.lat],
    ]);
  const radius = data.features[1];
  assert.equal(radius.geometry.type, "Polygon");
  if (radius.geometry.type === "Polygon") {
    assert.equal(radius.geometry.coordinates[0].length, 65);
    assert.deepEqual(
      radius.geometry.coordinates[0][0],
      radius.geometry.coordinates[0][64],
    );
    assert.ok(
      Math.abs(
        radius.geometry.coordinates[0][16][1] - mosque.lat - 1.5 / 111.2,
      ) < 1e-8,
    );
  }
  assert.equal(rentalConnections([], [mosque]).features.length, 0);
});
