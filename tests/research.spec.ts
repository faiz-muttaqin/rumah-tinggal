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
  await expect(cards(page)).toHaveCount(4);
  await expect(page.locator("#research-count")).toHaveText("4 proyek");
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
  const population = first.getByTestId("research-population");
  await expect(population).toContainText("±15.900 jiwa dalam 1 km");
  await expect(population).toContainText("±4.200 dalam 500 m");
  await expect(population).toContainText("estimasi Penerbit Uji 2025");
  await expect(population).toContainText("bukan sensus atau keramaian");
  await expect(
    population.getByRole("link", { name: /CC BY 4.0/ }),
  ).toHaveAttribute("href", "https://raster.example.invalid/uji");
  await expect(
    cards(page).nth(1).getByTestId("research-population"),
  ).toHaveCount(0);
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
  await page.locator("[data-area=Bekasi]").click();
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
  await expect(page.locator("#coverage")).toContainText("Rp 650 jt");
  await expect(
    page.locator("#coverage").getByRole("link", { name: "sumber harga ↗" }),
  ).toHaveAttribute("href", "https://portal.example.invalid/uji-jauh");
  await expect(
    page
      .locator("#coverage")
      .getByRole("link", { name: "Instagram (belum diverifikasi) ↗" }),
  ).toHaveAttribute("href", "https://www.instagram.com/proyek.uji.jauh/");
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
    await expect(cards(page)).toHaveCount(4);
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

test("shows planned stations, extension plans and poin plus with sources", async ({
  page,
}) => {
  const bekasi = page.locator("#prj-uji-bekasi-timur");
  await expect(bekasi.locator(".research-stations li.planned")).toContainText(
    "Stasiun Rencana Uji",
  );
  await expect(bekasi.locator(".research-stations li.planned")).toContainText(
    "Dalam pembangunan",
  );
  await page.locator("#research-station-scope").selectOption("planned");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText("Rumah Uji Bekasi Timur");
  await page.locator("#research-station-scope").selectOption("operating");
  await expect(cards(page)).toHaveCount(3);
  await page.locator("#research-station-scope").selectOption("all");

  const plan = page.getByTestId("planned-line");
  await expect(page.locator("#rencana")).toBeVisible();
  await expect(plan).toContainText("LRT Uji Perpanjangan");
  await expect(plan).toContainText("Target uji 2028 menurut operator");
  await expect(
    plan.getByRole("link", { name: /Operator Uji/ }),
  ).toHaveAttribute("href", "https://operator.example.invalid/rencana");

  const plus = bekasi.getByTestId("research-plus");
  await expect(plus).toContainText("Masjid Uji");
  await expect(plus).toContainText("Kajian rutin Ahad pagi");
  await expect(plus).toContainText("TPQ Uji");
  await expect(plus).toContainText("SPP Rp 150.000/bulan (2026/2027)");
  await expect(plus).toContainText("Masjid di dalam kawasan (uji)");
  await expect(
    page.locator("#prj-uji-cisauk").getByTestId("research-plus"),
  ).toHaveCount(0);
  await expect(plus).toContainText("Konsep islami (klaim pemasaran)");
  await expect(plus).toContainText("tidak diverifikasi");
  await expect(plus.getByRole("link", { name: "Instagram ↗" })).toHaveAttribute(
    "href",
    "https://www.instagram.com/masjid.uji/",
  );
  const social = bekasi.getByTestId("research-social");
  await expect(social).toContainText("isi belum dibuka otomatis");
  await expect(
    social.getByRole("link", { name: "Instagram ↗" }),
  ).toHaveAttribute("href", "https://www.instagram.com/rumah.uji.bekasi/");
  for (const option of ["kajian", "education", "both", "concept"]) {
    await page.locator("#research-plus").selectOption(option);
    await expect(cards(page)).toHaveCount(1);
  }
  await page.locator("#research-plus").selectOption("");
  await expect(cards(page)).toHaveCount(4);
});

test("lists Islamic projects far from stations or without a verified point", async ({
  page,
}) => {
  const far = page.locator("#prj-uji-islami-jauh");
  await expect(far.getByTestId("research-islamic-basis")).toContainText(
    "Dicantumkan karena fasilitas atau konsep islami",
  );
  await expect(far.getByTestId("research-islamic-basis")).toContainText(
    "belum terverifikasi",
  );
  await expect(far.getByTestId("research-plus")).toContainText(
    "Masjid di tengah kawasan (uji)",
  );
  await expect(far).toContainText("Lokasi belum dipetakan");
  await page.locator("#research-distance").selectOption("3");
  await expect(far).toHaveCount(0);
  await page.locator("#research-distance").selectOption("any");
  await page.locator("#research-mode").selectOption("KRL");
  await expect(far).toHaveCount(0);
});

test("shows Muslim-family rentals and unverified Instagram leads with links", async ({
  page,
}) => {
  const rentals = page.getByTestId("rental-card");
  await expect(page.locator("#sewa")).toBeVisible();
  await expect(rentals).toHaveCount(2);
  await expect(rentals.first()).toContainText("Rp 2.500.000/bulan");
  await expect(rentals.first()).toContainText(
    "Lingkungan keluarga muslim (uji)",
  );
  await expect(rentals.first()).toContainText("lokasi sampai tingkat kawasan");
  await page.locator("[data-rental-area=Depok]").click();
  await expect(rentals).toHaveCount(1);
  await expect(rentals.first()).toContainText("Apartemen Sewa Uji");

  const lead = page.getByTestId("lead-card");
  await expect(page.locator("#belum-diverifikasi")).toBeVisible();
  await expect(lead).toContainText("Belum terjangkau otomatis");
  await expect(lead).toContainText("Menurut daftar pengguna");
  await expect(
    lead.getByRole("link", { name: "Instagram @petunjuk.uji ↗" }),
  ).toHaveAttribute("href", "https://www.instagram.com/petunjuk.uji/");
  await expect(
    lead.getByRole("link", { name: /Rumah Uji Bekasi Timur/ }),
  ).toHaveAttribute("href", "#prj-uji-bekasi-timur");
  await expect(lead.getByTestId("contact-link")).toHaveAttribute(
    "href",
    "https://bio.example.invalid/petunjuk-uji",
  );
  const contact = page
    .locator("#prj-uji-bekasi-timur")
    .getByTestId("contact-link");
  await expect(contact).toContainText("Kontak (belum diverifikasi)");
  await expect(contact).toHaveAttribute(
    "href",
    "https://developer.example.invalid/prj-uji-bekasi-timur/kontak",
  );
  await expect(page.locator("body")).not.toContainText(/wa\.me|\+62\s?8/);
});

test("budget is a range that matches any price inside it, for projects and rentals", async ({
  page,
}) => {
  await page.locator("#research-budget-min").selectOption("500000000");
  await page.locator("#research-budget-max").selectOption("750000000");
  await expect(cards(page)).toHaveCount(2);
  await expect(page.locator("#prj-uji-cisauk")).toBeVisible();
  await expect(page.locator("#prj-uji-islami-jauh")).toBeVisible();
  await page.locator("#research-budget-min").selectOption("1000000000");
  await page.locator("#research-budget-max").selectOption("0");
  await expect(cards(page)).toHaveCount(1);
  await expect(page.locator("#prj-uji-lebak-bulus")).toBeVisible();

  const rentals = page.getByTestId("rental-card");
  await page.locator("#rental-budget-max").selectOption("3000000");
  await expect(rentals).toHaveCount(1);
  await expect(rentals.first()).toContainText("Kontrakan Keluarga Uji");
  await page.locator("#rental-budget-min").selectOption("5000000");
  await page.locator("#rental-budget-max").selectOption("0");
  await expect(page.getByTestId("rental-empty")).toBeVisible();
});
