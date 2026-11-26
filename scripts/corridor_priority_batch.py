"""Bounded priority-corridor search/detail pass; public URLs only, no auto-import."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import datetime as dt
import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("pilot", ROOT / "scripts/corridor_detail_pilot.py")
pilot = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(pilot)
core, multi = pilot.core, pilot.multi
FIELDS = ("kind", "amount", "period", "monthlyEquivalent", "sourceUpdatedAt",
          "sourceStatus", "minimumRentMonths", "locality", "location", "bedrooms",
          "buildingAreaM2", "landAreaM2", "issues", "priceOptions", "residentPolicy",
          "residentGender", "buildingName", "sourceDateKind")


def pinhome_usage(body, url):
    """Keep only broad use flags; never retain descriptions or private contact fields."""
    raw = core.script_json(body, "__UNIT_DETAIL__")
    title = str(raw.get("title") or "")
    desc = str(raw.get("description") or "")
    slug = url.rsplit("/", 1)[-1].replace("-", " ")
    title_terms = re.findall(r"\b(?:kos(?:t|[- ]?kosan)?|kost[- ]?kostan|ruko|gudang|kantor|toko|harian)\b", title + " " + slug, re.I)
    explicit = re.findall(r"\b(?:kos\s+khusus|kost\s+khusus|khusus\s+(?:putra|putri|pria|wanita)|per\s+kamar|per\s+orang|kamar\s+mandi\s+bersama|sewa\s+harian)\b", desc, re.I)
    fees = sorted(set(m.group(0).lower() for m in re.finditer(r"\b(?:deposit|ipl|maintenance|service\s*charge)\b", desc, re.I)))
    return {"roomOrCommercialNeedsReview": bool(title_terms or explicit), "terms": sorted(set(v.lower() for v in title_terms + explicit)),
            "feeTerms": fees, "note": "Use and fee keywords only; absence is not proof of whole-house terms or no extra cost."}


def run_provider(name, seeds, sources, excluded, stops, gap_ids, max_details, max_cards):
    adapter = None if name == "pinhome" else multi.adapters.Adapter(name, core)
    client = core.Client(delay_seconds=2, adapter=adapter, jitter_seconds=0.5)
    robots, stopped = None, None
    discoveries, pending, skipped, results = [], {}, [], []
    # Each provider uses a single client/robots policy for discovery and details.
    def add(seed):
        try:
            url = pilot.canonical(seed["url"])
        except ValueError:
            skipped.append({**seed, "reason": "unsupported-detail-url"})
            return False
        key = core.catalog_url(url).lower()
        if key in excluded:
            skipped.append({**seed, "reason": "catalogued-or-previous-detail"})
            return False
        if key in pending:
            return False
        pending[key] = {**seed, "url": url}
        return True
    # Finish previously pending URLs before newly discovered details.
    for seed in seeds:
        if seed.get("priorityFirst"):
            add(seed)
    for source in sources:
        row = {**source, "status": "pending"}
        if not stopped:
            try:
                if robots is None:
                    robots = client.start()
                url = client.normalize(source["url"])
                if "/unit/" in url or (adapter and adapter.is_detail(url)):
                    raise ValueError("not-search-page")
                body = client.get(url)
                d = adapter.parse_search(body, url) if adapter else core.parse_search(body, url)
                row.update(status="search-read", checkedAt=core.now(), sha256=core.digest(body),
                           total=d["total"], cards=len(d["cards"]), pages=d["pages"],
                           locationLabel=d.get("locationLabel"), focusedSearch=d.get("focusedSearch", False))
                cards = sorted(d["cards"], key=lambda c: (c.get("rented", False), core.monthly_hint(c), c["url"]))
                count = 0
                for c in cards:
                    if count >= max_cards:
                        break
                    if c.get("rented") or core.monthly_hint(c) < float("inf") and core.monthly_hint(c) > 5_000_000:
                        continue
                    if add({"url": c["url"], "discovery": url, "taskHints": source["taskHints"]}):
                        count += 1
                row["selected"] = count
            except core.StopSource as exc:
                stopped = str(exc)
                row.update(status="blocked", reason=stopped)
            except (ValueError, KeyError, OSError, TypeError) as exc:
                row.update(status="error", reason=str(exc)[:100] if isinstance(exc, ValueError) else type(exc).__name__)
        discoveries.append(row)
        print(name, "search", row["status"], source["url"], flush=True)
    for seed in seeds:
        if not seed.get("priorityFirst"):
            add(seed)
    for i, seed in enumerate(pending.values()):
        row = {**seed, "provider": name, "status": "pending"}
        if i < max_details and not stopped:
            try:
                if robots is None:
                    robots = client.start()
                body = client.get(seed["url"])
                d = adapter.parse_detail(body, seed["url"]) if adapter else core.parse_detail(body, seed["url"])
                row.update({k: d[k] for k in FIELDS if k in d})
                if name == "pinhome":
                    row["usageSignals"] = pinhome_usage(body, seed["url"])
                row.update(status="detail-read", checkedAt=dt.datetime.now(dt.timezone(dt.timedelta(hours=7))).date().isoformat(),
                           sha256=core.digest(body), availability="not-confirmed-with-advertiser")
                loc = row.get("location")
                if loc:
                    near = sorted((core.km((loc["lat"], loc["lng"]), (s["lat"], s["lng"])),
                                   s["id"], s["name"], s["mode"]) for s in stops)
                    def view(t):
                        km, sid, station, mode = t
                        return {"stopId": sid, "station": station, "mode": mode, "km": round(km, 3)}
                    row["nearbyTransit"] = [view(t) for t in near[:4] if t[0] <= 3]
                    row["nearbyGapTransit"] = [view(t) for t in near if t[0] <= 3 and t[1] in gap_ids]
            except core.StopSource as exc:
                stopped = str(exc)
                row.update(status="blocked", reason=stopped)
            except (ValueError, OSError, KeyError, TypeError) as exc:
                row.update(status="error", reason=type(exc).__name__)
        results.append(row)
        if row["status"] != "pending":
            print(name, "detail", i + 1, row["status"], flush=True)
    return {"provider": name, "robots": robots, "stopped": stopped, "requests": client.requests,
            "pacing": client.pacing(), "searches": discoveries, "results": results, "skipped": skipped}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("seeds", type=Path)
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--max-details", type=int, default=55)
    parser.add_argument("--max-cards", type=int, default=4)
    parser.add_argument("--inventory", type=Path, default=ROOT / "research/koridor-all-3km-2026-11-26.json")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not 1 <= args.max_details <= 100 or not 1 <= args.max_cards <= 10:
        parser.error("invalid request limits")
    d = json.loads(args.seeds.read_text())
    if not args.run:
        core.save(args.output, {"mode": "plan", "seeds": len(d["seeds"]), "sources": len(d["sources"])})
        return
    excluded = {core.catalog_url(r["listingUrl"]).lower() for r in json.loads(
        (ROOT / "research/rentals.json").read_text())["rentals"]}
    for path in sorted((ROOT / "research").glob("koridor-*-results-*.json")):
        old = json.loads(path.read_text())
        excluded |= {core.catalog_url(r["url"]).lower() for g in old["runs"] for r in g["results"]
                     if r["status"] == "detail-read"}
    inventory = json.loads(args.inventory.read_text())
    gaps = {s["stopId"] for s in inventory["stations"] if not sum(s["existingPinnedCounts"]["3000"].values())}
    stops = core.load_transit_stops()
    names = sorted({pilot.provider(r["url"]) for r in d["seeds"]+d["sources"]} - {None})
    with ThreadPoolExecutor(max_workers=3) as pool:
        runs = list(pool.map(lambda n: run_provider(n, [s for s in d["seeds"] if pilot.provider(s["url"]) == n],
                            [s for s in d["sources"] if pilot.provider(s["url"]) == n], excluded, stops, gaps,
                            args.max_details, args.max_cards), names))
    core.save(args.output, {"schemaVersion": 1, "mode": "live", "note": "Capped public crawl; task hints only, coordinates and prices require curation. No advertiser contact.", "runs": runs})


if __name__ == "__main__":
    main()
