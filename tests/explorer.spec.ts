import { expect, type Page, test } from "@playwright/test";
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
  expect(
    privateRequests,
    "Anonymous visitors must not fetch private listings",
  ).toEqual([]);
  // Google OAuth/popup interaction requires real credentials and is deliberately
  // outside this public, unauthenticated browser regression suite.
});

test.describe("mobile explorer", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("keeps seven layer switches usable with hunian detail open on a phone", async ({
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
    const switches = page.getByRole("checkbox");
    await expect(switches).toHaveCount(7);
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
    expect(rows.map((row) => row.count)).toEqual([3, 3, 1]);
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
  await expect(toggle).toBeChecked();
  await expectRenderedAttribute(page, "data-community-features", false);
  await page.locator("#search").fill("taman uji");
  await page
    .locator("#place-results")
    .getByRole("button", { name: /Taman Uji Menteng/ })
    .click();
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
