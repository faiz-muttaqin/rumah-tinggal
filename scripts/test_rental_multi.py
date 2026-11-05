"""Provider isolation, rental payment semantics, privacy and cross-site matching."""

from concurrent.futures import ThreadPoolExecutor
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("rental_multi_crawler", Path(__file__).with_name("rental_multi_crawler.py"))
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)
c = m.core


def script(identifier, value):
    return f'<script id="{identifier}">{json.dumps(value)}</script>'


def j_unit():
    return {"code": "ABCA001", "apartment_name": "Gedung Uji", "latitude": -6.29, "longitude": 106.79,
            "is_available": 1, "price_per_1_month": 0, "price_per_3_months": 9_000_000,
            "price_per_6_months": 16_000_000, "price_per_12_months": 30_000_000,
            "display_price": 2_490_000, "bedroom": 1, "unit_area": 30,
            "photos": [{"image": "https://images.example.invalid/a.jpg", "caption": "PRIVATE"}],
            "pic_unit": {"name": "PRIVATE", "phone": "081234567891"}, "address": "PRIVATE HOUSE NUMBER",
            "breadcrumb": {"district": {"name": "Cilandak"}, "area": {"name": "Jakarta Selatan"}}}


def brighton_page(function="LeaseOut", description="Harga sewa 30 juta per tahun"):
    return '<script type="application/ld+json">' + json.dumps([
        {"@type": "BreadcrumbList", "itemListElement": []},
        {"@type": "RealEstateListing", "offers": {"price": 30_000_000, "priceCurrency": "IDR",
          "businessFunction": {"@id": "https://schema.org/"+function}, "availability": "https://schema.org/InStock"},
         "description": description, "datePosted": "2026-10-01T00:00:00Z",
         "provider": {"name": "PRIVATE", "email": "private@example.invalid"},
         "mainEntity": {"@type": "SingleFamilyResidence", "address": {"addressLocality": "Jakarta Selatan", "streetAddress": "PRIVATE"},
                        "numberOfRooms": 2, "floorSize": {"value": 50}}, "image": ["https://images.example.invalid/b.jpg"]}
    ]) + '</script><a href="/ads?Latitude=-6.29&Longitude=106.79">Ad</a>'


def prime_page(amount=7_000_000, currency="IDR", duration="P1M", name="Disewakan Apartemen Uji", **changes):
    listing = {"@type": "RealEstateListing", "url": "https://jakartaprime.com/listing/disewakan-apartemen-uji",
               "name": name, "description": "PRIVATE description, contact 081234567891",
               "datePosted": "2026-11-01T08:00:00+00:00",
               "offers": {"price": amount, "priceCurrency": currency, "availability": "https://schema.org/InStock",
                          "priceSpecification": {"price": amount, "priceCurrency": currency, "billingDuration": duration}},
               "address": {"addressLocality": "Cilandak", "addressRegion": "Jakarta Selatan", "streetAddress": "PRIVATE No 123"},
               "image": ["https://images.example.invalid/unit.jpg"]}
    listing.update(changes)
    office = {"@type": "RealEstateAgent", "name": "PRIVATE", "geo": {"latitude": -6.29, "longitude": 106.79}}
    return '<script type="application/ld+json">' + json.dumps([office, listing]) + '</script>' + \
           '<dl><div><dd>Studio</dd><dt>Kamar tidur</dt></div></dl><p>± Rp 84 jt per tahun</p>'


def mami_unit():
    return {"slug": "kost-bekasi-kost-campur-murah-uji", "status": 0, "available_room": 2, "gender": 0,
            "area_city": "Kota Bekasi", "area_subdistrict": "Bekasi Selatan", "latitude": -6.29, "longitude": 106.79,
            "price_monthly": 1_000_000, "price_yearly": 10_000_000, "price_title": 100_000,
            "price_title_formats": {"price_monthly": {"currency_symbol": "Rp", "price": "1.000.000", "rent_type_unit": "bulan"},
                                    "price_yearly": {"currency_symbol": "Rp", "price": "10.000.000", "rent_type_unit": "tahun"}},
            "booking_rules": {"is_married": True, "is_bring_child": True}, "min_month": "Min. 3 Bln", "size": "3x4",
            "updated_at": "2026-11-01 08:24:58", "not_updated": False, "is_inactive_owner": False,
            "photo_url": {"large": ["https://images.example.invalid/room.jpg"]},
            "owner_name": "PRIVATE", "phone": "081234567891", "address": "PRIVATE HOUSE NUMBER",
            "description": "PRIVATE full description", "map_guide": "PRIVATE"}


def mami_page(data):
    return '<script>var detail = ' + json.dumps(data) + '; window.otherCode = "PRIVATE";</script>'


class ProviderTest(unittest.TestCase):
    def adapter(self, name):
        return m.adapters.Adapter(name, c)

    def test_jendela_uses_rendered_rentals_instead_of_initial_sale_inventory(self):
        a = self.adapter("jendela360")
        data = {"initial_units": [{"code": "SALE001", "is_sell": 1, "selling_price": 1_000_000_000}],
                "server_side_initial_units": [{"code": "ABCA001", "apartment_slug": "gedung-uji", "is_available": 1}],
                "server_side_total_units": 100}
        result = a.parse_search(script("__NEXT_DATA__", {"props": {"pageProps": {"data": data}}}), a.origin+"/apartemen/jakarta-selatan")
        self.assertEqual(len(result["cards"]), 1)
        self.assertIn("ABCA001", result["cards"][0]["url"])
        self.assertNotIn("SALE", json.dumps(result))
        self.assertEqual(result["pages"], 1)

    def test_jendela_never_converts_yearly_marketing_price_into_monthly_payment(self):
        a = self.adapter("jendela360")
        row = a.parse_detail(script("__NEXT_DATA__", {"props": {"pageProps": {"unitDetailProps": {"data": j_unit()}}}}), a.origin+"/sewa-apartemen-gedung-uji/ABCA001")
        self.assertEqual((row["amount"], row["period"], row["monthlyEquivalent"]), (30_000_000, "yearly", 2_500_000))
        self.assertEqual(row["minimumRentMonths"], 3)
        self.assertEqual(row["location"]["precision"], "building")
        self.assertIsNone(row["sourceUpdatedAt"])
        for private in ["PRIVATE", "081234567891", "2490000"]:
            self.assertNotIn(private, json.dumps(row))

    def test_jendela_monthly_option_and_currency_status_are_separate(self):
        a = self.adapter("jendela360")
        data = j_unit()
        data.update(price_per_1_month=3_500_000, is_available=0, is_dollar=1)
        row = a.parse_detail(script("__NEXT_DATA__", {"props": {"pageProps": {"unitDetailProps": {"data": data}}}}), a.origin+"/sewa-apartemen-gedung-uji/ABCA001")
        self.assertEqual((row["amount"], row["period"], row["minimumRentMonths"]), (3_500_000, "monthly", 1))
        self.assertIn("inactive-or-rented", row["issues"])
        self.assertIn("non-idr-price-needs-review", row["issues"])

    def test_brighton_does_not_take_banner_coordinates_or_guess_a_period(self):
        a = self.adapter("brighton")
        row = a.parse_detail(brighton_page(description="Rumah nyaman untuk keluarga"), a.origin+"/cari-properti/view/rumah-uji")
        self.assertIsNone(row["location"])
        self.assertIsNone(row["period"])
        self.assertIn("unknown-rent-period", row["issues"])
        self.assertNotIn("PRIVATE", json.dumps(row))
        self.assertEqual(row["sourceDateKind"], "posted")

    def test_brighton_requires_lease_and_reads_explicit_yearly_period(self):
        a = self.adapter("brighton")
        row = a.parse_detail(brighton_page(function="Sell"), a.origin+"/cari-properti/view/rumah-uji")
        self.assertIn("not-a-rental-offer", row["issues"])
        self.assertEqual(row["period"], "yearly")
        with self.assertRaises(ValueError):
            a.canonical(a.origin+"/disewa/rumah/jakarta-selatan?page=2")

    def test_brighton_accepts_single_offer_lists_and_holds_ambiguous_offers(self):
        a = self.adapter("brighton")
        url = a.origin + "/cari-properti/view/rumah-uji"
        text = brighton_page()
        start, end = text.index(">") + 1, text.index("</script>")
        nodes = json.loads(text[start:end])
        listing = nodes[1]
        original = listing["offers"]
        listing["offers"] = [original]
        page = '<script type="application/ld+json">' + json.dumps(nodes) + '</script>'
        self.assertEqual(a.parse_detail(page, url), a.parse_detail(text, url))
        for offers in [[original, {**original, "price": 40_000_000}], [None], "unknown"]:
            with self.subTest(offers=offers):
                listing["offers"] = offers
                page = '<script type="application/ld+json">' + json.dumps(nodes) + '</script>'
                with self.assertRaisesRegex(ValueError, "Brighton offer or residence"):
                    a.parse_detail(page, url)

    def test_brighton_ambiguous_offer_does_not_stop_other_details(self):
        a = self.adapter("brighton")
        source = a.origin + "/disewa/rumah/jakarta-selatan"
        urls = [a.origin + "/cari-properti/view/rumah-" + suffix for suffix in ["a", "b"]]
        text = brighton_page()
        start, end = text.index(">") + 1, text.index("</script>")
        nodes = json.loads(text[start:end])
        nodes[1]["offers"] = [nodes[1]["offers"], {"price": 40_000_000}]
        invalid = '<script type="application/ld+json">' + json.dumps(nodes) + '</script>'
        class FakeClient(c.Client):
            def __init__(self, _, adapter=None, jitter_seconds=0):
                super().__init__(0, adapter)
            def start(self):
                return {"checkedAt": c.now(), "sha256": "test"}
            def get(self, url):
                self.requests += 1
                return invalid if url == urls[0] else text
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            c.save(root / "research/rentals.json", {"rentals": []})
            output = root / "output"
            c.save(output / "state.json", {"schemaVersion": 1, "pages": {
                source: {"retrievedAtUTC": c.now(), "cards": [{"url": url} for url in urls]}
            }, "details": {}, "cursors": {}})
            config = {"radiusKm": 1.5, "delaySeconds": 2, "searchCacheHours": 4,
                      "detailCacheHours": 72, "maxSearchRequests": 1, "maxDetailRequests": 2, "maxPagesPerArea": 1}
            mosques = [{"id": "m", "name": "Mosque", "lat": -6.29, "lng": 106.79,
                        "sources": [source], "priority": {"transit": []}}]
            with patch.object(c, "ROOT", root), patch.object(c, "Client", FakeClient):
                self.assertEqual(c.run(config, mosques, output, adapter=a), 0)
            result = json.loads((output / "latest.json").read_text())
            self.assertEqual(result["run"]["detailRequests"], 2)
            rows = {r["url"]: r for r in result["results"]}
            failed, successful = rows[urls[0]], rows[urls[1]]
            self.assertIn("detail-unavailable", failed["issues"])
            self.assertEqual(successful["amount"], 30_000_000)

    def test_realoka_keeps_monthly_yearly_and_daily_separate_and_date_relative(self):
        a = self.adapter("realoka")
        page = '<h1>Disewakan Apartemen Uji</h1>'
        for amount, label in [("3.000.000", "Bulanan"), ("300.000", "Harian"), ("30.000.000", "Tahunan")]:
            page += f'<span class="detailpage-angka">{amount}</span> <span class="harian">{label}</span>'
        page += '<span class="p-f-box-head">Diperbarui</span><span class="p-f-box-info">7 bulan yang lalu</span>'
        page += '<span class="post-address2">PRIVATE No 123, Jakarta Selatan</span>'
        row = a.parse_detail(page, a.origin+"/123456-apartemen-uji")
        self.assertEqual((row["amount"], row["period"]), (3_000_000, "monthly"))
        self.assertEqual(len(row["priceOptions"]), 3)
        self.assertEqual(row["sourceUpdatedLabel"], "7 bulan yang lalu")
        self.assertIsNone(row["sourceUpdatedAt"])
        self.assertIn("no-proven-location", row["issues"])
        self.assertNotIn("PRIVATE", json.dumps(row))

    def test_all_adapter_allowlists_reject_accounts_other_sites_and_sale_routes(self):
        for name in ["realoka", "brighton", "jendela360", "jakartaprime", "mamikos"]:
            a = self.adapter(name)
            for suffix in ["/api/items", "/login", "/account", "/disewa/rumah/test?token=secret"]:
                with self.assertRaises(ValueError):
                    a.canonical(a.origin+suffix)
            with self.assertRaises(ValueError):
                a.canonical("https://evil.example.invalid/robots.txt")
            with self.assertRaises(ValueError):
                a.parse_search("<html><h1>Changed layout</h1></html>", a.origin+"/robots.txt")

    def test_prime_keeps_real_monthly_price_and_never_uses_office_geo_or_private_fields(self):
        a = self.adapter("jakartaprime")
        row = a.parse_detail(prime_page(), a.origin+"/listing/disewakan-apartemen-uji")
        self.assertEqual((row["amount"], row["period"], row["bedrooms"]), (7_000_000, "monthly", 0))
        self.assertEqual(row["sourceDateKind"], "posted")
        self.assertEqual(row["locality"], "Cilandak, Jakarta Selatan")
        self.assertIsNone(row["location"])
        self.assertNotIn("minimumRentMonths", row)
        self.assertIn("no-proven-location", row["issues"])
        for private in ["PRIVATE", "081234567891", "84000000"]:
            self.assertNotIn(private, json.dumps(row))

    def test_prime_yearly_price_stays_yearly_and_date_is_not_filled_when_unpublished(self):
        a = self.adapter("jakartaprime")
        row = a.parse_detail(prime_page(130_000_000, duration="P1Y", datePosted=None), a.origin+"/listing/disewakan-apartemen-uji")
        self.assertEqual((row["amount"], row["period"]), (130_000_000, "yearly"))
        self.assertAlmostEqual(row["monthlyEquivalent"], 130_000_000 / 12)
        self.assertIsNone(row["sourceUpdatedAt"])
        self.assertEqual(row["sourceDateKind"], "not-published")
        self.assertNotIn("minimumRentMonths", row)

    def test_prime_holds_foreign_currency_and_missing_billing_period(self):
        a = self.adapter("jakartaprime")
        row = a.parse_detail(prime_page(300_000, currency="USD"), a.origin+"/listing/disewakan-apartemen-uji")
        self.assertIsNone(row["amount"])
        self.assertIsNone(row["monthlyEquivalent"])
        self.assertIn("non-idr-price-needs-review", row["issues"])
        row = a.parse_detail(prime_page(duration=None), a.origin+"/listing/disewakan-apartemen-uji")
        self.assertIsNone(row["period"])
        self.assertIn("unknown-rent-period", row["issues"])

    def test_prime_holds_land_inactive_units_and_conflicting_primary_prices(self):
        a = self.adapter("jakartaprime")
        row = a.parse_detail(prime_page(name="Disewakan Tanah Uji"), a.origin+"/listing/disewakan-apartemen-uji")
        self.assertIn("property-kind-needs-review", row["issues"])
        offers = {"price": 7_000_000, "priceCurrency": "IDR", "availability": "https://schema.org/OutOfStock",
                  "priceSpecification": {"price": 84_000_000, "priceCurrency": "IDR", "billingDuration": "P1M"}}
        row = a.parse_detail(prime_page(offers=offers), a.origin+"/listing/disewakan-apartemen-uji")
        self.assertIsNone(row["amount"])
        self.assertIn("invalid-rent", row["issues"])
        self.assertIn("inactive-or-rented", row["issues"])

    def test_prime_validates_unit_url_and_does_not_accept_sale_or_query_routes(self):
        a = self.adapter("jakartaprime")
        with self.assertRaises(ValueError):
            a.parse_detail(prime_page(url=a.origin+"/listing/disewakan-unit-lain"), a.origin+"/listing/disewakan-apartemen-uji")
        for path in ["/listing/dijual-apartemen-uji", "/api/listings", "/sewa-rumah?page=2", "/sewa-apartemen/jakarta-utara"]:
            with self.assertRaises(ValueError):
                a.canonical(a.origin+path)

    def test_prime_search_excludes_sales_and_maps_only_supported_cities(self):
        a = self.adapter("jakartaprime")
        page = '<h1>Sewa Rumah</h1><a href="/listing/disewakan-rumah-uji">Sewa</a>' + \
               '<a href="/listing/dijual-rumah-uji">Jual</a>'
        rows = a.parse_search(page, a.origin+"/sewa-rumah")
        self.assertEqual([r["url"] for r in rows["cards"]], [a.origin+"/listing/disewakan-rumah-uji"])
        self.assertEqual(rows["pages"], 1)
        config = {"cities": ["jakarta-selatan", "jakarta-pusat"]}
        self.assertEqual(a.sources(["jawa-barat/bekasi/pondokgede"], config), [])
        self.assertEqual(a.sources(["dki-jakarta/jakarta-selatan/cilandak"], config),
                         [a.origin+"/sewa-apartemen/jakarta-selatan", a.origin+"/sewa-rumah"])

    def test_mamikos_sitemap_reads_only_room_locations_and_never_image_locations(self):
        a = self.adapter("mamikos")
        room = a.origin + "/room/" + mami_unit()["slug"]
        xml = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
        xml += f'<url><loc>{room}</loc><image:image><image:loc>https://images.example.invalid/private.jpg</image:loc></image:image></url>'
        xml += f'<url><loc>{a.origin}/api/rooms</loc></url><url><loc>https://evil.example.invalid/room/kost-uji</loc></url></urlset>'
        parsed = a.parse_search(xml, a.origin + "/sitemaps/sitemap/sitemap-room-kost-bekasi-1.xml")
        self.assertEqual(parsed["cards"], [{"url": room}])
        self.assertEqual((parsed["total"], parsed["pages"]), (1, 1))
        for invalid in ["<html>Changed</html>", "<urlset", '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>']:
            with self.assertRaises(ValueError):
                a.parse_search(invalid, a.origin + "/robots.txt")

    def test_mamikos_uses_agreeing_payment_fields_and_keeps_source_date_minimum_and_privacy(self):
        a = self.adapter("mamikos")
        row = a.parse_detail(mami_page(mami_unit()), a.origin + "/room/" + mami_unit()["slug"])
        self.assertEqual((row["amount"], row["period"], row["minimumRentMonths"]), (1_000_000, "monthly", 3))
        self.assertEqual((row["buildingAreaM2"], row["bedrooms"], row["kind"]), (12, 1, "Kos"))
        self.assertEqual(row["sourceUpdatedAt"], "2026-11-01 08:24:58")
        self.assertEqual(row["location"], {"lat": -6.29, "lng": 106.79, "precision": "approximate"})
        self.assertEqual(row["issues"], [])
        for private in ["PRIVATE", "081234567891", "owner_name", "address", "description", "map_guide"]:
            self.assertNotIn(private, json.dumps(row))

    def test_mamikos_yearly_only_is_not_monthly_and_missing_date_minimum_remain_unknown(self):
        a = self.adapter("mamikos")
        data = mami_unit()
        data.update(price_monthly=0, min_month=None, updated_at=None)
        row = a.parse_detail(mami_page(data), a.origin + "/room/" + data["slug"])
        self.assertEqual((row["amount"], row["period"]), (10_000_000, "yearly"))
        self.assertNotIn("minimumRentMonths", row)
        self.assertIsNone(row["sourceUpdatedAt"])
        self.assertEqual(row["sourceDateKind"], "not-published")

    def test_mamikos_holds_conflicting_prices_currency_and_unexplained_long_term_rates(self):
        a = self.adapter("mamikos")
        for change, issue in [({"price": "1.100.000"}, "payment-options-needs-review"),
                              ({"currency_symbol": "$"}, "non-idr-price-needs-review"),
                              ({"long_term_rate": "12 months"}, "payment-options-needs-review")]:
            data = mami_unit()
            data["price_title_formats"]["price_monthly"].update(change)
            row = a.parse_detail(mami_page(data), a.origin + "/room/" + data["slug"])
            self.assertIn(issue, row["issues"])
            self.assertEqual(c.assess(row, [{"id": "m", "name": "M", "lat": -6.29, "lng": 106.79}])["reviewStatus"], "held")

    def test_mamikos_room_capacity_and_family_rules_are_independent_of_campur(self):
        a = self.adapter("mamikos")
        for change, issue in [({"available_room": 0}, "inactive-or-rented"), ({"status": 2}, "inactive-or-rented"),
                              ({"not_updated": True}, "source-availability-needs-review"),
                              ({"is_inactive_owner": True}, "source-availability-needs-review"),
                              ({"booking_rules": {"is_married": True, "is_bring_child": False}}, "resident-policy-needs-review"),
                              ({"booking_rules": {}}, "resident-policy-needs-review"),
                              ({"gender": 1}, "resident-policy-needs-review")]:
            data = mami_unit()
            data.update(change)
            row = a.parse_detail(mami_page(data), a.origin + "/room/" + data["slug"])
            self.assertIn(issue, row["issues"])

    def test_mamikos_requires_room_identity_and_never_guesses_missing_coordinates(self):
        a = self.adapter("mamikos")
        data = mami_unit()
        url = a.origin + "/room/" + data["slug"]
        with self.assertRaises(ValueError):
            a.parse_detail(mami_page({**data, "slug": "kost-other"}), url)
        data.update(latitude=None, longitude=None)
        row = a.parse_detail(mami_page(data), url)
        self.assertIsNone(row["location"])
        self.assertIn("no-proven-location", row["issues"])
        for route in ["/kost/kost-bekasi-murah", "/api/rooms", "/room/apartemen-uji", "/room/kost-uji?token=x",
                      "/sitemaps/sitemap/sitemap-room-kost-bandung-1.xml"]:
            with self.assertRaises(ValueError):
                a.canonical(a.origin + route)

    def test_mamikos_sitemap_plan_covers_five_cities_without_claiming_district_search(self):
        a = self.adapter("mamikos")
        settings = json.loads((c.ROOT / "research/rental-crawl-providers.json").read_text())["providers"]["mamikos"]
        self.assertEqual(len(a.sources(["dki-jakarta/jakarta-selatan/cilandak"], settings)), 9)
        self.assertEqual(len(a.sources(["jawa-barat/kab-bekasi/cibitung"], settings)), 9)
        self.assertEqual(a.sources(["jawa-barat/bandung/batununggal"], settings), [])
        paths = [p for group in json.loads((c.ROOT / "research/rental-crawl-sources.json").read_text())["targets"].values() for p in group]
        self.assertEqual(len(a.sources(paths, settings)), 39)

    def test_same_building_with_different_units_is_not_a_duplicate_coordinate(self):
        rows = [{"url": f"https://example.invalid/{n}", "issues": [], "reviewStatus": "candidate", "imageHashes": [str(n)],
                 "location": {"lat": -6.29, "lng": 106.79, "precision": "building"}} for n in [1, 2]]
        c.mark_duplicates(rows)
        self.assertTrue(all(r["reviewStatus"] == "candidate" for r in rows))
        self.assertTrue(all(r["sharedBuildingReference"] for r in rows))

    def test_cross_source_syndication_is_flagged_with_both_links(self):
        rows = {f"https://example.invalid/{n}": {"url": f"https://example.invalid/{n}", "provider": name, "issues": [],
                "kind": "Rumah", "bedrooms": 2, "buildingAreaM2": 50, "monthlyEquivalent": 2_500_000,
                "location": {"lat": -6.29, "lng": 106.79}} for n, name in [(1, "pinhome"), (2, "realoka")]}
        pairs = m.cross_source_matches(rows)
        self.assertEqual(len(pairs), 1)
        self.assertTrue(all("possible-cross-source-duplicate" in r["issues"] for r in rows.values()))
        self.assertEqual(len(rows), 2)

    def test_two_providers_really_overlap_and_a_403_stops_only_its_own_client(self):
        barrier = threading.Barrier(2)
        realoka, brighton = self.adapter("realoka"), self.adapter("brighton")
        first, second = c.Client(0, realoka), c.Client(0, brighton)
        class Response:
            def __init__(self, url):
                self.url = url
            def __enter__(self):
                return self
            def __exit__(self, *_):
                return False
            def geturl(self):
                return self.url
            def read(self, _):
                return b"public page"
        class Opener:
            def open(self, request, timeout):
                barrier.wait(timeout=3)
                if "realoka" in request.full_url:
                    raise c.urllib.error.HTTPError(request.full_url, 403, "blocked", {}, None)
                return Response(request.full_url)
        with patch.object(c.urllib.request, "build_opener", return_value=Opener()):
            with ThreadPoolExecutor(max_workers=2) as pool:
                bad = pool.submit(first.get, realoka.origin+"/robots.txt")
                good = pool.submit(second.get, brighton.origin+"/robots.txt")
                with self.assertRaises(c.StopSource):
                    bad.result()
                self.assertEqual(good.result(), "public page")
        self.assertTrue(first.stopped)
        self.assertIsNone(second.stopped)

    def test_provider_lock_prevents_duplicate_jobs_in_the_same_state(self):
        entered, release = threading.Event(), threading.Event()
        def fake_run(config, mosques, path, *args):
            entered.set()
            release.wait(timeout=3)
            c.save(path/"latest.json", {"run": {"status": "complete-with-limits"}, "summary": {}})
            return 0
        with tempfile.TemporaryDirectory() as tmp, patch.object(c, "run", fake_run):
            with ThreadPoolExecutor(max_workers=2) as pool:
                first = pool.submit(m.run_one, "pinhome", None, [], {}, Path(tmp))
                self.assertTrue(entered.wait(timeout=3))
                second = pool.submit(m.run_one, "pinhome", None, [], {}, Path(tmp))
                self.assertEqual(second.result()["status"], "already-running")
                release.set()
                self.assertEqual(first.result()["exitCode"], 0)

    def test_full_search_flag_keeps_provider_budget_and_cancellation(self):
        cancel = threading.Event()
        adapter = self.adapter("realoka")
        settings = {"delaySeconds": 2, "delayJitterSeconds": 3}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            c.save(path / "latest.json", {"run": {"status": "complete-with-limits", "refreshSearch": True}, "summary": {}})
            with patch.object(c, "run", return_value=0) as run:
                result = m.run_one("realoka", adapter, [], settings, path, 30, 80, cancel, True)
                run.assert_called_once_with(settings, [], path, 30, 80, adapter, cancel, True)
            self.assertTrue(result["run"]["refreshSearch"])

    def test_cancelled_pinhome_client_does_not_make_another_request(self):
        client = c.Client()
        client.cancel = threading.Event()
        client.cancel.set()
        with patch.object(c.urllib.request, "build_opener") as opener:
            with self.assertRaises(c.StopSource):
                client.get(c.ORIGIN+"/robots.txt")
            opener.assert_not_called()

    def test_report_badges_keep_yearly_and_minimum_term_separate(self):
        badge = m.period_badges({"period": "yearly", "minimumRentMonths": 3, "monthlyEquivalent": 2_500_000})
        self.assertIn("Tahunan", badge)
        self.assertIn("Minimal 3 bulan", badge)
        self.assertNotIn("Bulanan", badge)

    def test_merge_keeps_inactive_ads_out_of_area_leads_and_preserves_provider_state(self):
        mosque = {"id": "m", "name": "Masjid Uji", "lat": -6.29, "lng": 106.79,
                  "sources": [], "priority": {"tier": 0, "fromBlokMKm": 4, "transit": []}}
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            c.save(root/"research/rentals.json", {"rentals": []})
            directory = root/"output"
            row = {"url": "https://example.invalid/a", "provider": "pinhome", "amount": 2_000_000,
                   "period": "monthly", "monthlyEquivalent": 2_000_000, "kind": "Rumah", "locality": "Jakarta Selatan",
                   "retrievedAtUTC": c.now(), "adapterVersion": c.ADAPTER_VERSION, "issues": ["inactive-or-rented", "no-proven-location"]}
            c.save(directory/"state.json", {"details": {row["url"]: row}, "pages": {}})
            other = {**row, "url": "https://example.invalid/b", "provider": "realoka", "issues": ["no-proven-location"]}
            c.save(directory/"providers/realoka/state.json", {"details": {other["url"]: other}, "pages": {}})
            held = {}
            for index, issue in enumerate(["resident-policy-needs-review", "payment-options-needs-review", "source-availability-needs-review"]):
                unit = {**other, "url": "https://mamikos.com/room/kost-uji-" + str(index), "provider": "mamikos",
                        "issues": ["no-proven-location", issue]}
                held[unit["url"]] = unit
            c.save(directory/"providers/mamikos/state.json", {"details": held, "pages": {}})
            original = (directory/"state.json").read_bytes()
            with patch.object(c, "ROOT", root):
                result = m.merge(directory, {"pinhome": (None, [mosque]), "realoka": (None, [mosque]), "mamikos": (None, [mosque])},
                                 {"detailCacheHours": 72, "searchCacheHours": 24, "radiusKm": 1.5}, [])
            self.assertEqual(result["summary"]["areaLeads"], 1)
            self.assertEqual(result["areaLeads"][0]["provider"], "realoka")
            self.assertEqual((directory/"state.json").read_bytes(), original)
            self.assertEqual(result["summary"]["candidates"], 0)

    def test_optional_curated_minimum_is_bounded_and_does_not_change_existing_data(self):
        spec = importlib.util.spec_from_file_location("builder", Path(__file__).with_name("build-properties.py"))
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)
        data = json.loads((c.ROOT/"research/rentals.json").read_text())
        data["rentals"] = data["rentals"][:1]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/"rentals.json"
            for value in [0, 121, True, "3"]:
                data["rentals"][0]["rent"]["minimumMonths"] = value
                path.write_text(json.dumps(data))
                with self.assertRaises(builder.Invalid):
                    builder.load_rentals(path)
            data["rentals"][0]["rent"]["minimumMonths"] = 3
            path.write_text(json.dumps(data))
            self.assertEqual(builder.load_rentals(path)["rentals"][0]["rent"]["minimumMonths"], 3)


if __name__ == "__main__":
    unittest.main()
