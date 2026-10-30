import { expect, type Page, test } from "@playwright/test";
import { researchFixture } from "./research-fixture.ts";

const pageErrors = new WeakMap<Page, string[]>();

function cards(page: Page) {
  return page.getByTestId("research-card");
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/data/properties.geojson", async (route) => {
    await route.fulfill({ json: researchFixture });
  });
  await page.goto("/riset");
});

test.afterEach(async ({ page }) => {
  expect(
    pageErrors.get(page) ?? [],
    "Unhandled browser JavaScript errors",
  ).toEqual([]);
});

test("lists sourced projects with prices, evidence and computed distances", async ({
  page,
}) => {
  await expect(cards(page)).toHaveCount(3);
  await expect(page.locator("#research-count")).toHaveText("3 proyek");
  await expect(page.locator("#research-stats")).toContainText("30 Okt 2026");
  const first = cards(page).first();
  await expect(first).toContainText("Hunian Uji Cisauk");
  await expect(first).toContainText("Rp 450 jt – Rp 620 jt");
  await expect(first).toContainText("0,8 km");
  await expect(first).toContainText("Terverifikasi");
  await expect(
    first.getByRole("link", { name: /sumber harga/ }),
  ).toHaveAttribute("href", "https://portal.example.invalid/uji-cisauk");
  await expect(
    first.getByRole("link", { name: /Lihat di peta/ }),
  ).toHaveAttribute("href", "/?riset=prj-uji-cisauk");
  await expect(
    first.getByRole("button", { name: /Simpan ke Listingku/ }),
  ).toBeVisible();
  await expect(
    first.getByRole("button", { name: "Simpan sebagai pin" }),
  ).toBeVisible();
  await expect(page.locator(".research-hero")).toContainText(
    "kepemilikan unit belum diverifikasi",
  );
  await first.getByText(/Bukti & sumber/).click();
  await expect(first).toContainText(
    "Tautan dari hasil pencarian, isi belum dibuka",
  );
  await first.getByText(/Tipe unit dari sumber/).click();
  await expect(first.locator("table")).toContainText("Tipe uji 36/60");
});

test("filters by mode, straight-line distance, evidence and text", async ({
  page,
}) => {
  await page.locator("#research-mode").selectOption("MRT");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText("Apartemen Uji Lebak Bulus");
  await page.locator("#research-mode").selectOption("");
  await page.locator("#research-distance").selectOption("1");
  await expect(cards(page)).toHaveCount(2);
  await page.locator("#research-verdict").selectOption("confirmed");
  await expect(cards(page)).toHaveCount(1);
  await page.locator("#research-verdict").selectOption("");
  await page.locator("#research-distance").selectOption("3");
  await page.locator("#research-search").fill("jatimulya");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText("Rumah Uji Bekasi Timur");
  await page.locator("#research-search").fill("tidak ada proyek");
  await expect(page.getByTestId("research-empty")).toBeVisible();
  await page.locator("#research-search").fill("");
  await page.getByRole("button", { name: "Bekasi", exact: true }).click();
  await expect(cards(page)).toHaveCount(1);
});

test("documents reusable methods and coverage gaps", async ({ page }) => {
  await expect(page.locator("#method-list")).toContainText("Metode uji portal");
  await expect(page.locator("#method-list")).toContainText(
    "Langkah uji pertama",
  );
  await expect(page.locator("#coverage")).toContainText("Koridor uji");
  await expect(page.locator("#coverage")).toContainText("Celah cakupan uji.");
  await page.getByText(/Ditemukan tetapi belum masuk daftar \(1\)/).click();
  await expect(page.locator("#coverage")).toContainText("Proyek Uji Jauh");
});

test("a hash link highlights the project", async ({ page }) => {
  await page.goto("/riset#prj-uji-bekasi-timur");
  await expect(page.locator("#prj-uji-bekasi-timur")).toHaveClass(/highlight/);
});

test.describe("mobile research page", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("fits a phone and keeps a way back to the map", async ({ page }) => {
    await expect(cards(page)).toHaveCount(3);
    await expect(
      page.getByRole("link", { name: /Kembali ke peta/ }),
    ).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  });
});
