"""Offline checks for the catchment, official flood and rental research snapshots."""
import datetime as dt
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f"scripts/{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


geo = module("all_station_catchments")
screen = module("flood_rental_screening")
curate = module("corridor_priority_curate")


def research(name):
    return json.loads((ROOT / f"research/{name}.json").read_text())


class GeometryTest(unittest.TestCase):
    def test_polygon_holes_and_multipolygon(self):
        outer = [[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1], [0, 0]]
        hole = [[0.02, 0.02], [0.04, 0.02], [0.04, 0.04], [0.02, 0.04], [0.02, 0.02]]
        self.assertEqual(geo.polygon_distance((0.01, 0.01), [[outer, hole]]), 0)
        self.assertGreater(geo.polygon_distance((0.03, 0.03), [[outer, hole]]), 1000)
        self.assertEqual(geo.polygon_distance((0, 0.04), [[outer]]), 0)
        elsewhere = [[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]
        parts = geo.polygon_parts({"type": "MultiPolygon", "coordinates": [[outer, hole], [elsewhere]]})
        self.assertEqual(geo.polygon_distance((1.5, 1.5), parts), 0)
        self.assertGreater(geo.polygon_distance((0.13, 0.05), parts), 3000)

    def test_catalog_distance_uses_radius_before_counting(self):
        station = {"coordinate": [106.8, -6.2]}
        points = [([106.8, -6.2], "kos"), ([106.8, -6.23], "rumah")]
        self.assertEqual(geo.coverage(station, points)["3000"], {"rumah": 0, "kos": 1, "apartemen": 0})


class PriorityCurationTest(unittest.TestCase):
    def test_price_location_and_family_policy_are_fail_closed(self):
        area = {"name": "Tenjo", "district": "Tenjo"}
        row = {"status": "detail-read", "provider": "pinhome", "kind": "Rumah", "url": "https://www.pinhome.id/disewa/rumah-sekunder/unit/contoh",
               "sourceStatus": "unit_type_status.active", "issues": [], "amount": 60_000_000,
               "period": "yearly", "monthlyEquivalent": 5_000_000,
               "location": {"precision": "approximate"}, "nearbyGapTransit": [{"km": 3}],
               "locality": "Tenjo, Tenjo, Kab Bogor", "sourceUpdatedAt": "2026-10-01",
               "bedrooms": 2, "buildingAreaM2": 36}
        day = dt.date(2026, 11, 26)
        self.assertEqual(curate.resolution(row, area, day), "candidate")
        self.assertEqual(curate.resolution({**row, "amount": 60_000_001}, area, day), "outside-budget")
        self.assertEqual(curate.resolution({**row, "nearbyGapTransit": []}, area, day), "outside-gap-or-no-pin")
        self.assertEqual(curate.resolution({**row, "nearbyGapTransit": [], "eligibleTaskTransit": [{"km": 2.9}]}, area, day), "candidate")
        self.assertEqual(curate.resolution({**row, "usageSignals": {"roomOrCommercialNeedsReview": True}}, area, day), "hold-room-or-house-use")
        self.assertEqual(curate.resolution({**row, "locality": "Daru, Jambe, Tangerang"}, area, day), "hold-locality-mismatch")
        self.assertEqual(curate.resolution({**row, "sourceUpdatedAt": "2024-01-01"}, area, day), "hold-source-date")
        kos = {**row, "provider": "mamikos", "residentGender": "campur",
               "residentPolicy": {"marriedCouplesAllowed": True, "childrenAllowed": None}}
        self.assertEqual(curate.resolution(kos, area, day), "hold-resident-policy")
        self.assertEqual(curate.resolution({**kos, "residentPolicy": {"marriedCouplesAllowed": True, "childrenAllowed": True}}, area, day), "candidate")


    def test_pinhome_usage_flags_without_retaining_description(self):
        raw = {"title": "Kos putri", "description": "Sewa per kamar, deposit dan IPL. Nomor contoh."}
        body = '<script id="__UNIT_DETAIL__">' + json.dumps(raw) + '</script>'
        result = curate.priority.pinhome_usage(body, "https://www.pinhome.id/disewa/rumah-sekunder/unit/kost-putri")
        self.assertTrue(result["roomOrCommercialNeedsReview"])
        self.assertIn("per kamar", result["terms"])
        self.assertEqual(result["feeTerms"], ["deposit", "ipl"])
        self.assertNotIn("Nomor contoh", json.dumps(result))
        raw = {"title": "Rumah sewa keluarga", "description": "Dapur, dekat jalan raya."}
        result = curate.priority.pinhome_usage('<script id="__UNIT_DETAIL__">' + json.dumps(raw) + '</script>', "https://www.pinhome.id/disewa/rumah-sekunder/unit/rumah-sewa")
        self.assertFalse(result["roomOrCommercialNeedsReview"])


class SnapshotTest(unittest.TestCase):
    def test_inventory_and_queue(self):
        data = research("koridor-all-3km-2026-11-26")
        queue = research("koridor-all-3km-queue-2026-11-26")["tasks"]
        self.assertEqual({s["stopId"] for s in data["stations"]}, {s["stopId"] for s in geo.stops()})
        self.assertEqual(len(data["stations"]), len({s["stopId"] for s in data["stations"]}))
        self.assertEqual(len(data["areas"]), len({a["code"] for a in data["areas"].values()}))
        for station in data["stations"]:
            self.assertTrue(any(a["containsStop"] for a in station["areas"]))
            for area in station["areas"]:
                self.assertIn(area["areaId"], data["areas"])
                self.assertLessEqual(area["distanceToBoundaryMeters"], 3000)
        self.assertEqual(queue, geo.make_queue(data))
        self.assertEqual(len(queue), len(data["areas"]) * 3)
        self.assertEqual(len({t["taskId"] for t in queue}), len(queue))

    def test_p0_batch_outcomes_and_exact_radius(self):
        data = research("koridor-p0-batch-01-results-2026-11-26")
        source = research("koridor-p0-batch-01-seeds-2026-11-26")
        queue = {r["taskId"]: r for r in research("koridor-all-3km-queue-2026-11-26")["tasks"]}
        inventory = research("koridor-all-3km-2026-11-26")
        stops = {s["stopId"]: s for s in inventory["stations"]}
        rentals = {r["id"]: r for r in research("rentals")["rentals"]}
        locs = {r["rentalId"]: r["location"] for r in research("rental-locations")["items"]}
        screening = {r["rentalId"]: r for r in research("flood-rental-screening-2026-11-26")["items"]}
        task_ids = {q["taskId"] for b in source["batches"] for q in b["queries"]}
        self.assertEqual(task_ids, {r["taskId"] for r in data["tasks"]})
        self.assertEqual(len(task_ids), 30)
        self.assertTrue(all(queue[t]["priority"] == 0 for t in task_ids))
        self.assertEqual(data["taskCounts"]["completed"], 0)
        gap_ids = {s["stopId"] for s in inventory["stations"] if not sum(s["existingPinnedCounts"]["3000"].values())}
        self.assertEqual(gap_ids, {g["stopId"] for g in data["gapCoverage"]})
        rows = [r for g in data["runs"] for r in g["results"]]
        imported = [r for r in rows if r["resolution"] == "imported-partial"]
        self.assertEqual(len(imported), data["catalogAfter"] - data["catalogBefore"])
        self.assertEqual(len(imported), sum(data["importedByCategory"].values()))
        self.assertEqual(len(imported), len({r["rentalId"] for r in imported}))
        self.assertEqual(len(rows), sum(data["summary"].values()))
        self.assertEqual(data["taskCounts"]["attempted"], len(task_ids))
        self.assertEqual(sum(t["imported"] for t in data["tasks"]),
                         sum(r["matchedTaskId"] in task_ids for r in imported))
        for r in imported:
            rid = r["rentalId"]
            self.assertEqual(rentals[rid]["listingUrl"], r["url"])
            self.assertEqual(rentals[rid]["verdict"], "partial")
            self.assertEqual(r["sourceStatus"], "unit_type_status.active")
            self.assertLessEqual(r["monthlyEquivalent"], 5_000_000)
            self.assertTrue(r["nearbyGapTransit"])
            self.assertEqual(screening[rid]["locality"]["code"], r["bigLocality"]["code"])
            self.assertEqual(screening[rid]["hazardStatus"], "unknown")
            loc = locs[rid]
            for near in r["nearbyGapTransit"]:
                sid = near["stopId"]
                self.assertIn(sid, gap_ids)
                self.assertLessEqual(geo.haversine([loc["lng"], loc["lat"]], stops[sid]["coordinate"]), 3000)
            if r["provider"] == "mamikos":
                self.assertTrue(r["residentPolicy"]["marriedCouplesAllowed"])
                self.assertTrue(r["residentPolicy"]["childrenAllowed"])
                self.assertEqual(rentals[rid]["rentalType"], "kos-keluarga")
        additions = [([locs[r["rentalId"]]["lng"], locs[r["rentalId"]]["lat"]], curate.category(r)) for r in imported]
        for g in data["gapCoverage"]:
            added = geo.coverage(stops[g["stopId"]], additions)
            for radius, counts in g["before"].items():
                self.assertEqual(g["after"][radius], {k: n + added[radius][k] for k, n in counts.items()})
        self.assertEqual(data["gapCountAfter"], sum(not sum(g["after"]["3000"].values()) for g in data["gapCoverage"]))
        self.assertLess(data["gapCountAfter"], data["gapCountBefore"])

    def test_p0_batch_02_carryover_documents_and_coverage(self):
        data = research("koridor-p0-batch-02-results-2026-11-26")
        prior = research("koridor-p0-batch-01-results-2026-11-26")
        source = research("koridor-p0-batch-02-seeds-2026-11-26")
        inventory = research("koridor-all-3km-2026-11-26")
        stations = {s["stopId"]: s for s in inventory["stations"]}
        rentals = {r["id"]: r for r in research("rentals")["rentals"]}
        locations = {r["rentalId"]: r["location"] for r in research("rental-locations")["items"]}
        screening = {r["rentalId"]: r for r in research("flood-rental-screening-2026-11-26")["items"]}
        tasks = {r["taskId"]: r for r in data["tasks"]}
        rows = [r for run in data["runs"] for r in run["results"]]
        by_url = {r["url"]: r for r in rows}
        self.assertEqual(len(rows), len(by_url))
        self.assertEqual(len(rows), sum(data["summary"].values()))
        self.assertEqual(len(tasks), 30)
        self.assertEqual(set(tasks), {q["taskId"] for b in source["batches"] for q in b["queries"]})
        self.assertEqual(data["catalogBefore"], prior["catalogAfter"])
        self.assertEqual({r["url"] for r in data["carryover"]},
                         {r["url"] for g in prior["runs"] for r in g["results"] if r["status"] == "pending"})
        self.assertEqual({r["url"] for r in data["documentLeadOutcomes"]}, {r["url"] for r in source["documentLeads"]})
        for r in data["carryover"] + data["documentLeadOutcomes"]:
            self.assertEqual(r["status"], by_url[r["url"]]["status"])
            self.assertEqual(r["resolution"], by_url[r["url"]]["resolution"])
        imported = [r for r in rows if r["resolution"] == "imported-partial"]
        self.assertEqual(len(imported), data["catalogAfter"] - data["catalogBefore"])
        self.assertEqual(len(imported), len({r["rentalId"] for r in imported}))
        self.assertEqual(len(imported), sum(data["importedByCategory"].values()))
        self.assertEqual(sum(t["imported"] for t in tasks.values()), sum(r["matchedTaskId"] in tasks for r in imported))
        for r in imported:
            rid = r["rentalId"]
            self.assertEqual(rentals[rid]["listingUrl"], r["url"])
            self.assertEqual(rentals[rid]["verdict"], "partial")
            self.assertEqual(r["sourceStatus"], "unit_type_status.active")
            self.assertEqual(r["issues"], [])
            self.assertLessEqual(r["monthlyEquivalent"], 5_000_000)
            self.assertEqual(screening[rid]["hazardStatus"], "unknown")
            self.assertEqual(screening[rid]["locality"]["code"], r["bigLocality"]["code"])
            if r["provider"] == "pinhome":
                self.assertFalse(r["usageSignals"]["roomOrCommercialNeedsReview"])
            if r["provider"] == "mamikos":
                self.assertEqual(r["residentGender"], "campur")
                self.assertTrue(r["residentPolicy"]["marriedCouplesAllowed"])
                self.assertTrue(r["residentPolicy"]["childrenAllowed"])
            if not r.get("nearbyGapTransit"):
                self.assertTrue(r["matchedTaskId"] in tasks or r.get("documentedLead"))
            nearest = r.get("nearbyGapTransit") or r.get("eligibleTaskTransit")
            self.assertTrue(nearest)
            loc = locations[rid]
            for near in nearest:
                self.assertLessEqual(geo.haversine([loc["lng"], loc["lat"]], stations[near["stopId"]]["coordinate"]), 3000)
        self.assertEqual(data["gapCountBefore"], prior["gapCountAfter"])
        for gap in data["gapCoverage"]:
            self.assertEqual(gap["before"], next(g["after"] for g in prior["gapCoverage"] if g["stopId"] == gap["stopId"]))
        self.assertEqual(data["gapCountAfter"], sum(not sum(g["after"]["3000"].values()) for g in data["gapCoverage"]))
        self.assertEqual(len(stations), sum(m["points"] for m in data["coverageByMode"].values()))
        self.assertEqual(data["gapCountAfter"], sum(m["withoutBudgetPinAfter"] for m in data["coverageByMode"].values()))
        self.assertEqual(data["taskCounts"]["completed"], 0)

    def test_evidence_screening_and_import(self):
        evidence = research("flood-official-evidence-2026-11-26")
        screening = research("flood-rental-screening-2026-11-26")
        results = research("koridor-pilot-results-2026-11-26")
        rentals = {r["id"]: r for r in research("rentals")["rentals"]}
        locations = {r["rentalId"]: r["location"] for r in research("rental-locations")["items"]}
        self.assertEqual(set(locations), set(rentals))
        # This is a dated checkpoint; future additional rentals need not be present.
        ids = {r["rentalId"] for r in screening["items"]}
        self.assertTrue(ids <= set(rentals))
        self.assertEqual(len(ids), screening["summary"]["rentals"])
        points = {p["id"]: p for p in evidence["points"]}
        reports = {p["id"]: p for p in evidence["reports"]}
        self.assertEqual(len(points), len(evidence["points"]))
        self.assertEqual(len(reports), len(evidence["reports"]))
        self.assertFalse(points.keys() & reports.keys())
        for report in reports.values():
            self.assertNotIn("lat", report)
            self.assertNotIn("lng", report)
            self.assertTrue(report["sources"])
        for row in screening["items"]:
            self.assertEqual(row["hazardStatus"], "unknown")
            self.assertTrue(set(row.get("sameLocalityReportIds", [])) <= reports.keys())
            if row["locationStatus"] == "pinned":
                self.assertIn(row["nearestOfficialEvent"]["id"], points)
                for event in row["eventsWithin1km"]:
                    self.assertIn(event["id"], points)
                    self.assertLessEqual(event["distanceMeters"], 1000)
        for run in results["runs"]:
            for row in run["results"]:
                if row["resolution"] == "imported-partial":
                    self.assertIn(row["rentalId"], rentals)
                    self.assertEqual(row["url"], rentals[row["rentalId"]]["listingUrl"])
                    self.assertLessEqual(row["monthlyEquivalent"], 5000000)
                    self.assertTrue(row["nearbyTransit"])
                    self.assertLessEqual(row["nearbyTransit"][0]["km"], 3)
                    self.assertEqual(row["sourceStatus"], "unit_type_status.active")
                    self.assertIsNotNone(locations[row["rentalId"]])


if __name__ == "__main__":
    unittest.main()
