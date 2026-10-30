import assert from "node:assert/strict";
import test from "node:test";
import {
  type ResearchProperty,
  researchToListing,
  researchToPin,
  safeUrl,
} from "../src/research-data.ts";
import { researchFixture } from "../tests/research-fixture.ts";

const feature = researchFixture.features[0];
const property = {
  ...feature.properties,
  lng: (feature.geometry?.coordinates ?? [])[0],
  lat: (feature.geometry?.coordinates ?? [])[1],
} as unknown as ResearchProperty;

test("research transfers price provenance and coordinates to private listings and pins", () => {
  const listing = researchToListing(property);
  const pin = researchToPin(property);
  assert.ok(listing);
  assert.ok(pin);
  assert.equal(listing.sourceUrl, property.price.url);
  assert.equal(listing.price, property.price.min);
  assert.equal(listing.bedrooms, 2);
  assert.equal(listing.landArea, 60);
  assert.equal(pin.category, "lainnya");
  for (const entry of [listing, pin]) {
    assert.equal(entry.lat, property.lat);
    assert.equal(entry.lng, property.lng);
    assert.ok(entry.notes?.includes(property.price.url));
    assert.ok(entry.notes?.includes(property.officialUrl ?? ""));
    assert.ok(entry.notes?.includes("30 Okt 2026"));
    assert.ok(entry.notes?.includes("instagram.example.invalid/p/uji"));
    assert.ok(entry.notes?.includes(`/riset#${property.id}`));
  }
  assert.ok((pin.notes?.length ?? 0) <= 2000);
  assert.equal(researchToListing({ ...property, area: null }), undefined);
  assert.equal(researchToPin({ ...property, lat: null }), undefined);
});

test("source links reject scripts and embedded credentials", () => {
  assert.equal(safeUrl("javascript:alert(1)"), "#");
  assert.equal(safeUrl("https://user:secret@example.invalid"), "#");
  assert.equal(
    safeUrl("https://www.instagram.com/p/test/"),
    "https://www.instagram.com/p/test/",
  );
});
