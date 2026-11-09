import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import type { Listing } from "../src/types.ts";
import { readExcel } from "./excel-workbook.ts";
import { mockListingAccount } from "./listing-account.ts";
import { researchFixture } from "./research-fixture.ts";

const pageErrors = new WeakMap<Page, string[]>();
const blockedTileRequests = new WeakMap<Page, number>();

// Original synthetic MVT: two crossing streets, one rectangular building, and
// a grid of fictional mosques and schools in the poi layer.
// It has no real-world data, labels, or glyph dependencies. Tests exercise
// rendered vector layers without depending on external tile availability.
const basemapTile = Buffer.from(
  "GkJ4AgoOdHJhbnNwb3J0YXRpb24ogCASGwgBEgIAABgCIhEJAIAgCoBAAAn/H/8fCgCAQBoFY2xhc3MiBwoFbWlub3IaKXgCCghidWlsZGluZyiAIBIYCAISABgDIhAJgAiACBqAMAAAgDD/LwAPGqEKCgNwb2kSERIGAAABAQICGAEiBQmABIAEEhESBgADAQMCBBgBIgUJgASADBIREgYAAAEBAgIYASIFCYAEgBQSERIGAAMBAwIEGAEiBQmABIAcEhESBgAAAQECAhgBIgUJgASAJBIREgYAAwEDAgQYASIFCYAEgCwSERIGAAABAQICGAEiBQmABIA0EhESBgADAQMCBBgBIgUJgASAPBIREgYAAwEDAgQYASIFCYAMgAQSERIGAAABAQICGAEiBQmADIAMEhESBgADAQMCBBgBIgUJgAyAFBIREgYAAAEBAgIYASIFCYAMgBwSERIGAAMBAwIEGAEiBQmADIAkEhESBgAAAQECAhgBIgUJgAyALBIREgYAAwEDAgQYASIFCYAMgDQSERIGAAABAQICGAEiBQmADIA8EhESBgAAAQECAhgBIgUJgBSABBIREgYAAwEDAgQYASIFCYAUgAwSERIGAAABAQICGAEiBQmAFIAUEhESBgADAQMCBBgBIgUJgBSAHBIREgYAAAEBAgIYASIFCYAUgCQSERIGAAMBAwIEGAEiBQmAFIAsEhESBgAAAQECAhgBIgUJgBSANBIREgYAAwEDAgQYASIFCYAUgDwSERIGAAMBAwIEGAEiBQmAHIAEEhESBgAAAQECAhgBIgUJgByADBIREgYAAwEDAgQYASIFCYAcgBQSERIGAAABAQICGAEiBQmAHIAcEhESBgADAQMCBBgBIgUJgByAJBIREgYAAAEBAgIYASIFCYAcgCwSERIGAAMBAwIEGAEiBQmAHIA0EhESBgAAAQECAhgBIgUJgByAPBIREgYAAAEBAgIYASIFCYAkgAQSERIGAAMBAwIEGAEiBQmAJIAMEhESBgAAAQECAhgBIgUJgCSAFBIREgYAAwEDAgQYASIFCYAkgBwSERIGAAABAQICGAEiBQmAJIAkEhESBgADAQMCBBgBIgUJgCSALBIREgYAAAEBAgIYASIFCYAkgDQSERIGAAMBAwIEGAEiBQmAJIA8EhESBgADAQMCBBgBIgUJgCyABBIREgYAAAEBAgIYASIFCYAsgAwSERIGAAMBAwIEGAEiBQmALIAUEhESBgAAAQECAhgBIgUJgCyAHBIREgYAAwEDAgQYASIFCYAsgCQSERIGAAABAQICGAEiBQmALIAsEhESBgADAQMCBBgBIgUJgCyANBIREgYAAAEBAgIYASIFCYAsgDwSERIGAAABAQICGAEiBQmANIAEEhESBgADAQMCBBgBIgUJgDSADBIREgYAAAEBAgIYASIFCYA0gBQSERIGAAMBAwIEGAEiBQmANIAcEhESBgAAAQECAhgBIgUJgDSAJBIREgYAAwEDAgQYASIFCYA0gCwSERIGAAABAQICGAEiBQmANIA0EhESBgADAQMCBBgBIgUJgDSAPBIREgYAAwEDAgQYASIFCYA8gAQSERIGAAABAQICGAEiBQmAPIAMEhESBgADAQMCBBgBIgUJgDyAFBIREgYAAAEBAgIYASIFCYA8gBwSERIGAAMBAwIEGAEiBQmAPIAkEhESBgAAAQECAhgBIgUJgDyALBIREgYAAwEDAgQYASIFCYA8gDQSERIGAAABAQICGAEiBQmAPIA8GgVjbGFzcxoIc3ViY2xhc3MaBG5hbWUiEgoQcGxhY2Vfb2Zfd29yc2hpcCIICgZtdXNsaW0iDAoKTWFzamlkIFVqaSIICgZzY2hvb2wiCAoGU0QgVWppKIAgeAI=",
  "base64",
);

function mapRegion(page: Page) {
  return page.getByRole("region", {
    name: "Peta hunian Jabodetabek",
    includeHidden: true,
  });
}

function cards(page: Page) {
  return page.getByTestId("listing-card");
}

async function openMapLayers(page: Page) {
  const panel = page.locator("#map-layer-panel");
  if ((await panel.getAttribute("open")) === null)
    await panel.locator("summary").click();
}

async function setRentalLayer(page: Page, kind: string, visible: boolean) {
  const panel = page.locator("#rental-layers");
  if ((await panel.getAttribute("open")) === null)
    await panel.locator("summary").first().click();
  await page.locator(`#rental-toggle-${kind}`).setChecked(visible);
}

async function expectClickableRentalPin(page: Page, kind: string) {
  await expect
    .poll(
      () =>
        page
          .locator(`#map .rental-pin[data-rental-kind="${kind}"]`)
          .evaluateAll((nodes) => {
            const map = document.querySelector("#map")?.getBoundingClientRect();
            if (!map) return 0;
            return nodes.filter((node) => {
              const r = node.getBoundingClientRect();
              const x = r.x + r.width / 2,
                y = r.y + r.height / 2;
              const top = document.elementFromPoint(x, y);
              return (
                x > map.left &&
                x < map.right &&
                y > map.top &&
                y < map.bottom &&
                (top === node || node.contains(top))
              );
            }).length;
          }),
      {
        message: `${kind} must have a visible map pin whose centre accepts clicks`,
      },
    )
    .toBeGreaterThan(0);
}

async function expectRenderedVectors(page: Page) {
  for (const attribute of ["data-region-features", "data-station-features"]) {
    await expect
      .poll(
        async () =>
          Number((await page.locator("#map").getAttribute(attribute)) ?? 0),
        {
          message: `The map must actually render vector features: ${attribute}`,
        },
      )
      .toBeGreaterThan(0);
  }
}

type MobilityLayer = "mrt" | "lrt" | "tj";

const mobilityCheckboxNames: Record<MobilityLayer, string> = {
  mrt: "Jalur MRT",
  lrt: "Jalur LRT",
  tj: "Jalur TransJakarta",
};

async function expectRenderedAttribute(
  page: Page,
  attribute: string,
  visible: boolean,
) {
  const map = page.locator("#map");
  await expect(map).toHaveAttribute(attribute, /^\d+$/);
  const rendered = expect.poll(
    async () => Number(await map.getAttribute(attribute)),
    { message: `${attribute} must reflect the rendered layer` },
  );
  if (visible) await rendered.toBeGreaterThan(0);
  else await rendered.toBe(0);
}

async function expectMobilityLayer(
  page: Page,
  mode: MobilityLayer,
  visible: boolean,
) {
  await expectRenderedAttribute(page, `data-${mode}-features`, visible);
  await expectRenderedAttribute(page, `data-${mode}-line-features`, visible);
}

async function expectUnchangedMapContext(page: Page) {
  await expectRenderedVectors(page);
  await expectRenderedAttribute(page, "data-road-features", true);
  await expect(page.locator("#map .price-pin")).toHaveCount(8);
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  blockedTileRequests.set(page, 0);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/Worker failed/i.test(message.text())) errors.push(message.text());
  });
  // Place search is stubbed so automation never calls the public geocoder.
  await page.route("**/api/places?**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q") ?? "";
    await route.fulfill({
      json: {
        places: /taman/i.test(query)
          ? [
              {
                id: "W1",
                name: "Taman Uji Menteng",
                detail: "Menteng, Jakarta",
                kind: "park",
                lat: -6.196,
                lng: 106.83,
              },
            ]
          : [],
      },
    });
  });
  // Research data is a fictional fixture so tests never depend on live prices.
  await page.route("**/data/properties.geojson", async (route) => {
    await route.fulfill({ json: researchFixture });
  });
  // Never request public OSM raster tiles during automation.
  await page.route("**/tile.openstreetmap.org/**", async (route) => {
    blockedTileRequests.set(page, (blockedTileRequests.get(page) ?? 0) + 1);
    await route.abort("blockedbyclient");
  });
  await page.route("**/tiles.openfreemap.org/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/planet") {
      await route.fulfill({
        json: {
          tilejson: "3.0.0",
          tiles: ["https://tiles.openfreemap.org/test/{z}/{x}/{y}.pbf"],
          minzoom: 0,
          maxzoom: 14,
        },
      });
    } else if (path.startsWith("/test/")) {
      await route.fulfill({
        contentType: "application/x-protobuf",
        body: basemapTile,
      });
    } else {
      await route.abort("blockedbyclient");
    }
  });
  await page.goto("/");
  // Phones initially show the list; the hidden map remains mounted.
  await expect(mapRegion(page)).toBeAttached();
});

test.afterEach(async ({ page }) => {
  // Tile fetch failures can emit console/network events. Unhandled application
  // JavaScript errors and failed map workers are still failures.
  expect(
    pageErrors.get(page) ?? [],
    "Unhandled browser JavaScript errors",
  ).toEqual([]);
});

for (const [device, viewport] of [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
] as const) {
  test(`region lock prevents accidental zoom out and keeps navigation usable on ${device}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const base = researchFixture.metadata.rentals.rentals[0];
    const mosque = researchFixture.metadata.mosques.items[0];
    await page.route("**/data/properties.geojson", (route) =>
      route.fulfill({
        json: {
          ...researchFixture,
          metadata: {
            ...researchFixture.metadata,
            rentals: {
              ...researchFixture.metadata.rentals,
              rentals: ["kontrakan", "kos", "apartemen"].map((kind, i) => ({
                ...base,
                id: `lock-${kind}`,
                rentalType:
                  kind === "kos"
                    ? "kos-keluarga"
                    : kind === "apartemen"
                      ? "apartemen-sewa"
                      : kind,
                location: {
                  lat: mosque.lat + i * 0.002,
                  lng: mosque.lng + i * 0.002,
                  precision: "complex",
                  label: "Titik sewa uji",
                  url: "https://portal.example.invalid/pin",
                  method: "Peta uji",
                  note: "Lokasi fiktif untuk pengujian",
                  checkedAt: "2026-11-09",
                },
              })),
            },
          },
        },
      }),
    );
    await page.goto("/?koleksi=sewa");
    await page.locator('[data-view-rental="lock-kontrakan"]').click();
    await page.locator(".maplibregl-popup-close-button").click();
    await expectRenderedAttribute(page, "data-region-features", true);
    const pins = page.locator("#map .rental-pin");
    const positions = () =>
      pins.evaluateAll((nodes) =>
        nodes.map((node) => {
          const { x, y } = node.getBoundingClientRect();
          return [Math.round(x), Math.round(y)];
        }),
      );
    const separation = async () => {
      const [a, b] = await positions();
      return Math.hypot(a[0] - b[0], a[1] - b[1]);
    };
    const canvas = page.locator("#map canvas");
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error("Map canvas missing");
    const emptyArea = { x: bounds.width * 0.4, y: bounds.height * 0.62 };
    const before = await positions();
    await canvas.click({ position: emptyArea });
    await expect(page.locator('[data-area="Semua"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Region navigation animates for 500 ms; catch a delayed camera reset too.
    await page.waitForTimeout(700);
    expect(await positions()).toEqual(before);
    const lock = page.getByRole("button", {
      name: "Kunci wilayah",
      exact: true,
    });
    await expect(lock).toHaveAttribute("aria-pressed", "true");

    await pins.first().click();
    await expect(page.getByTestId("rental-popup")).toBeVisible();
    await page.locator(".maplibregl-popup-close-button").click();
    await openMapLayers(page);
    const beforeLayer = await positions();
    await page.locator("#rail-toggle").uncheck();
    expect(await positions()).toEqual(beforeLayer);
    await page.locator("#map-layer-panel > summary").click();

    const beforePan = await positions();
    await canvas.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(positions).not.toEqual(beforePan);
    const beforeZoom = await separation();
    await page.locator(".maplibregl-ctrl-zoom-in").click();
    await expect.poll(separation).toBeGreaterThan(beforeZoom * 1.5);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`region-lock-${device}.png`),
    });

    await lock.focus();
    await page.keyboard.press("Enter");
    await expect(lock).toHaveAttribute("aria-pressed", "false");
    await canvas.click({ position: emptyArea });
    await expect(page.locator('[data-area="Bekasi"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect.poll(separation).toBeLessThan(beforeZoom);
    await page.reload();
    if (device === "mobile") await page.locator("#mobile-map").click();
    await expect(lock).toHaveAttribute("aria-pressed", "false");
    await lock.click();
    await page.reload();
    if (device === "mobile") await page.locator("#mobile-map").click();
    await expect(lock).toHaveAttribute("aria-pressed", "true");
  });

  test(`independent rental toggles, area, monthly budget and export work on ${device}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const baseRental = researchFixture.metadata.rentals.rentals[0];
    await page.route("**/data/properties.geojson", (route) =>
      route.fulfill({
        json: {
          ...researchFixture,
          metadata: {
            ...researchFixture.metadata,
            rentals: {
              ...researchFixture.metadata.rentals,
              rentals: [
                ...researchFixture.metadata.rentals.rentals,
                {
                  ...baseRental,
                  id: "rent-uji-kos",
                  title: "Kos Keluarga Uji",
                  rentalType: "kos-keluarga",
                  area: "Jakarta",
                  locationText: "Pasar Minggu, Jakarta Selatan",
                  rent: { ...baseRental.rent, amount: 1000000 },
                },
                {
                  ...baseRental,
                  id: "rent-uji-tahunan",
                  title: "Rumah Sewa Tahunan Uji",
                  rentalType: "rumah-sewa",
                  rent: {
                    ...baseRental.rent,
                    amount: 24000000,
                    period: "yearly",
                  },
                },
              ],
            },
          },
        },
      }),
    );
    const privateRequests: string[] = [];
    page.on("request", (request) => {
      if (
        /^\/api\/(listings|pins)(?:\/|$)/.test(new URL(request.url()).pathname)
      )
        privateRequests.push(request.url());
    });
    await page.goto("/");
    await expect(page.locator("#rentals-count")).toHaveText("4");
    await cards(page).first().click();
    await expect(page.locator("#detail-card")).toBeVisible();
    await page.locator("#rental-layers > summary").click();
    await expect(page.locator("#map-layer-panel")).not.toHaveAttribute("open");
    for (const kind of ["kos", "kontrakan", "apartemen"])
      await expect(page.locator(`#rental-toggle-${kind}`)).not.toBeChecked();
    await expect(page.locator("#rental-count-kontrakan")).toHaveText("2");

    const rentalCards = page.getByTestId("map-rental-card");
    await setRentalLayer(page, "kos", true);
    await expect(rentalCards).toHaveCount(1);
    await expect(rentalCards.first()).toContainText("Kos Keluarga Uji");
    await expect(page.locator("#detail-card")).toBeHidden();
    await expect(page.locator("#map .price-pin")).toHaveCount(0);
    await expect(page.locator("#rental-map-status")).toContainText(
      "belum dipetakan",
    );
    await setRentalLayer(page, "kontrakan", true);
    await expect(rentalCards).toHaveCount(3);
    await setRentalLayer(page, "kos", false);
    await expect(rentalCards).toHaveCount(2);
    await expect(page.locator("#rental-toggle-kontrakan")).toBeChecked();
    await setRentalLayer(page, "apartemen", true);
    await expect(rentalCards).toHaveCount(3);
    await setRentalLayer(page, "kontrakan", false);
    await expect(rentalCards).toHaveCount(1);
    await expect(rentalCards.first()).toContainText("Apartemen Sewa Uji");
    await expect(page.locator("#rental-toggle-apartemen")).toBeChecked();
    await expectRenderedVectors(page);
    await expectRenderedAttribute(page, "data-road-features", true);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`rental-map-${device}.png`),
    });

    await page.locator("#view-rentals").click();
    await expect(rentalCards.first()).toBeVisible();
    await expect(page.locator("#rental-filters")).toBeVisible();
    await expect(page.locator("#purchase-filters")).toBeHidden();
    await expect(page.locator("#commute-filter")).toBeHidden();
    await expect(
      page.locator('[data-rental-filter="apartemen"]'),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-rental-filter="kos"]')).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await page.locator('[data-rental-filter="kontrakan"]').click();
    await page.locator("#rental-budget").selectOption("2000000");
    await expect(rentalCards).toHaveCount(1);
    await expect(rentalCards.first()).toHaveAttribute(
      "data-rental-id",
      "rent-uji-tahunan",
    );
    await expect(rentalCards.first()).toContainText("Rp 24.000.000/tahun");
    await expect(rentalCards.first()).toContainText("Rp 2.000.000/bulan");
    await page.locator("#rental-budget").selectOption("0");
    await page.locator('.area-chips [data-area="Bekasi"]').click();
    await expect(rentalCards).toHaveCount(2);
    await page.locator("#search").fill("rumah sewa tahunan");
    await expect(rentalCards).toHaveCount(1);
    await page.locator("#search").fill("");
    await page.locator('[data-rental-filter="kontrakan"]').click();
    await page.locator('[data-rental-filter="apartemen"]').click();
    await expect(rentalCards).toHaveCount(0);
    await expect(page.getByTestId("rental-empty")).toContainText(
      "Semua jenis sewa disembunyikan",
    );
    await expect(page.locator("#listing-export")).toBeDisabled();
    await page.locator("#reset-rentals").click();
    await expect(rentalCards).toHaveCount(4);
    await page.locator("#sort").selectOption("price");
    await expect(rentalCards.first()).toHaveAttribute(
      "data-rental-id",
      "rent-uji-kos",
    );
    await page.locator('[data-rental-filter="apartemen"]').click();
    const downloadEvent = page.waitForEvent("download");
    await page.locator("#listing-export").click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toMatch(/^sewa-hunian-.*\.xlsx$/);
    const path = testInfo.outputPath(`rentals-${device}.xlsx`);
    await download.saveAs(path);
    const workbook = readExcel(await readFile(path));
    expect(workbook.Sewa.rows.map((row) => row.ID)).toEqual([
      "rent-uji-kos",
      "rent-uji-tahunan",
      "rent-uji-bekasi",
    ]);
    expect(workbook["Proyek Developer"]).toBeUndefined();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`rental-list-${device}.png`),
    });
    await page.locator("#demo-tab").click();
    await expect(cards(page)).toHaveCount(8);
    await expect(page.locator("#map .price-pin")).toHaveCount(8);
    await expect(page.locator("#rental-note")).toBeHidden();
    await expect(page.locator("#rental-toggle-kos")).not.toBeChecked();
    await page.locator("#rentals-tab").click();
    await expect(rentalCards).toHaveCount(3);
    expect(privateRequests).toEqual([]);
  });
}

for (const [device, viewport] of [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
] as const) {
  test(`rental pins, shared locations, mosque focus and coordinate export work on ${device}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    const base = researchFixture.metadata.rentals.rentals[0];
    const mosque = researchFixture.metadata.mosques.items[0];
    const location = {
      lat: mosque.lat,
      lng: mosque.lng + 0.002,
      precision: "complex",
      label: "Kompleks uji",
      url: "https://portal.example.invalid/pin",
      method: "Peta publik",
      note: "Titik kompleks, bukan posisi unit",
      checkedAt: "2026-11-02",
    };
    const nearbyMosques = [{ id: mosque.id, name: mosque.name, km: 0.221 }];
    await page.route("**/data/properties.geojson", (route) =>
      route.fulfill({
        json: {
          ...researchFixture,
          metadata: {
            ...researchFixture.metadata,
            rentals: {
              ...researchFixture.metadata.rentals,
              rentals: [
                { ...base, location, nearbyMosques },
                {
                  ...base,
                  id: "rent-pin-kos",
                  title: "Kos Uji Satu Kompleks",
                  rentalType: "kos-keluarga",
                  location,
                  nearbyMosques,
                },
                {
                  ...base,
                  id: "rent-pin-far",
                  title: "Apartemen Jauh Uji",
                  rentalType: "apartemen-sewa",
                  location: {
                    ...location,
                    lat: -6.36,
                    lng: 106.83,
                    precision: "approximate",
                  },
                  nearbyMosques: [],
                },
                {
                  ...base,
                  id: "rent-unlocated",
                  title: "Rumah Tanpa Titik",
                  location: null,
                  locationNote: "Centroid kecamatan ditolak",
                  nearbyMosques: [],
                },
              ],
            },
          },
        },
      }),
    );
    const requests: string[] = [];
    page.on("request", (request) => {
      if (
        /^\/api\/(listings|pins)(?:\/|$)/.test(new URL(request.url()).pathname)
      )
        requests.push(request.url());
    });
    await page.goto("/?koleksi=sewa");
    const rentalCards = page.getByTestId("map-rental-card");
    await expect(rentalCards).toHaveCount(4);
    await expect(page.locator("#map")).toHaveAttribute(
      "data-rental-features",
      "3",
    );
    await expect(page.locator("#map .rental-pin")).toHaveCount(2);
    await expect(page.locator("#map .rental-pin.is-approximate")).toHaveCount(
      1,
    );
    await expect(page.locator("#kajian-toggle")).toBeChecked();
    await page.locator("#rental-mosque").selectOption("near");
    await expect(rentalCards).toHaveCount(2);
    await expect(page.locator("#map .rental-pin")).toHaveCount(1);
    const downloadEvent = page.waitForEvent("download");
    await page.locator("#listing-export").click();
    const download = await downloadEvent;
    const path = testInfo.outputPath(`rental-pins-${device}.xlsx`);
    await download.saveAs(path);
    const workbook = readExcel(await readFile(path));
    expect(workbook.Sewa.rows).toHaveLength(2);
    expect(workbook.Sewa.rows[0]["Latitude titik acuan"]).toBe(location.lat);
    expect(workbook.Sewa.rows[0]["Sumber titik"]).toBe(location.url);
    expect(workbook.Sewa.rows[0]["Tanggal cek"]).toBe(base.lastChecked);
    expect(workbook.Sewa.rows[0]["Tanggal cek lokasi"]).toBe("2026-11-02");
    if (device === "mobile") await page.locator("#mobile-map").click();
    await page.locator("#map .rental-pin").click();
    const popup = page.getByTestId("rental-popup");
    await expect(popup).toContainText("2 sewa pada titik yang sama");
    await expect(
      popup.getByRole("heading", { name: "2 sewa pada titik yang sama" }),
    ).toBeInViewport();
    await expect(popup).toContainText("bukan jarak dari pintu unit");
    const route = popup
      .getByRole("link", { name: "Rute dari titik acuan" })
      .first();
    expect(
      new URL((await route.getAttribute("href")) ?? "").searchParams.get(
        "destination",
      ),
    ).toBe(`${mosque.lat},${mosque.lng}`);
    await popup.locator("[data-rental-mosque]").first().click();
    await expect(popup).toHaveCount(0);
    await page.locator("[data-focus-rentals]").click();
    await expect(page.locator("#rental-mosque")).toHaveValue(mosque.id);
    await expect(rentalCards).toHaveCount(2);
    await page.locator("#view-rentals").click();
    await page.locator('[data-rental-filter="kos"]').click();
    await expect(rentalCards).toHaveCount(1);
    await page.locator("#rental-mosque").selectOption("all");
    await expect(rentalCards).toHaveCount(3);
    await expect(
      page.locator('[data-rental-id="rent-unlocated"]'),
    ).toContainText("Centroid kecamatan ditolak");
    await expect(
      page.locator('[data-rental-id="rent-unlocated"] [data-view-rental]'),
    ).toHaveCount(0);
    await page.locator('[data-view-rental="rent-pin-far"]').click();
    await expect(popup).toContainText("Pin perkiraan portal");
    await expect(popup).toContainText("Belum ada masjid Ihrish");
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`rental-pin-popup-${device}.png`),
    });
    await page.goto("/?koleksi=sewa&sewa=rent-pin-far");
    await expect(popup).toContainText("Apartemen Jauh Uji");
    if (device === "mobile") await page.locator("#mobile-list").click();
    await page.locator("#demo-tab").click();
    await expect(page.locator("#map .rental-pin")).toHaveCount(0);
    await expect(popup).toHaveCount(0);
    expect(requests).toEqual([]);
  });
}

for (const [device, viewport] of [
  ["desktop", { width: 1440, height: 1000 }],
  ["short-mobile", { width: 360, height: 667 }],
] as const) {
  test(`each rental toggle reveals real clickable pins after changing the viewport on ${device}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    const base = researchFixture.metadata.rentals.rentals[0];
    const mosque = researchFixture.metadata.mosques.items[0];
    const location = {
      lat: mosque.lat + 0.003,
      lng: mosque.lng,
      precision: "approximate",
      label: "Pin uji",
      url: "https://portal.example.invalid/pin",
      method: "Peta uji",
      note: "Perkiraan portal",
      checkedAt: "2026-11-02",
    };
    await page.route("**/data/properties.geojson", (route) =>
      route.fulfill({
        json: {
          ...researchFixture,
          metadata: {
            ...researchFixture.metadata,
            rentals: {
              ...researchFixture.metadata.rentals,
              rentals: [
                {
                  ...base,
                  id: "toggle-house",
                  location,
                  nearbyMosques: [
                    { id: mosque.id, name: mosque.name, km: 0.334 },
                  ],
                },
                {
                  ...base,
                  id: "toggle-apartment",
                  rentalType: "apartemen-sewa",
                  location: { ...location, lat: -6.36, lng: 106.83 },
                  nearbyMosques: [],
                },
                {
                  ...base,
                  id: "toggle-kos",
                  rentalType: "kos-keluarga",
                  location: { ...location, lat: -6.24, lng: 106.68 },
                  nearbyMosques: [],
                },
              ],
            },
          },
        },
      }),
    );
    await page.goto("/?koleksi=sewa");
    for (const kind of ["kontrakan", "apartemen", "kos"])
      await page.locator(`[data-rental-filter="${kind}"]`).click();
    await expect(page.locator("#map .rental-pin")).toHaveCount(0);
    if (device !== "desktop") await page.locator("#mobile-map").click();
    for (const kind of ["kontrakan", "apartemen", "kos"]) {
      await setRentalLayer(page, kind, true);
      if (device !== "desktop")
        await expect(page.locator("#rental-layers")).not.toHaveAttribute(
          "open",
        );
      await expectClickableRentalPin(page, kind);
    }
    if ((await page.locator("#rental-layers").getAttribute("open")) === null)
      await page.locator("#rental-layers > summary").click();
    await page.locator("#rental-mosque-map").selectOption(mosque.id);
    await page.locator("#fit-rentals").click();
    await expectClickableRentalPin(page, "kontrakan");
    await expect(page.getByTestId("map-rental-card")).toHaveCount(1);
    await expectRenderedAttribute(page, "data-rental-distance-features", true);
    await page
      .locator('#map .rental-pin[data-rental-kind="kontrakan"]')
      .click();
    await expect(page.getByTestId("rental-popup")).toContainText(mosque.name);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`visible-rental-${device}.png`),
    });
  });
}

test("rental deep links work and unavailable rental data leaves the map usable", async ({
  page,
}) => {
  await page.goto("/?koleksi=sewa");
  await expect(page.locator("#rentals-tab")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("map-rental-card")).toHaveCount(2);
  await page.locator('[data-rental-filter="kontrakan"]').click();
  await page.locator('[data-rental-filter="apartemen"]').click();
  await expect(page.getByTestId("rental-empty")).toContainText(
    "Semua jenis sewa disembunyikan",
  );
  await page.route("**/data/properties.geojson", (route) =>
    route.fulfill({
      json: {
        ...researchFixture,
        metadata: { ...researchFixture.metadata, rentals: null },
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator("#rentals-tab")).toBeDisabled();
  await page.locator("#rental-layers > summary").click();
  for (const kind of ["kos", "kontrakan", "apartemen"])
    await expect(page.locator(`#rental-toggle-${kind}`)).toBeDisabled();
  await expect(cards(page)).toHaveCount(8);
  await expectRenderedVectors(page);
  await page.goto("/?koleksi=sewa");
  await expect(page.getByTestId("rental-empty")).toContainText(
    "Data sewa belum tersedia",
  );
});

test("shows eight explicitly illustrative homes and a visible map", async ({
  page,
}, testInfo) => {
  await expect(page.locator("#demo-tab")).toBeVisible();
  await expect(page.locator("#demo-tab")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#example-note")).toContainText(/ilustratif/i);
  await expect(cards(page)).toHaveCount(8);
  await expect(cards(page).first()).toBeVisible();
  await expect(
    mapRegion(page).locator("canvas.maplibregl-canvas"),
  ).toBeVisible();
  await expectRenderedVectors(page);
  await page.screenshot({
    path: testInfo.outputPath("explorer-desktop.png"),
    fullPage: true,
  });
});

test("keeps price pins absolutely positioned in their geographic order", async ({
  page,
}) => {
  await expectRenderedVectors(page);
  const pins = page.locator("#map .price-pin");
  await expect(pins).toHaveCount(8);
  for (const pin of await pins.all()) {
    await expect(pin).toHaveCSS("position", "absolute");
  }

  async function markerCenter(title: string) {
    const pin = page
      .locator("#map")
      .getByRole("button", { name: new RegExp(`^${title},`) });
    await expect(pin).toBeVisible();
    const bounds = await pin.boundingBox();
    if (!bounds)
      throw new Error(`The map marker has no rendered bounds: ${title}`);
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  }

  const [serpong, bintaro, bekasi, bogor, depok] = await Promise.all([
    markerCenter("Apartemen kompak di Serpong"),
    markerCenter("Rumah kompak di Bintaro"),
    markerCenter("Rumah pertama di Bekasi"),
    markerCenter("Sudut tenang di Bogor"),
    markerCenter("Ruang tumbuh di Depok"),
  ]);
  expect(serpong.x, "Serpong is west of Bintaro").toBeLessThan(bintaro.x);
  expect(bekasi.x, "Bekasi is east of Bintaro").toBeGreaterThan(bintaro.x);
  expect(bogor.y, "Bogor is south of Depok").toBeGreaterThan(depok.y);
});

test("filters the illustrative homes by Depok", async ({ page }) => {
  for (const area of ["Jakarta", "Bogor", "Depok", "Tangerang", "Bekasi"]) {
    await expect(
      page.getByRole("button", { name: area, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Depok", exact: true }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText(/Depok/i);
});

test("shows an empty state for an unmatched search", async ({ page }) => {
  await page
    .getByLabel("Cari wilayah, hunian, stasiun, atau tempat", { exact: true })
    .fill("wilayah-yang-tidak-ada-9f538f");
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByTestId("empty-state")).toBeVisible();
});

test("a five-hundred-million-rupiah budget leaves only the Serpong example", async ({
  page,
}) => {
  await page
    .getByLabel("Anggaran maksimum", { exact: true })
    .selectOption("500000000");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText(/Serpong/i);
});

test("filters by apartment type", async ({ page }) => {
  const typeSelect = page.getByLabel("Jenis hunian", { exact: true });
  await typeSelect.selectOption({ label: "Apartemen" });
  await expect(cards(page)).not.toHaveCount(0);
  expect(await cards(page).count()).toBeLessThan(8);
  for (const card of await cards(page).all()) {
    await expect(card).toContainText(/Apartemen/i);
  }
});

test("toggles actual rendered KRL station features while keeping regions visible", async ({
  page,
}) => {
  const checkbox = page.getByRole("checkbox", {
    name: "Jalur KRL",
    exact: true,
  });
  await checkbox.setChecked(true);
  await expectRenderedVectors(page);
  await checkbox.setChecked(false);
  await expect(checkbox).not.toBeChecked();
  await expect
    .poll(async () =>
      Number(await page.locator("#map").getAttribute("data-station-features")),
    )
    .toBe(0);
  await expect
    .poll(async () =>
      Number(
        (await page.locator("#map").getAttribute("data-region-features")) ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  await expect(
    mapRegion(page).locator("canvas.maplibregl-canvas"),
  ).toBeVisible();
  await checkbox.setChecked(true);
  await expect(checkbox).toBeChecked();
  await expectRenderedVectors(page);
});

test("toggles MRT, LRT, and TransJakarta independently without hiding KRL, streets, or hunian", async ({
  page,
}) => {
  const checkbox = (mode: MobilityLayer) =>
    page.getByRole("checkbox", {
      name: mobilityCheckboxNames[mode],
      exact: true,
    });
  for (const mode of ["mrt", "lrt"] as const) {
    await expect(checkbox(mode)).toBeChecked();
    await expectMobilityLayer(page, mode, true);
  }
  await expect(checkbox("tj")).not.toBeChecked();
  await expectMobilityLayer(page, "tj", false);
  await expectUnchangedMapContext(page);

  for (const mode of ["mrt", "lrt"] as const) {
    const other = mode === "mrt" ? "lrt" : "mrt";
    await checkbox(mode).setChecked(false);
    await expectMobilityLayer(page, mode, false);
    await expectMobilityLayer(page, other, true);
    await expectMobilityLayer(page, "tj", false);
    await expectUnchangedMapContext(page);

    await checkbox(mode).setChecked(true);
    await expectMobilityLayer(page, mode, true);
    await expectMobilityLayer(page, other, true);
    await expectUnchangedMapContext(page);
  }

  await checkbox("tj").setChecked(true);
  await expectMobilityLayer(page, "tj", true);
  for (const mode of ["mrt", "lrt"] as const)
    await expectMobilityLayer(page, mode, true);
  await expectUnchangedMapContext(page);

  await checkbox("tj").setChecked(false);
  await expectMobilityLayer(page, "tj", false);
  for (const mode of ["mrt", "lrt"] as const)
    await expectMobilityLayer(page, mode, true);
  await expectUnchangedMapContext(page);
});

test("searching a stop reveals its hidden MRT, LRT, or TransJakarta layer", async ({
  page,
}) => {
  for (const { mode, query, resultName } of [
    {
      mode: "mrt",
      query: "Bundaran HI",
      resultName: /MRT\s*·\s*Bundaran HI Bank Jakarta/i,
    },
    { mode: "lrt", query: "Harjamukti", resultName: /LRT\s*·\s*Harjamukti/i },
    {
      mode: "tj",
      query: "Jakarta International Stadium",
      resultName: /TransJakarta\s*·\s*Jakarta International Stadium/i,
    },
  ] as const) {
    const checkbox = page.getByRole("checkbox", {
      name: mobilityCheckboxNames[mode],
      exact: true,
    });
    await checkbox.setChecked(false);
    await expectMobilityLayer(page, mode, false);
    await page.locator("#search").fill(query);
    const result = page
      .locator("#station-results")
      .getByRole("button", { name: resultName })
      .first();
    await expect(result).toBeVisible();
    await result.click();
    await expect(checkbox).toBeChecked();
    await expectMobilityLayer(page, mode, true);
    await expect(mapRegion(page)).toBeVisible();
  }
});

test("local regions and KRL remain usable when the external basemap is unavailable", async ({
  page,
}) => {
  await page.route("**/tiles.openfreemap.org/**", async (route) => {
    blockedTileRequests.set(page, (blockedTileRequests.get(page) ?? 0) + 1);
    await route.abort("blockedbyclient");
  });
  await page.reload();
  await expect
    .poll(() => blockedTileRequests.get(page) ?? 0)
    .toBeGreaterThan(0);
  await expectRenderedVectors(page);
  await expect(page.locator("#map-status")).toHaveClass(/visible/);
  await expect(page.locator("#map-status")).toContainText(
    /Wilayah dan KRL tetap bisa dijelajahi/i,
  );
  await page.getByRole("button", { name: "Depok", exact: true }).click();
  await expect(cards(page)).toHaveCount(1);
  await expectRenderedVectors(page);
});

test("hides hunian markers and details while preserving streets, KRL, and list filters", async ({
  page,
}) => {
  await cards(page).first().click();
  await expect(page.locator("#detail-card")).toBeVisible();
  const toggle = page.getByRole("checkbox", {
    name: "Marker dan detail hunian",
    exact: true,
  });
  await toggle.setChecked(false);
  await expect(page.locator(".price-pin")).toHaveCount(0);
  await expect(page.locator("#detail-card")).toBeHidden();
  await expect
    .poll(async () =>
      Number(await page.locator("#map").getAttribute("data-road-features")),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Depok", exact: true }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(page.locator(".price-pin")).toHaveCount(0);
  await expectRenderedVectors(page);
  await cards(page).first().click();
  await expect(toggle).toBeChecked();
  await expect(page.locator(".price-pin")).toHaveCount(1);
  await expect(page.locator("#detail-card")).toBeVisible();
  await page
    .getByRole("button", { name: "Tutup detail hunian", exact: true })
    .click();
  await toggle.setChecked(false);
  await toggle.setChecked(true);
  await expect(page.locator(".price-pin")).toHaveCount(1);
  await expect(page.locator("#detail-card")).toBeHidden();
});

test("toggles actually rendered buildings independently from roads and hunian", async ({
  page,
}) => {
  await cards(page).first().click();
  await page
    .getByRole("button", { name: "Tutup detail hunian", exact: true })
    .click();
  const toggle = page.getByRole("checkbox", {
    name: "Bangunan pada peta",
    exact: true,
  });
  await expect(toggle).not.toBeChecked();
  await toggle.setChecked(true);
  await expect
    .poll(async () =>
      Number(await page.locator("#map").getAttribute("data-building-features")),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(async () =>
      Number(await page.locator("#map").getAttribute("data-road-features")),
    )
    .toBeGreaterThan(0);
  await toggle.setChecked(false);
  await expect
    .poll(async () =>
      Number(await page.locator("#map").getAttribute("data-building-features")),
    )
    .toBe(0);
  await expect
    .poll(async () =>
      Number(await page.locator("#map").getAttribute("data-road-features")),
    )
    .toBeGreaterThan(0);
  await expect(page.locator(".price-pin")).toHaveCount(8);
});

test("links the selected hunian to Google Maps location, directions, and a walking route to KRL", async ({
  page,
}) => {
  await page
    .getByTestId("listing-card")
    .filter({ hasText: "Rumah kompak di Bintaro" })
    .click();
  const detail = page.locator("#detail-card");
  const links = detail.locator("[data-map-link]");
  await expect(links).toHaveCount(3);
  for (const link of await links.all()) {
    const url = new URL((await link.getAttribute("href")) ?? "");
    expect(url.origin).toBe("https://www.google.com");
    expect(url.searchParams.get("api")).toBe("1");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  const location = new URL(
    (await detail.locator('[data-map-link="location"]').getAttribute("href")) ??
      "",
  );
  expect(location.pathname).toBe("/maps/search/");
  expect(location.searchParams.get("query")).toBe("-6.279,106.737");
  const directions = new URL(
    (await detail
      .locator('[data-map-link="directions"]')
      .getAttribute("href")) ?? "",
  );
  expect(directions.pathname).toBe("/maps/dir/");
  expect(directions.searchParams.get("destination")).toBe("-6.279,106.737");
  expect(directions.searchParams.has("origin")).toBe(false);
  const walk = new URL(
    (await detail.locator('[data-map-link="station"]').getAttribute("href")) ??
      "",
  );
  expect(walk.searchParams.get("origin")).toBe("-6.279,106.737");
  expect(walk.searchParams.get("travelmode")).toBe("walking");
  await expect(detail.locator('[data-map-link="station"]')).toContainText(
    "Pondok Ranji",
  );
  expect(walk.searchParams.get("destination")).toBe("-6.2766831,106.7446926");
  await expect(detail).toContainText("garis lurus");
  await expect(detail).toContainText("ilustrasi");
});

test("explains attribution and illustrative straight-line estimates in the source dialog", async ({
  page,
}) => {
  const sourceButton = page.getByRole("button", {
    name: "Sumber data",
    exact: true,
  });
  await sourceButton.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "Sumber & catatan data",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/OpenStreetMap/i);
  await expect(dialog).toContainText(/ilustratif/i);
  await expect(dialog).toContainText(/garis lurus/i);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(sourceButton).toBeFocused();
});

test("research tab maps sourced projects and links back to the evidence", async ({
  page,
}) => {
  await expect(page.locator("#research-count")).toHaveText("3");
  await page.locator("#research-tab").click();
  await expect(page.locator("#research-tab")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(cards(page)).toHaveCount(3);
  await expect(page.locator("#map .price-pin")).toHaveCount(3);
  await expect(page.locator("#research-note")).toBeVisible();
  await expect(page.locator("#example-note")).toBeHidden();
  await cards(page).filter({ hasText: "Hunian Uji Cisauk" }).click();
  const detail = page.locator("#detail-card");
  await expect(detail).toContainText("RISET PROPERTI");
  await expect(detail).toContainText("Rp 450 jt – Rp 620 jt");
  await expect(detail).toContainText("KRL Cisauk");
  await expect(
    detail.getByRole("link", { name: /Sumber harga/ }),
  ).toHaveAttribute("href", "https://portal.example.invalid/uji-cisauk");
  await expect(
    detail.getByRole("link", { name: /bukti lengkap/ }),
  ).toHaveAttribute("href", "/riset#prj-uji-cisauk");
  await expect(detail.locator('[data-map-link="station"]')).toHaveAttribute(
    "href",
    /destination=-6\.32444%2C106\.64163/,
  );
  await expect(
    detail.getByRole("button", { name: /Simpan ke Listingku/ }),
  ).toBeVisible();
  await expect(
    detail.getByRole("button", { name: "Simpan sebagai pin" }),
  ).toBeVisible();
  // Saving needs a real Google sign-in, which stays outside this suite.
});

test("a research deep link opens the project on the map", async ({ page }) => {
  await page.goto("/?riset=prj-uji-lebak-bulus");
  await expect(page.locator("#detail-card")).toContainText(
    "Apartemen Uji Lebak Bulus",
  );
  await expect(page.locator("#detail-card")).toContainText(
    "MRT Lebak Bulus Bank Syariah Indonesia",
  );
  await expect(page.locator("#research-tab")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("detail-population")).toHaveCount(0);
  await page.goto("/?riset=prj-uji-cisauk");
  await expect(page.getByTestId("detail-population")).toContainText(
    "±15.900 jiwa dalam 1 km",
  );
  await expect(page.getByTestId("detail-population")).toContainText(
    "bukan keramaian siang hari",
  );
  await page.goto("/?riset=prj-uji-bekasi-timur");
  await expect(page.getByTestId("detail-plus")).toContainText(
    "1 masjid dengan kajian · 1 pendidikan Islam anak",
  );
  await expect(page.getByTestId("detail-social")).toHaveAttribute(
    "href",
    "https://www.instagram.com/rumah.uji.bekasi/",
  );
});

test("anonymous Listingku offers Google sign-in without requesting private listings", async ({
  page,
}) => {
  const privateRequests: string[] = [];
  page.on("request", (request) => {
    if (/^\/api\/listings(?:\/|$)/.test(new URL(request.url()).pathname)) {
      privateRequests.push(request.method());
    }
  });
  await page.locator("#private-tab").click();
  await expect(
    page.locator("#listing-list").getByRole("button", { name: /Google/i }),
  ).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
  await expect(page.locator("#listing-export")).toBeHidden();
  expect(
    privateRequests,
    "Anonymous visitors must not fetch private listings",
  ).toEqual([]);
  // Google OAuth/popup interaction requires real credentials and is deliberately
  // outside this public, unauthenticated browser regression suite.
});

const excelListings: Listing[] = [
  {
    id: "excel-uji-1",
    title: "Rumah Uji Bekasi Mahal",
    area: "Bekasi",
    district: "Bekasi Timur",
    type: "Rumah",
    price: 700_000_000,
    bedrooms: 2,
    landArea: 70,
    lat: -6.25,
    lng: 107.01,
    notes: "=SUM(1,2)\nMasjid & sekolah",
    createdAt: "2026-10-31T00:00:00.000Z",
  },
  {
    id: "excel-uji-2",
    title: "Rumah Uji Bekasi Murah",
    area: "Bekasi",
    district: "Bekasi Timur",
    type: "Rumah",
    price: 450_000_000,
    bedrooms: 0,
    landArea: 60,
    lat: -6.24,
    lng: 107.02,
    createdAt: "2026-10-31T00:00:00.000Z",
  },
  {
    id: "excel-uji-3",
    title: "Rumah Uji Bogor",
    area: "Bogor",
    district: "Uji",
    type: "Rumah",
    price: 300_000_000,
    bedrooms: 2,
    landArea: 60,
    lat: -6.5,
    lng: 106.8,
    createdAt: "2026-10-31T00:00:00.000Z",
  },
];

test("Listingku Excel exports only the signed-in collection in active filter and sort order", async ({
  page,
}, testInfo) => {
  await mockListingAccount(page, excelListings);
  await page.goto("/?koleksi=listingku");
  await expect(page.locator("#account-label")).toContainText("Akun · Keluar");
  await expect(cards(page)).toHaveCount(3);
  await page.locator('[data-area="Bekasi"]').click();
  await page.locator("#sort").selectOption("price");
  await expect(cards(page)).toHaveCount(2);
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#listing-export").click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(
    /^listingku-\d{4}-\d{2}-\d{2}\.xlsx$/,
  );
  const path = testInfo.outputPath("listingku.xlsx");
  await download.saveAs(path);
  const workbook = readExcel(await readFile(path));
  expect(workbook.Listingku.rows.map((row) => row.ID)).toEqual([
    "excel-uji-2",
    "excel-uji-1",
  ]);
  expect(workbook.Listingku.rows[0]["Harga beli (Rp)"]).toBe(450_000_000);
  expect(workbook.Listingku.rows[1]["Catatan survei"]).toBe(
    excelListings[0].notes,
  );
  expect(workbook.Listingku.formulaCount).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#budget").selectOption("500000000");
  await expect(cards(page)).toHaveCount(1);
  const mobileEvent = page.waitForEvent("download");
  await page.locator("#listing-export").click();
  const mobilePath = testInfo.outputPath("listingku-mobile.xlsx");
  await (await mobileEvent).saveAs(mobilePath);
  expect(
    readExcel(await readFile(mobilePath)).Listingku.rows.map((row) => row.ID),
  ).toEqual(["excel-uji-2"]);
  await expectNoHorizontalOverflow(page);
  await page.locator("#search").fill("Tidak ada hunian");
  await expect(page.locator("#listing-export")).toBeDisabled();
  await page.locator("#account-button").click();
  await expect(page.locator("#listing-export")).toBeHidden();
  await page.goto("/?riset=prj-uji-cisauk");
  await expect(page.locator("#account-label")).toContainText("Akun · Keluar");
  await expect(page.locator("#detail-card")).toContainText("Hunian Uji Cisauk");
});

test("Listingku cancels a pending Excel download when the account signs out", async ({
  page,
}) => {
  await mockListingAccount(page, excelListings);
  await page.goto("/?koleksi=listingku");
  await expect(page.locator("#listing-export")).toBeEnabled();
  let resume = () => {};
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  await page.route("**/assets/universal-*.js", async (route) => {
    await gate;
    await route.continue();
  });
  const downloads: string[] = [];
  page.on("download", (download) =>
    downloads.push(download.suggestedFilename()),
  );
  try {
    await page.locator("#listing-export").click();
    await expect(page.locator("#listing-export")).toBeDisabled();
    await page.locator("#account-button").click();
    await expect(page.locator("#listing-export")).toBeHidden();
    resume();
    await expect(page.locator("#toast")).toContainText("Akun berubah");
    expect(downloads).toEqual([]);
  } finally {
    resume();
  }
});

test.describe("mobile explorer", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("keeps eight layer switches usable with hunian detail open on a phone", async ({
    page,
  }) => {
    await cards(page).first().click();
    const detail = page.locator("#detail-card");
    await expect(detail).toBeVisible();
    await expect(mapRegion(page)).toBeVisible();
    await page
      .getByRole("button", {
        name: "Tampilkan seluruh Jabodetabek",
        exact: true,
      })
      .click();
    await expect(detail).toBeVisible();
    await openMapLayers(page);
    const switches = page.getByRole("checkbox");
    await expect(switches).toHaveCount(8);
    for (const control of await switches.all())
      await expect(control).toBeVisible();
    const bounds = await Promise.all(
      (await switches.all()).map((control) =>
        control.locator("..").boundingBox(),
      ),
    );
    const rows: { top: number; count: number }[] = [];
    for (const bound of bounds) {
      expect(bound).not.toBeNull();
      if (!bound)
        throw new Error("A mobile layer switch has no layout bounds.");
      const row = rows.find(
        (candidate) => Math.abs(candidate.top - bound.y) <= 4,
      );
      if (row) row.count++;
      else rows.push({ top: bound.y, count: 1 });
    }
    expect(rows.map((row) => row.count)).toEqual([3, 3, 2]);
    await expectNoHorizontalOverflow(page);

    const expected: Record<MobilityLayer, boolean> = {
      mrt: true,
      lrt: true,
      tj: false,
    };
    for (const mode of ["mrt", "lrt", "tj"] as const)
      await expectMobilityLayer(page, mode, expected[mode]);
    for (const mode of ["mrt", "lrt", "tj"] as const) {
      const checkbox = page.getByRole("checkbox", {
        name: mobilityCheckboxNames[mode],
        exact: true,
      });
      const initial = expected[mode];
      for (const visible of [!initial, initial]) {
        await checkbox.setChecked(visible);
        expected[mode] = visible;
        for (const other of ["mrt", "lrt", "tj"] as const)
          await expectMobilityLayer(page, other, expected[other]);
        await expect(detail).toBeVisible();
        await expectUnchangedMapContext(page);
        await expectNoHorizontalOverflow(page);
      }
    }
  });

  test("offers Maps links and usable layer toggles with a hunian selected", async ({
    page,
  }, testInfo) => {
    await cards(page).first().click();
    await expect(mapRegion(page)).toBeVisible();
    const detail = page.locator("#detail-card");
    await expect(detail).toBeVisible();
    await detail
      .locator('[data-map-link="directions"]')
      .scrollIntoViewIfNeeded();
    await expect(detail.locator('[data-map-link="directions"]')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath("mobile-hunian-detail.png"),
      fullPage: true,
    });
    await openMapLayers(page);
    const toggle = page.getByRole("checkbox", {
      name: "Marker dan detail hunian",
      exact: true,
    });
    await toggle.setChecked(false);
    await expect(detail).toBeHidden();
    await expect(page.locator(".price-pin")).toHaveCount(0);
    const buildings = page.getByRole("checkbox", {
      name: "Bangunan pada peta",
      exact: true,
    });
    await buildings.setChecked(true);
    await expect
      .poll(async () =>
        Number(
          await page.locator("#map").getAttribute("data-building-features"),
        ),
      )
      .toBeGreaterThan(0);
    await expect
      .poll(async () =>
        Number(await page.locator("#map").getAttribute("data-road-features")),
      )
      .toBeGreaterThan(0);
    await expectNoHorizontalOverflow(page);
  });

  test("switches map/list without horizontal overflow and supports keyboard controls", async ({
    page,
  }, testInfo) => {
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Daftar", exact: true }).click();
    const researchMenu = await page.locator("#research-tab").boundingBox();
    expect(researchMenu).not.toBeNull();
    expect(
      (researchMenu?.x ?? 0) + (researchMenu?.width ?? 0),
    ).toBeLessThanOrEqual(390);
    await expect(cards(page)).toHaveCount(8);
    await expect(cards(page).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const mapButton = page.getByRole("button", { name: "Peta", exact: true });
    await mapButton.focus();
    await page.keyboard.press("Enter");
    await expect(mapRegion(page)).toBeVisible();
    const resetButton = page.getByRole("button", {
      name: "Tampilkan seluruh Jabodetabek",
      exact: true,
    });
    await expect(resetButton).toBeVisible();
    await resetButton.focus();
    await page.keyboard.press("Enter");
    await expect(
      mapRegion(page).locator("canvas.maplibregl-canvas"),
    ).toBeVisible();
    await expectRenderedVectors(page);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath("explorer-mobile.png"),
      fullPage: true,
    });
  });
});

test("place search focuses a geocoded place with a Google Maps link", async ({
  page,
}) => {
  await page.locator("#search").fill("taman uji");
  const result = page
    .locator("#place-results")
    .getByRole("button", { name: /Taman Uji Menteng/ });
  await expect(result).toBeVisible();
  await expect(result).toContainText("Menteng, Jakarta");
  await result.click();
  const popup = page.locator(".maplibregl-popup");
  await expect(popup).toContainText("Taman Uji Menteng");
  await expect(
    popup.getByRole("link", { name: /Google Maps/ }),
  ).toHaveAttribute("href", /query=-6\.196%2C106\.83/);
  await page.locator("#search").fill("");
  await expect(page.locator("#place-results")).toBeEmpty();
});

test("anonymous pin tab and place popup ask for Google sign-in without fetching pins", async ({
  page,
}) => {
  const pinRequests: string[] = [];
  page.on("request", (request) => {
    if (/^\/api\/pins(?:\/|$)/.test(new URL(request.url()).pathname))
      pinRequests.push(request.method());
  });
  await page.locator("#pins-tab").click();
  await expect(page.locator("#pins-tab")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.locator("#listing-list").getByRole("button", { name: /Google/i }),
  ).toBeVisible();
  await expect(page.locator("#result-count")).toHaveText("0 pin");
  await page.locator("#search").fill("taman uji");
  await page
    .locator("#place-results")
    .getByRole("button", { name: /Taman Uji Menteng/ })
    .click();
  const pinButton = page
    .locator(".maplibregl-popup")
    .getByRole("button", { name: /Simpan sebagai pin/ });
  await expect(pinButton).toBeVisible();
  // Clicking it would start the real Google popup, which stays out of this suite.
  await expect(page.locator("#add-pin")).toBeVisible();
  expect(pinRequests, "Anonymous visitors must not fetch pins").toEqual([]);
});

test("shows nearby mosques and schools from the basemap behind a toggle", async ({
  page,
}) => {
  const toggle = page.getByRole("checkbox", {
    name: "Masjid dan sekolah sekitar",
    exact: true,
  });
  await expect(toggle).not.toBeChecked();
  await expectRenderedAttribute(page, "data-community-features", false);
  await page.locator("#search").fill("taman uji");
  await page
    .locator("#place-results")
    .getByRole("button", { name: /Taman Uji Menteng/ })
    .click();
  await expectRenderedAttribute(page, "data-community-features", false);
  await toggle.setChecked(true);
  await expectRenderedAttribute(page, "data-community-features", true);
  await page.locator(".maplibregl-popup-close-button").click();
  await toggle.setChecked(false);
  await expectRenderedAttribute(page, "data-community-features", false);
  await expect
    .poll(async () =>
      Number(await page.locator("#map").getAttribute("data-road-features")),
    )
    .toBeGreaterThan(0);
  await toggle.setChecked(true);
  await expectRenderedAttribute(page, "data-community-features", true);
});

for (const [device, viewport] of [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
] as const) {
  test(`Ihrish mosque map, schedule, transit and rental links work on ${device}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.clock.setFixedTime(new Date("2026-11-02T01:00:00Z"));
    await page.route("**/data/properties.geojson", (route) =>
      route.fulfill({
        json: {
          ...researchFixture,
          metadata: {
            ...researchFixture.metadata,
            mosques: {
              ...researchFixture.metadata.mosques,
              items: researchFixture.metadata.mosques.items.map((mosque) => ({
                ...mosque,
                profile:
                  mosque.id === "masjid-uji-satu"
                    ? {
                        listedUpcoming: 1,
                        notCancelledUpcoming: 1,
                        cancelledUpcoming: 0,
                        regularNotCancelled: 0,
                        distinctDates: ["2026-11-02"],
                        firstDate: "2026-11-02",
                        lastDate: "2026-11-02",
                        events: [
                          {
                            startsAt: "2026-11-02T09:30:00+07:00",
                            timeLabel: "09.30",
                            cancelled: false,
                            regular: false,
                            topic: "fiqih",
                          },
                        ],
                      }
                    : mosque.profile,
              })),
            },
          },
        },
      }),
    );
    await page.goto("/");
    const privateRequests: string[] = [];
    page.on("request", (request) => {
      if (
        /^\/api\/(listings|pins)(?:\/|$)/.test(new URL(request.url()).pathname)
      )
        privateRequests.push(request.url());
    });
    await expect(page.locator("#kajian-toggle")).not.toBeChecked();
    await expect(page.locator("#community-toggle")).not.toBeChecked();
    if (device === "mobile") await page.locator("#mobile-map").click();
    await openMapLayers(page);
    await expectRenderedAttribute(page, "data-kajian-features", false);
    await page.locator("#kajian-toggle").check();
    await expectRenderedAttribute(page, "data-kajian-features", true);
    if (device === "mobile") await page.locator("#mobile-list").click();
    await page.locator("#search").fill("masjid uji satu");
    await page
      .locator("#mosque-results")
      .getByRole("button", { name: /Masjid Uji Satu Kajian/ })
      .click();
    const popup = page.getByTestId("mosque-popup");
    await expect(popup).toBeVisible();
    await expect(popup).toContainText("31 Okt 2026");
    await expect(popup).toContainText("2 Nov 2026");
    await expect(popup).toContainText("09.30 WIB · Fiqih");
    await expect(popup).toContainText("garis lurus");
    await expect(popup.getByRole("link", { name: /KRL ·/ })).toHaveAttribute(
      "href",
      /origin=-6\.256%2C107\.032.*travelmode=walking/,
    );
    await expect(
      popup.getByRole("link", { name: /Cek jadwal terbaru/ }),
    ).toHaveAttribute(
      "href",
      "https://ihrish.example.invalid/masjid/uji-satu/",
    );
    await expect(
      popup.getByRole("link", { name: "Kontrakan Keluarga Uji" }),
    ).toHaveAttribute("href", "/riset#rent-uji-bekasi");
    await expect(popup).toContainText("Jarak dari unit belum dihitung");
    await expectNoHorizontalOverflow(page);
    // Test clicking the actual map symbol after closing its search popup.
    await page.waitForTimeout(800);
    const popupBounds = await page
      .locator(".kajian-popup .maplibregl-popup-content")
      .boundingBox();
    expect(popupBounds).not.toBeNull();
    if (!popupBounds) throw new Error("Mosque popup missing");
    expect(popupBounds.y + popupBounds.height).toBeLessThanOrEqual(
      viewport.height - (device === "mobile" ? 52 : 0),
    );
    await page.locator(".kajian-popup .maplibregl-popup-close-button").click();
    const canvas = page.locator("canvas.maplibregl-canvas");
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) throw new Error("Map canvas missing");
    await canvas.click({
      position: { x: bounds.width / 2, y: bounds.height / 2 },
    });
    await expect(popup).toBeVisible();
    await openMapLayers(page);
    await page.locator("#kajian-toggle").uncheck();
    await expect(popup).toHaveCount(0);
    await expectRenderedAttribute(page, "data-kajian-features", false);
    await expect(page.locator("#community-toggle")).not.toBeChecked();
    await expectRenderedAttribute(page, "data-road-features", true);
    expect(privateRequests).toEqual([]);
  });
}

test("mosque deep links enable only the Ihrish layer and old datasets keep the map usable", async ({
  page,
}) => {
  await page.goto("/?masjid=masjid-uji-satu");
  await expect(page.getByTestId("mosque-popup")).toContainText(
    "Masjid Uji Satu Kajian",
  );
  await expect(page.locator("#kajian-toggle")).toBeChecked();
  await expect(page.locator("#community-toggle")).not.toBeChecked();
  await page.route("**/data/properties.geojson", (route) =>
    route.fulfill({
      json: {
        ...researchFixture,
        metadata: { ...researchFixture.metadata, mosques: null },
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator("#kajian-toggle")).toBeDisabled();
  await expect(page.locator("#kajian-toggle")).not.toBeChecked();
  await expectRenderedVectors(page);
  await expect(cards(page)).toHaveCount(8);
});

test("signing out clears private home comparisons from the mosque popup", async ({
  page,
}) => {
  const home = {
    ...excelListings[0],
    title: "Masjid Uji Satu dekat Rumah Privat Sintetis",
  };
  await mockListingAccount(page, [home]);
  await page.goto("/?koleksi=listingku");
  await expect(page.locator("#account-label")).toContainText("Akun · Keluar");
  await expect(cards(page)).toHaveCount(1);
  await cards(page).first().click();
  // This search also matches the selected synthetic home, so its comparison remains active.
  await page.locator("#search").fill("masjid uji satu");
  await page
    .locator("#mosque-results")
    .getByRole("button", { name: /Masjid Uji Satu Kajian/ })
    .click();
  const popup = page.getByTestId("mosque-popup");
  await expect(popup).toContainText(home.title);
  const route = popup.getByRole("link", { name: /Cek rute hunian/ });
  await expect(route).toHaveAttribute(
    "href",
    /origin=-6\.25%2C107\.01&destination=-6\.256%2C107\.032/,
  );
  await page.locator("#account-button").click();
  await expect(page.locator("#account-label")).toHaveText(
    "Masuk dengan Google",
  );
  await expect(popup).toHaveCount(0);
  await expect(page.locator("#detail-card")).toBeHidden();
  await expect(page.getByRole("link", { name: /Cek rute hunian/ })).toHaveCount(
    0,
  );
});

test("/ is marked noindex for search engines", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
});
