"""Offline regressions for acquisition boundaries and candidate quality."""

import datetime as dt
import html
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("rental_crawler", Path(__file__).with_name("rental_crawler.py"))
c = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(c)

SOURCE = c.ORIGIN + "/sewa/rumah/dki-jakarta/jakarta-selatan/cilandak"
UNIT = c.ORIGIN + "/disewa/rumah-sekunder/unit/disewakan-rumah-uji"
MOSQUES = [{"id": "m", "name": "Masjid Uji", "lat": -6.28, "lng": 106.79,
            "sources": [SOURCE], "priority": {"tier": 0, "fromBlokMKm": 4, "transit": []}}]


def script(identifier, value):
    return f'<script type="application/json" id="{identifier}">{json.dumps(value)}</script>'


def search_page(url=UNIT, total=1, page=1):
    props = {"propertyData": [0, {
        "href": [0, url], "buildingType": [0, "building_type.house"],
        "priceText": [0, "Rp 24 Juta/Tahun"], "lastModifiedAt": [0, "2026-10-25T00:00:00Z"],
        "listingType": [0, "property_listing_type.rent"], "isRented": [0, False],
        "agentsData": [99, "DO NOT DECODE OR STORE CONTACT"],
    }]}
    return (script("__SEARCH_RESULT_PAGINATION__", {"currentPage": page, "total": total, "pageSize": 1})
            + script("__DATA_FILTER_VALUE__", {"listingType": "property_listing_type.rent", "locationWithParents": {"slug": "cilandak"}})
            + f'<astro-island props="{html.escape(json.dumps(props), quote=True)}"></astro-island>')


def unit_data():
    return {"price": 24_000_000, "rentPeriod": "rent_period_type.yearly",
            "status": "unit_type_status.active", "lastModifiedAt": "2026-10-25T00:00:00Z",
            "name": "Private name 081234567891", "description": "Hunian keluarga",
            "location": {"coordinate": "(-6.281,106.79)", "address": "private house number",
                         "district": {"name": "Cilandak", "coordinate": "(-6.3,106.8)"},
                         "city": {"name": "Jakarta Selatan", "coordinate": "(-6.3,106.9)"}},
            "specifications": [{"localeKey": "specifications.total_bedroom", "value": "2"}],
            "photos": [{"url": "https://images.example.invalid/unit-a/photo.jpg", "category": "test"}],
            "agent": {"email": "private@example.invalid", "phone": "081234567891"}}


def detail(data=None):
    return c.parse_detail(script("__UNIT_DETAIL__", data or unit_data()), UNIT)


class CrawlerTest(unittest.TestCase):
    def test_search_extracts_links_and_pagination_without_advertiser(self):
        parsed = c.parse_search(search_page(total=3), SOURCE)
        self.assertEqual(parsed["pages"], 3)
        self.assertEqual(parsed["cards"][0]["url"], UNIT)
        self.assertNotIn("CONTACT", json.dumps(parsed))
        self.assertEqual(c.astro_value([0]), None)

    def test_village_search_rejects_recommendations_and_unlocated_fallback_links(self):
        text = search_page().replace('"slug": "cilandak"', '"slug": "cilandak", "id": 123, "level": 4')
        # Astro attributes are HTML escaped; only the selected card's village id is read.
        text = text.replace('&quot;buildingType&quot;', '&quot;subDistrictID&quot;: [0, 123], &quot;buildingType&quot;')
        text += '<a href="'+UNIT+'-recommendation">Other area</a>'
        result = c.parse_search(text, SOURCE)
        self.assertEqual([r['url'] for r in result['cards']], [UNIT])
        self.assertEqual(result['cards'][0]['focusArea'], {'id': 123, 'slug': 'cilandak'})
        with self.assertRaises(ValueError):
            c.parse_search(text.replace('[0, 123]', '[0, 456]'), SOURCE)

    def test_focus_screens_before_detail_and_known_distant_point_wins_over_matching_words(self):
        cards = [{'url': UNIT+'-kranji'}, {'url': UNIT+'-other'}, {'url': UNIT+'-kranji-far'},
                 {'url': UNIT+'-village', 'focusArea': {'slug': 'cilandak', 'id': 123}}]
        state = {'pages': {SOURCE: {'retrievedAtUTC': c.now(), 'cards': cards}},
                 'details': {UNIT+'-kranji-far': {'location': {'lat': -6.8, 'lng': 106.8}}}}
        mosque = {**MOSQUES[0], 'focusTerms': ['Kranji']}
        queues, stats = c.focused_queues(state, [mosque], {'radiusKm': 1.5, 'searchCacheHours': 4, 'detailCacheHours': 72})
        self.assertEqual(set(queues[0]), {UNIT+'-kranji', UNIT+'-village'})
        self.assertEqual(stats[0]['eligible'], 2)

    def test_focus_budget_rotates_mosques_across_runs_and_never_changes_catalogue(self):
        urls = [UNIT+'-'+str(i) for i in range(8)]
        cards = [{'url': u, 'focusArea': {'slug': 'cilandak', 'id': 123}} for u in urls]
        class FakeClient(c.Client):
            def __init__(self, *args, **kwargs):super().__init__(0)
            def start(self):return {'checkedAt': c.now()}
            def get(self, url):
                self.requests += 1
                return script('__UNIT_DETAIL__', unit_data())
        mosques = [{**MOSQUES[0], 'id': 'm'+str(i)} for i in range(3)]
        config = {'focusEnabled': True, 'maxDetailsPerMosque': 2, 'radiusKm': 1.5, 'delaySeconds': 2,
                  'searchCacheHours': 4, 'detailCacheHours': 72, 'maxSearchRequests': 1,
                  'maxDetailRequests': 1, 'maxPagesPerArea': 1}
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp);c.save(root/'research/rentals.json', {'rentals': []})
            directory=root/'output';c.save(directory/'state.json', {'schemaVersion': 1, 'pages': {SOURCE: {'retrievedAtUTC': c.now(), 'cards': cards, 'focusedSearch': True}}, 'details': {}, 'cursors': {}})
            with patch.object(c, 'ROOT', root), patch.object(c, 'Client', FakeClient):
                fetched=[]
                for _ in range(3):
                    self.assertEqual(c.run(config, mosques, directory), 0)
                    result=json.loads((directory/'latest.json').read_text())
                    fetched.append(next(m['id'] for m in result['run']['focus']['mosques'] if m['fetched']))
                self.assertEqual(fetched, ['m0', 'm1', 'm2'])
                config['maxDetailRequests']=8
                self.assertEqual(c.run(config, mosques, directory), 0)
                result=json.loads((directory/'latest.json').read_text())
                counts=[m['fetched'] for m in result['run']['focus']['mosques']]
                self.assertTrue(all(n<=2 for n in counts))
                self.assertTrue(all(n>0 for n in counts))
                self.assertEqual(json.loads((root/'research/rentals.json').read_text()), {'rentals': []})

    def test_ambiguous_public_route_uses_verified_village_id_before_requesting_details(self):
        source = SOURCE + '/cilandak'
        text = search_page().replace('"slug": "cilandak"', '"slug": "cilandak", "level": 3, "id": 999')
        text = text.replace('&quot;buildingType&quot;', '&quot;subDistrictID&quot;: [0, 123], &quot;buildingType&quot;')
        text += '<a href="'+UNIT+'-unrelated">Unrelated</a>'
        calls=[]
        class FakeClient(c.Client):
            def __init__(self, *args, **kwargs):super().__init__(0)
            def start(self):return {'checkedAt': c.now()}
            def get(self, url):
                calls.append(url);self.requests+=1
                return text if url==source else script('__UNIT_DETAIL__', unit_data())
        config={'focusEnabled':True,'focusAreas':{'m':{'areaIds':{'dki-jakarta/jakarta-selatan/cilandak/cilandak':123}}},
                'maxDetailsPerMosque':2,'radiusKm':1.5,'delaySeconds':2,'searchCacheHours':4,
                'detailCacheHours':72,'maxSearchRequests':10,'maxDetailRequests':10,'maxPagesPerArea':20}
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);c.save(root/'research/rentals.json',{'rentals':[]})
            with patch.object(c,'ROOT',root),patch.object(c,'Client',FakeClient):
                self.assertEqual(c.run(config,[{**MOSQUES[0],'sources':[source]}],root/'output'),0)
            self.assertEqual(calls,[source,UNIT])
            state=json.loads((root/'output/state.json').read_text())
            self.assertEqual(state['pages'][source]['pages'],1)
            self.assertEqual(state['pages'][source]['cards'][0]['focusArea']['id'],123)

    def test_structure_loss_is_error_not_zero_results(self):
        for page in ("<html>No data</html>", search_page().replace("__SEARCH_RESULT_PAGINATION__", "changed")):
            with self.assertRaises(ValueError):
                c.parse_search(page, SOURCE)
        with self.assertRaises(ValueError):
            c.parse_search(search_page(page=2), SOURCE)

    def test_rental_and_geography_validation(self):
        for page in (search_page().replace("property_listing_type.rent", "property_listing_type.sale"),
                     search_page().replace('"slug": "cilandak"', '"slug": "cinere"')):
            with self.assertRaises(ValueError):
                c.parse_search(page, SOURCE)

    def test_yearly_price_does_not_become_monthly_payment(self):
        row = detail()
        self.assertEqual((row["amount"], row["period"], row["monthlyEquivalent"]), (24_000_000, "yearly", 2_000_000))
        self.assertEqual(row["sourceUpdatedAt"], "2026-10-25T00:00:00Z")
        self.assertEqual(row["availability"], "not-confirmed-with-advertiser")
        self.assertEqual(c.monthly_hint({"priceLabel": "Rp 1,5 Juta/Bulan"}), 1_500_000)
        self.assertEqual(c.monthly_hint({"priceLabel": "Rp 24 Juta/Tahun"}), 2_000_000)

    def test_centroid_inactive_unknown_period_are_held(self):
        data = unit_data()
        data["location"]["district"]["coordinate"] = data["location"]["coordinate"]
        data["status"] = "unit_type_status.rented"
        data["rentPeriod"] = "unknown"
        row = c.assess(detail(data), MOSQUES)
        self.assertIsNone(row["location"])
        self.assertIn("administrative-default-rejected", row["issues"])
        self.assertIn("inactive-or-rented", row["issues"])
        self.assertIn("unknown-rent-period", row["issues"])
        self.assertEqual(row["reviewStatus"], "held")

    def test_no_contacts_or_private_address_in_selected_facts(self):
        row = detail()
        serialized = json.dumps(row)
        for forbidden in ("private@example", "081234567891", "Private name", "private house number"):
            self.assertNotIn(forbidden, serialized)
        self.assertEqual(row["locality"], "Cilandak, Jakarta Selatan")
        self.assertNotIn("images.example", serialized)
        self.assertEqual(len(row["imageHashes"]), 1)

    def test_finite_coordinates_and_raw_radius_boundary(self):
        self.assertIsNone(c.point("(nan,106.8)"))
        row = detail()
        row["location"] = {"lat": MOSQUES[0]["lat"] + 1.5004 / 6371 * 180 / c.math.pi, "lng": MOSQUES[0]["lng"]}
        self.assertEqual(c.assess(row, MOSQUES)["nearbyMosques"], [])
        row["location"]["lat"] = MOSQUES[0]["lat"] + 1.4999 / 6371 * 180 / c.math.pi
        self.assertEqual(len(c.assess(row, MOSQUES)["nearbyMosques"]), 1)

    def test_duplicates_share_reference_without_being_auto_promoted(self):
        a, b = c.assess(detail(), MOSQUES), c.assess(detail(), MOSQUES)
        b["url"] = UNIT + "-other"
        c.mark_duplicates([a, b])
        self.assertEqual(a["reviewStatus"], "held")
        self.assertIn("shared-point-needs-review", a["issues"])
        self.assertIn("possible-duplicate-photo", b["issues"])

    def test_url_scope_and_redirect_guard(self):
        invalid = ["http://www.pinhome.id/sewa/rumah/jakarta", "https://evil.invalid/", "https://www.pinhome.id/api/test/",
                   "https://www.pinhome.id/dijual/rumah-sekunder/unit/test", SOURCE + "?keyword=abc", SOURCE + "#test",
                   "https://www.pinhome.id:443/sewa/rumah/jakarta", UNIT + "?page=2"]
        for url in invalid:
            with self.assertRaises(ValueError, msg=url):
                c.canonical(url)
        guard = c.RedirectGuard(lambda _: True)
        with self.assertRaises(ValueError):
            guard.redirect_request(None, None, 302, "", {}, "https://evil.invalid/")

    def test_robots_longest_rule_specific_agent_and_queries(self):
        robots = c.Robots("User-agent: *\nDisallow: /api/\nDisallow: /*/*.json*\nDisallow: /sewa/*?keyword=\nAllow: /sewa/rumah/\n")
        self.assertTrue(robots.allowed(SOURCE))
        self.assertFalse(robots.allowed(c.ORIGIN + "/api/x"))
        self.assertFalse(robots.allowed(c.ORIGIN + "/a/data.json?x=1"))
        specific = c.Robots("User-agent: *\nDisallow: /\nUser-agent: RumahTinggalResearch\nAllow: /\nCrawl-delay: 5\n")
        self.assertTrue(specific.allowed(SOURCE))
        self.assertEqual(specific.delay, 5)

    def test_auth_and_rate_limit_stop_without_retry(self):
        for status in (401, 403, 429):
            client = c.Client(delay_seconds=0)
            error = c.urllib.error.HTTPError(UNIT, status, "private body", {}, None)
            with patch.object(c.urllib.request, "build_opener") as opener:
                opener.return_value.open.side_effect = error
                with self.assertRaises(c.StopSource):
                    client.get(UNIT)
                with self.assertRaises(c.StopSource):
                    client.get(UNIT)
                self.assertEqual(opener.return_value.open.call_count, 1)

    def test_random_intervals_respect_robots_and_record_actual_pacing(self):
        clock = [100.0]
        waits = []
        def sleep(seconds):
            waits.append(seconds)
            clock[0] += seconds
        client = c.Client(2, jitter_seconds=3)
        client.robots = c.Robots("User-agent: *\nAllow: /\nCrawl-delay: 7\n")
        with patch.object(c.time, "monotonic", side_effect=lambda: clock[0]), \
                patch.object(c.time, "sleep", side_effect=sleep), \
                patch.object(c.random, "uniform", side_effect=[0, 2, 0.5]), \
                patch.object(c.urllib.request, "build_opener") as opener:
            response = opener.return_value.open.return_value.__enter__.return_value
            response.geturl.return_value = UNIT
            response.read.return_value = b"<html>Public page</html>"
            for _ in range(3):
                client.get(UNIT)
            self.assertEqual(waits, [9, 7.5])
            self.assertEqual(client.requests, 3)
            self.assertEqual(client.pacing()["observedIntervalSeconds"], {"count": 2, "min": 7.5, "max": 9, "mean": 8.25})
            self.assertEqual(client.pacing()["targetSeconds"]["min"], 7.5)

    def test_cancellation_during_pacing_never_makes_another_request(self):
        client = c.Client(2, jitter_seconds=3)
        client.last_request = c.time.monotonic()
        client.cancel = threading.Event()
        def cancelled_wait(_):
            client.cancel.set()
            return True
        with patch.object(client.cancel, "wait", side_effect=cancelled_wait), \
                patch.object(c.urllib.request, "build_opener") as opener:
            with self.assertRaisesRegex(c.StopSource, "operator-or-time-limit"):
                client.get(UNIT)
            opener.assert_not_called()
            self.assertEqual(client.requests, 0)

    def test_delay_config_rejects_nonfinite_and_out_of_range_jitter(self):
        config = json.loads((c.ROOT / "research/rental-crawl-sources.json").read_text())
        c.validate_config(config)
        legacy = {k: v for k, v in config.items() if k != "delayJitterSeconds"}
        c.validate_config(legacy)
        for value in [-1, 31, True, "3", float("nan"), float("inf")]:
            with self.assertRaises(ValueError):
                c.validate_config({**config, "delayJitterSeconds": value})

    def test_transit_then_south_jakarta_then_outward(self):
        m = MOSQUES[0]
        stops = [{"mode": "MRT", "name": "Test", "lat": m["lat"], "lng": m["lng"]}]
        south = c.priority(m, stops, ["dki-jakarta/jakarta-selatan/cilandak"])
        outer = c.priority(m, stops, ["jawa-barat/depok/cinere"])
        self.assertEqual((south["tier"], outer["tier"]), (0, 1))
        self.assertEqual(c.priority(m, [], ["dki-jakarta/jakarta-selatan/cilandak"])["tier"], 2)

    def test_checked_in_plan_covers_all_78_and_both_kinds(self):
        config = json.loads((c.ROOT / "research/rental-crawl-sources.json").read_text())
        rows = c.plan(config)
        self.assertEqual(len(rows), 78)
        self.assertEqual(rows[0]["id"], "masjid-nurul-iman-blok-m")
        self.assertTrue(all(any("/rumah/" in s for s in r["sources"]) and any("/apartemen/" in s for s in r["sources"]) for r in rows))
        self.assertTrue(rows[0]["priority"]["southJakarta"])

    def test_resume_cache_pagination_budget_and_no_catalog_mutation(self):
        calls = []
        class FakeClient(c.Client):
            def __init__(self, _, adapter=None, jitter_seconds=0):
                super().__init__(0)
            def start(self):
                return {"checkedAt": c.now(), "sha256": "test"}
            def get(self, url):
                calls.append(url)
                self.requests += 1
                if "/unit/" in url:
                    return script("__UNIT_DETAIL__", unit_data())
                return search_page(total=3, page=int(url.split("page=")[-1]) if "?page=" in url else 1)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            catalog = root / "research/rentals.json"
            c.save(catalog, {"rentals": []})
            before = catalog.read_bytes()
            config = {"radiusKm": 1.5, "delaySeconds": 1, "searchCacheHours": 24,
                      "detailCacheHours": 72, "maxSearchRequests": 1, "maxDetailRequests": 2, "maxPagesPerArea": 20}
            with patch.object(c, "ROOT", root), patch.object(c, "Client", FakeClient):
                self.assertEqual(c.run(config, MOSQUES, root / "output"), 0)
                self.assertEqual(c.run(config, MOSQUES, root / "output"), 0)
                self.assertEqual(calls, [SOURCE, UNIT, SOURCE + "?page=2"])
                result = json.loads((root / "output/latest.json").read_text())
                self.assertEqual(result["summary"]["newCandidates"], 1)
                self.assertEqual(result["run"]["coverage"]["pendingDetailUrls"], 0)
                self.assertEqual(result["run"]["coverage"]["coveredMosques"], 1)
                self.assertEqual(c.run(config, MOSQUES, root / "output", refresh_search=True), 0)
                self.assertEqual(calls, [SOURCE, UNIT, SOURCE + "?page=2", SOURCE])
                result = json.loads((root / "output/latest.json").read_text())
                self.assertTrue(result["run"]["refreshSearch"])
                self.assertEqual(result["run"]["detailRequests"], 0)
                self.assertEqual(catalog.read_bytes(), before)
                self.assertEqual((root / "output/state.json").stat().st_mode & 0o777, 0o600)

    def test_cache_does_not_claim_future_or_failed_retrieval_is_fresh(self):
        self.assertTrue(c.fresh({"retrievedAtUTC": c.now()}, 24))
        self.assertFalse(c.fresh({"retrievedAtUTC": c.now(), "error": "http-404"}, 24))
        self.assertFalse(c.fresh({"retrievedAtUTC": (dt.datetime.now(c.UTC) + dt.timedelta(hours=2)).isoformat()}, 24))
        self.assertFalse(c.detail_fresh({"retrievedAtUTC": c.now(), "adapterVersion": 1}, 72))

    def test_unseen_details_advance_before_old_cheapest_ads(self):
        cards = [{"url": UNIT, "priceLabel": "Rp 12 Juta/Tahun"},
                 {"url": UNIT + "-new", "priceLabel": "Rp 24 Juta/Tahun"},
                 {"url": UNIT + "-fresh", "priceLabel": "Rp 6 Juta/Tahun"}]
        details = {UNIT: {"retrievedAtUTC": "2025-01-01T00:00:00+00:00", "adapterVersion": c.ADAPTER_VERSION},
                   UNIT + "-fresh": {"retrievedAtUTC": c.now(), "adapterVersion": c.ADAPTER_VERSION}}
        self.assertEqual(c.detail_queue(cards, details, 72), [UNIT + "-new", UNIT])

    def test_robots_failure_saves_failed_status_and_never_fetches_ads(self):
        class FailedClient(c.Client):
            def __init__(self, _, adapter=None, jitter_seconds=0):
                super().__init__(0)
                self.requests = 1
            def start(self):
                raise ValueError("http-500")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            c.save(root / "research/rentals.json", {"rentals": []})
            config = {"radiusKm": 1.5, "delaySeconds": 1, "searchCacheHours": 24, "detailCacheHours": 72}
            with patch.object(c, "ROOT", root), patch.object(c, "Client", FailedClient):
                self.assertEqual(c.run(config, MOSQUES, root / "output"), 2)
                result = json.loads((root / "output/latest.json").read_text())
                self.assertEqual(result["run"]["status"], "failed")
                self.assertEqual(result["summary"]["details"], 0)

    def test_pending_counts_deduplicate_urls_exclude_stale_pages_and_show_uncovered_points(self):
        current = {"retrievedAtUTC": c.now(), "cards": [{"url": UNIT}, {"url": UNIT + "-new"}, {"url": UNIT + "-rented", "rented": True}]}
        state = {"pages": {SOURCE: current, SOURCE + "?page=2": current,
                            SOURCE + "?page=3": {"retrievedAtUTC": "2020-01-01T00:00:00Z", "cards": [{"url": UNIT + "-stale"}]}},
                 "details": {UNIT: {"retrievedAtUTC": c.now(), "adapterVersion": c.ADAPTER_VERSION}}}
        mosques = MOSQUES + [{"id": "unmapped", "sources": []}, {"id": "missing", "sources": [SOURCE + "-missing"]}]
        coverage = c.run_coverage(state, mosques, {"searchCacheHours": 4, "detailCacheHours": 72}, 150, 240)
        self.assertEqual((coverage["plannedSources"], coverage["freshSources"]), (2, 1))
        self.assertEqual((coverage["configuredMosques"], coverage["coveredMosques"]), (2, 1))
        self.assertEqual((coverage["discoveredUrls"], coverage["pendingDetailUrls"], coverage["unseenPendingUrls"]), (2, 1, 1))


if __name__ == "__main__":
    unittest.main()
