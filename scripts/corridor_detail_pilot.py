"""Recheck a bounded list of public detail URLs using the existing compliant adapters.

Offline by default. --run is explicit. Raw HTML, contacts and exact street fields
are never committed. A failed/blocked provider stops without bypass or retry.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import datetime as dt
import importlib.util
import json
from pathlib import Path
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("rental_multi_crawler", ROOT / "scripts/rental_multi_crawler.py")
multi = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(multi)
core = multi.core


def provider(url):
    return {"www.pinhome.id": "pinhome", "mamikos.com": "mamikos", "jendela360.com": "jendela360",
            "www.rukita.co": "rukita"}.get(urllib.parse.urlsplit(url).netloc)


def canonical(url):
    name = provider(url)
    if name == "jendela360":
        prefix, unit = url.rsplit("/", 1)
        url = prefix + "/" + unit.upper()
    if name == "pinhome":
        url = core.canonical(url)
        if "/unit/" not in url:
            raise ValueError("Not a detail page")
    elif name:
        adapter = multi.adapters.Adapter(name, core)
        url = adapter.canonical(url)
        if not adapter.is_detail(url):
            raise ValueError("Not a detail page")
    else:
        raise ValueError("Unsupported provider")
    return url


def run_provider(name, seeds, stops, max_details, live):
    adapter = None if name == "pinhome" else multi.adapters.Adapter(name, core)
    client = core.Client(delay_seconds=2, adapter=adapter, jitter_seconds=0.5)
    rows = []
    robots = None
    stopped = None
    for i, seed in enumerate(seeds):
        row = {**seed, "provider": name, "status": "pending"}
        if live and i < max_details and not stopped:
            try:
                if robots is None:
                    robots = client.start()
                body = client.get(seed["url"])
                detail = adapter.parse_detail(body, seed["url"]) if adapter else core.parse_detail(body, seed["url"])
                keys = ("kind", "amount", "period", "monthlyEquivalent", "sourceUpdatedAt",
                        "sourceStatus", "minimumRentMonths", "locality", "location", "bedrooms",
                        "buildingAreaM2", "landAreaM2", "issues", "priceOptions", "residentPolicy",
                        "residentGender", "buildingName", "sourceDateKind")
                row.update({k: detail[k] for k in keys if k in detail})
                row.update(status="detail-read", sha256=core.digest(body), checkedAt=dt.datetime.now(
                    dt.timezone(dt.timedelta(hours=7))).date().isoformat())
                loc = row.get("location")
                if loc:
                    near = sorted((core.km((loc["lat"], loc["lng"]), (s["lat"], s["lng"])),
                                   s["id"], s["name"], s["mode"]) for s in stops)
                    row["nearbyTransit"] = [{"stopId": sid, "station": station, "mode": mode, "km": round(km, 3)}
                                            for km, sid, station, mode in near[:4] if km <= 3]
                row["availability"] = "not-confirmed-with-advertiser"
            except core.StopSource as ex:
                stopped = str(ex)
                row.update(status="blocked", reason=stopped)
            except (ValueError, OSError, KeyError, TypeError) as ex:
                row.update(status="error", reason=type(ex).__name__)
        rows.append(row)
        if row["status"] != "pending":
            print(name, i+1, row["status"], flush=True)
    return {"provider": name, "robots": robots, "stopped": stopped,
            "requests": client.requests, "results": rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("seeds", type=Path)
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--max-details", type=int, default=20)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not 1 <= args.max_details <= 100:
        parser.error("max-details must be between 1 and 100")
    source = json.loads(args.seeds.read_text())
    seen = set()
    existing = {core.catalog_url(r["listingUrl"]).lower() for r in json.loads(
        (ROOT / "research/rentals.json").read_text())["rentals"]}
    groups = {}
    skipped = []
    for seed in source["seeds"]:
        try:
            url = canonical(seed["url"])
        except ValueError:
            skipped.append({**seed, "reason": "unsupported-detail-url"})
            continue
        key = core.catalog_url(url).lower()
        if key in seen or key in existing:
            skipped.append({**seed, "reason": "already-catalogued-or-duplicate-url"})
            continue
        seen.add(key)
        groups.setdefault(provider(url), []).append({**seed, "url": url})
    stops = core.load_transit_stops()
    with ThreadPoolExecutor(max_workers=3) as pool:
        runs = list(pool.map(lambda pair: run_provider(pair[0], pair[1], stops, args.max_details, args.run),
                             sorted(groups.items())))
    core.save(args.output, {"schemaVersion": 1, "mode": "live" if args.run else "plan",
                           "note": "Public detail evidence only. No availability guarantee; 3 km to OSM stop, not a route. Review payment, policies and potential duplicates before import.",
                           "runs": runs, "skipped": skipped})


if __name__ == "__main__":
    main()
