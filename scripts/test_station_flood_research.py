"""Offline checks for the catchment, official flood and rental research snapshots."""
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
