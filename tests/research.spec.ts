import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { readExcel } from "./excel-workbook.ts";
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

test("Excel downloads contain the displayed research rows and respect each section's filters", async ({
  page,
}, testInfo) => {
  const privateRequests: string[] = [];
  page.on("request", (request) => {
    if (/^\/api\/(listings|pins)(?:\/|$)/.test(new URL(request.url()).pathname))
      privateRequests.push(request.url());
  });
  await expect(page.locator("#research-export")).toBeEnabled();
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#research-export").click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(
    /^riset-properti-\d{4}-\d{2}-\d{2}\.xlsx$/,
  );
  const path = testInfo.outputPath("research.xlsx");
  await download.saveAs(path);
  const workbook = readExcel(await readFile(path));
  for (const [sheet, testId] of [
    ["Proyek Developer", "research-card"],
    ["Sewa", "rental-card"],
    ["Iklan Dijual", "sale-ad-card"],
    ["Masjid", "mosque-card"],
    ["Petunjuk", "lead-card"],
  ]) {
    expect(workbook[sheet].rows.map((row) => row.ID)).toEqual(
      await page
        .getByTestId(testId)
        .evaluateAll((elements) => elements.map((element) => element.id)),
    );
    expect(workbook[sheet].formulaCount).toBe(0);
  }

  await page.locator("#research-search").fill("Bekasi");
  await page.locator("#research-plus").selectOption("kajian");
  await page.locator("#rental-budget-max").selectOption("2000000");
  await page.locator("#sale-budget-max").selectOption("500000000");
  await page.locator("#mosque-search").fill("Bandung");
  const filteredEvent = page.waitForEvent("download");
  await page.locator("#research-export").click();
  const filteredDownload = await filteredEvent;
  const filteredPath = testInfo.outputPath("research-filtered.xlsx");
  await filteredDownload.saveAs(filteredPath);
  const filteredWorkbook = readExcel(await readFile(filteredPath));
  expect(
    filteredWorkbook["Proyek Developer"].rows.map((row) => row.ID),
  ).toEqual(["prj-uji-bekasi-timur"]);
  expect(filteredWorkbook.Sewa).toBeUndefined();
  expect(filteredWorkbook["Iklan Dijual"].rows.map((row) => row.ID)).toEqual([
    "jual-uji-kavling",
  ]);
  expect(filteredWorkbook.Masjid.rows.map((row) => row.ID)).toEqual([
    "masjid-uji-bandung",
  ]);
  expect(
    filteredWorkbook.Catatan.rows.some(
      (row) =>
        row.Nilai === "Bekasi" &&
        String(row.Keterangan).includes("Cari proyek"),
    ),
  ).toBe(true);
  expect(privateRequests).toEqual([]);
});

test("mobile Excel export follows area and offer type and handles empty results", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#catalog-area").selectOption("Bekasi");
  await page.locator("#catalog-offer").selectOption("rental-house");
  await page.locator("#research-export").scrollIntoViewIfNeeded();
  await expect(page.locator("#research-export")).toBeInViewport();
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#research-export").click();
  const path = testInfo.outputPath("rentals-mobile.xlsx");
  await (await downloadEvent).saveAs(path);
  const workbook = readExcel(await readFile(path));
  expect(Object.keys(workbook)).toEqual(["Sewa", "Masjid", "Catatan"]);
  expect(workbook.Sewa.rows.map((row) => row.ID)).toEqual(["rent-uji-bekasi"]);
  expect(workbook.Masjid.rows[0]["Proyek sekitar (km garis lurus)"]).toBeNull();
  expect(workbook.Masjid.rows[0]["Iklan dan petunjuk kawasan"]).toContain(
    "Kontrakan Keluarga Uji",
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.locator("#research-export").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("excel-mobile.png") });

  await page.locator("#catalog-area").selectOption("Jakarta");
  const downloads: string[] = [];
  page.on("download", (download) =>
    downloads.push(download.suggestedFilename()),
  );
  await page.locator("#research-export").click();
  await expect(page.locator("#toast")).toContainText(
    "Belum ada hasil untuk diekspor",
  );
  expect(downloads).toEqual([]);
  await expect(page.locator("#research-export")).toBeEnabled();
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
  await expect(first).toContainText("Halaman sumber belum dibuka langsung");
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
  await page.locator("#catalog-area").selectOption("Semua");

  const lead = page.getByTestId("lead-card");
  await expect(page.locator("#belum-diverifikasi")).toBeVisible();
  await expect(lead).toContainText("Belum terjangkau otomatis");
  await expect(lead).toContainText("Petunjuk:");
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

test("distinguishes sale, apartment and rental cards and searches rental context", async ({
  page,
}) => {
  const house = page.locator("#prj-uji-cisauk");
  const apartment = page.locator("#rent-uji-depok");
  const rental = page.locator("#rent-uji-bekasi");
  await expect(house).toContainText("Rumah dijual");
  await expect(apartment).toContainText("Apartemen sewa");
  await expect(rental).toContainText("Kontrakan");
  const borders = await Promise.all(
    [house, apartment, rental].map((card) =>
      card.evaluate((element) => getComputedStyle(element).borderLeftColor),
    ),
  );
  expect(new Set(borders).size).toBe(3);
  await page.locator("#rental-search").fill("Masjid Uji Kitab");
  await expect(page.getByTestId("rental-card")).toHaveCount(1);
  await expect(rental).toContainText("Jarak dari unit belum diketahui");
  await expect(rental).toContainText("Minimum sewa tiga bulan");
  await expect(
    rental.getByRole("link", { name: "sumber lokasi ↗" }),
  ).toHaveAttribute("href", "https://portal.example.invalid/sewa-uji");
  await page.locator("#rental-type").selectOption("apartment");
  await expect(page.getByTestId("rental-empty")).toBeVisible();
  await page.locator("#rental-search").fill("");
  await expect(page.getByTestId("rental-card")).toHaveCount(1);
  await expect(apartment).toBeVisible();
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

test("/riset is marked noindex for search engines", async ({ page }) => {
  await page.goto("/riset");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
});

test("lists sale ads near a kajian mosque with a budget range and no seller data", async ({
  page,
}) => {
  const ads = page.getByTestId("sale-ad-card");
  await expect(page.locator("#iklan-dijual")).toBeVisible();
  await expect(ads).toHaveCount(2);
  await expect(ads.first()).toContainText("Kavling Syariah Uji");
  await expect(ads.first()).toContainText("Catatan asumsi uji.");
  await expect(ads.last()).toContainText("Menurut iklan, dekat Masjid Uji");
  await expect(ads.last()).toContainText("Rp 1,65 M");
  await page.locator("#sale-budget-max").selectOption("1000000000");
  await expect(ads).toHaveCount(1);
  await page.locator("#sale-budget-min").selectOption("2000000000");
  await page.locator("#sale-budget-max").selectOption("0");
  await expect(page.getByTestId("sale-ad-empty")).toBeVisible();
});

test("lists mosques with one kajian and separates mapped projects from area leads", async ({
  page,
}) => {
  await expect(page.getByTestId("mosque-card")).toHaveCount(2);
  await expect(page.locator("#mosque-count")).toHaveText("2 dari 2 masjid");
  const mosque = page.locator("#masjid-uji-satu");
  await expect(mosque).toContainText("1 jadwal tercatat");
  await expect(page.locator("#mosques-intro")).toContainText(
    "tidak harus rutin",
  );
  await expect(
    mosque.getByRole("link", { name: "Titik Google Maps ↗" }),
  ).toHaveAttribute(
    "href",
    "https://www.google.com/maps/search/?api=1&query=-6.256%2C107.032",
  );
  await expect(
    mosque.getByRole("link", { name: "Jadwal di Ihrish ↗" }),
  ).toHaveAttribute("href", "https://ihrish.example.invalid/masjid/uji-satu/");
  await expect(
    mosque.getByRole("link", { name: "Rumah Uji Bekasi Timur" }),
  ).toHaveAttribute("href", "/?riset=prj-uji-bekasi-timur");
  await expect(mosque).toContainText("0,4 km garis lurus");
  await expect(
    mosque.getByRole("link", { name: "Kontrakan Keluarga Uji" }),
  ).toHaveAttribute("href", "/riset#rent-uji-bekasi");
  await expect(mosque).toContainText("Satu kawasan menurut iklan uji.");
  await expect(mosque).toContainText("Jarak dari unit belum dihitung.");

  const bandung = page.locator("#masjid-uji-bandung");
  await expect(bandung).toContainText("3 jadwal tercatat");
  await expect(bandung).toContainText("1 jadwal dibatalkan");
  await expect(bandung).not.toContainText("3 jadwal aktif");
  await expect(bandung).toContainText(
    "Belum ada proyek bertitik dalam radius 1,5 km di katalog",
  );
  await page.locator("#rental-budget-max").selectOption("1000000");
  await expect(page.locator("#rent-uji-bekasi")).toHaveCount(0);
  await mosque.getByRole("link", { name: "Kontrakan Keluarga Uji" }).click();
  await expect(page.locator("#rent-uji-bekasi")).toBeVisible();
  await expect(page.locator("#rent-uji-bekasi")).toHaveClass(/highlight/);
});

test("filters mosques by name, address and area without hiding one-off kajian", async ({
  page,
}) => {
  const mosques = page.getByTestId("mosque-card");
  await page.locator("#mosque-area").selectOption("Bekasi");
  await expect(mosques).toHaveCount(1);
  await expect(mosques).toContainText("Masjid Uji Satu Kajian");
  await page.locator("#mosque-search").fill("bandung");
  await expect(page.getByTestId("mosque-empty")).toBeVisible();
  await page.locator("#mosque-area").selectOption("outside");
  await expect(mosques).toHaveCount(1);
  await expect(mosques).toContainText("Masjid Uji Bandung");
  await page.locator("#mosque-area").selectOption("");
  await page.locator("#mosque-search").fill("jalan kebun");
  await expect(mosques).toHaveCount(1);
  await expect(page.locator("#mosque-count")).toHaveText("1 dari 2 masjid");
  await page.locator("#mosque-search").fill("");
  await expect(mosques).toHaveCount(2);
});

test("keeps older research datasets without mosque metadata usable", async ({
  page,
}) => {
  const legacy = { ...researchFixture.metadata, mosques: undefined };
  await page.route("**/data/properties.geojson", async (route) => {
    await route.fulfill({ json: { ...researchFixture, metadata: legacy } });
  });
  await page.reload();
  await expect(cards(page)).toHaveCount(4);
  await expect(page.locator("#masjid")).toBeHidden();
  await expect(page.locator("#mosques-shortcut")).toBeHidden();
  await expect(page.getByTestId("mosque-card")).toHaveCount(0);
});

test("shares the regional filter across catalog sections and offer types", async ({
  page,
}) => {
  const rentals = page.getByTestId("rental-card");
  const sales = page.getByTestId("sale-ad-card");
  const leads = page.getByTestId("lead-card");
  const mosques = page.getByTestId("mosque-card");
  await expect(page.locator("#catalog-area")).toHaveValue("Semua");
  await expect(page.locator("#catalog-offer")).toHaveValue("all");
  await page.locator("#catalog-area").selectOption("Bekasi");
  await expect(cards(page)).toHaveCount(1);
  await expect(rentals).toHaveCount(1);
  await expect(sales).toHaveCount(0);
  await expect(leads).toHaveCount(1);
  await expect(mosques).toHaveCount(1);
  await expect(page.locator("[data-area=Bekasi]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("[data-rental-area=Bekasi]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#mosque-area")).toHaveValue("Bekasi");

  await page.locator("#catalog-offer").selectOption("developer");
  await expect(cards(page)).toHaveCount(1);
  await expect(rentals).toHaveCount(0);
  await expect(sales).toHaveCount(0);
  await expect(leads).toHaveCount(0);
  await expect(page.locator("#sewa")).toBeHidden();
  await expect(mosques).toHaveCount(1);
  await page.locator("#catalog-area").selectOption("Bogor");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText("Perumahan Islami Uji Jauh");
  await page.locator("#catalog-offer").selectOption("all");
  await expect(sales).toHaveCount(2);
  await expect(rentals).toHaveCount(0);
  await expect(leads).toHaveCount(0);
  await expect(mosques).toHaveCount(0);

  await page.locator("#catalog-area").selectOption("Semua");
  await expect(cards(page)).toHaveCount(4);
  await expect(rentals).toHaveCount(2);
  await expect(sales).toHaveCount(2);
  await expect(leads).toHaveCount(1);
  await expect(mosques).toHaveCount(2);
  await page.locator("[data-area=Bekasi]").click();
  await expect(page.locator("#catalog-area")).toHaveValue("Bekasi");
  await page.locator("[data-rental-area=Depok]").click();
  await expect(page.locator("#catalog-area")).toHaveValue("Depok");
  await expect(page.locator("#mosque-area")).toHaveValue("Depok");
  await expect(cards(page)).toHaveCount(0);
  await expect(rentals).toHaveCount(1);
  await expect(leads).toHaveCount(0);
  await page.locator("#mosque-area").selectOption("outside");
  await expect(page.locator("#catalog-area")).toHaveValue("outside");
  await expect(rentals).toHaveCount(0);
  await expect(mosques).toHaveCount(1);
  await expect(mosques).toContainText("Masjid Uji Bandung");
  await page.locator("#mosque-area").selectOption("");
  await expect(page.locator("#catalog-area")).toHaveValue("Semua");
  await expect(cards(page)).toHaveCount(4);
});

test("house rental mode excludes family kos, apartments and sale inventory", async ({
  page,
}) => {
  const fixture = structuredClone(researchFixture);
  fixture.metadata.rentals.rentals.push({
    ...fixture.metadata.rentals.rentals[0],
    id: "rent-uji-kos-bekasi",
    title: "Kos Keluarga Uji",
    rentalType: "kos-keluarga",
  });
  await page.route("**/data/properties.geojson", async (route) => {
    await route.fulfill({ json: fixture });
  });
  await page.reload();
  await expect(page.getByTestId("rental-card")).toHaveCount(3);
  await page.locator("#catalog-area").selectOption("Bekasi");
  await expect(page.getByTestId("rental-card")).toHaveCount(2);
  await page.locator("#catalog-offer").selectOption("rental-house");
  await expect(page.getByTestId("rental-card")).toHaveCount(1);
  await expect(page.getByTestId("rental-card")).toContainText(
    "Kontrakan Keluarga Uji",
  );
  await expect(page.locator("#rent-uji-kos-bekasi")).toHaveCount(0);
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByTestId("sale-ad-card")).toHaveCount(0);
  await expect(page.getByTestId("lead-card")).toHaveCount(0);
  await expect(page.locator("#iklan-dijual")).toBeHidden();
  await page.locator("#catalog-area").selectOption("Semua");
  await expect(page.getByTestId("rental-card")).toHaveCount(1);
  await expect(page.locator("#rent-uji-depok")).toHaveCount(0);
  await page.locator("#catalog-offer").selectOption("developer");
  await expect(cards(page)).toHaveCount(4);
  await expect(page.getByTestId("rental-card")).toHaveCount(0);
  await page.locator("#catalog-offer").selectOption("all");
  await expect(page.getByTestId("rental-card")).toHaveCount(3);
  await expect(page.getByTestId("sale-ad-card")).toHaveCount(2);
});

test("filters mosque property relations with the shared catalog and restores linked rentals", async ({
  page,
}) => {
  const fixture = structuredClone(researchFixture);
  const mosqueFixture = fixture.metadata.mosques.items[0];
  mosqueFixture.nearbyProperties = [
    ...mosqueFixture.nearbyProperties,
    {
      id: "prj-uji-cisauk",
      name: "Hunian Uji Cisauk",
      km: 1.2,
    },
  ];
  mosqueFixture.relatedListings = [
    ...mosqueFixture.relatedListings,
    {
      id: "jual-uji-rumah",
      title: "Rumah Dijual Uji dekat Masjid",
      kind: "sale",
      relation: "Kawasan uji menurut iklan.",
      note: "Jarak belum dihitung.",
    },
    {
      id: "lead-uji",
      title: "Perumahan Petunjuk Uji",
      kind: "lead",
      relation: "Petunjuk proyek kawasan uji.",
      note: "Belum diverifikasi.",
    },
  ];
  await page.route("**/data/properties.geojson", async (route) => {
    await route.fulfill({ json: fixture });
  });
  await page.reload();
  const mosque = page.locator("#masjid-uji-satu");
  const project = mosque.getByRole("link", {
    name: "Rumah Uji Bekasi Timur",
  });
  const rental = mosque.getByRole("link", {
    name: "Kontrakan Keluarga Uji",
  });
  const otherAreaProject = mosque.getByRole("link", {
    name: "Hunian Uji Cisauk",
  });
  const sale = mosque.getByRole("link", {
    name: "Rumah Dijual Uji dekat Masjid",
  });
  const lead = mosque.getByRole("link", {
    name: "Perumahan Petunjuk Uji",
  });
  await expect(otherAreaProject).toHaveCount(1);
  await expect(sale).toHaveCount(1);
  await page.locator("#catalog-area").selectOption("Bekasi");
  await expect(project).toHaveCount(1);
  await expect(rental).toHaveCount(1);
  await expect(otherAreaProject).toHaveCount(0);
  await expect(sale).toHaveCount(0);
  await page.locator("#catalog-offer").selectOption("rental-house");
  await expect(project).toHaveCount(0);
  await expect(rental).toHaveCount(1);
  await expect(lead).toHaveCount(0);
  await page.locator("#catalog-offer").selectOption("developer");
  await expect(project).toHaveCount(1);
  await expect(rental).toHaveCount(0);
  await expect(lead).toHaveCount(0);
  await page.locator("#catalog-offer").selectOption("all");
  await page.locator("#catalog-area").selectOption("Semua");
  await expect(otherAreaProject).toHaveCount(1);
  await expect(sale).toHaveCount(1);
  await expect(lead).toHaveCount(1);
  await page.locator("#rental-budget-max").selectOption("1000000");
  await expect(page.locator("#rent-uji-bekasi")).toHaveCount(0);
  await rental.click();
  await expect(page.locator("#rent-uji-bekasi")).toBeVisible();
  await expect(page.locator("#rent-uji-bekasi")).toHaveClass(/highlight/);
});
