"""Parallel rental providers, isolated state/rate limits, one private review report."""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import copy
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import signal
import threading

ROOT = Path(__file__).resolve().parents[1]


def load_module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


core = load_module("rental_crawler")
adapters = load_module("rental_adapters")
PROVIDERS = ("pinhome", "jendela360", "realoka", "brighton", "jakartaprime", "mamikos", "rukita")


def active_mosques(base, settings):
    """Select an explicit phase without deleting the full reference inventory."""
    extras = settings.get("additionalMosqueAreas", {})
    if (not isinstance(extras, dict) or not set(extras).issubset({m["id"] for m in base})
            or any(not isinstance(paths, list) or not paths or any(not isinstance(path, str)
                    or len(path.split("/")) not in (3, 4)
                    or any(not re.fullmatch(r"[a-z0-9-]+", part) for part in path.split("/")) for path in paths)
                   for paths in extras.values())):
        raise ValueError("Invalid adjacent discovery areas")
    for provider in settings.get("providers", {}).values():
        sources = provider.get("mosqueSources", {})
        if (not isinstance(sources, dict) or not set(sources).issubset({m["id"] for m in base})
                or any(not isinstance(urls, list) or not urls or any(not isinstance(url, str) for url in urls)
                       for urls in sources.values())):
            raise ValueError("Invalid mosque-specific discovery sources")
    if "activeMosqueIds" not in settings:
        return base
    ids = settings["activeMosqueIds"]
    if (not isinstance(ids, list) or not ids or any(not isinstance(i, str) for i in ids)
            or len(ids) != len(set(ids)) or not set(ids).issubset({m["id"] for m in base})):
        raise ValueError("Active mosque scope must be a nonempty unique subset of the reference inventory")
    return [m for m in base if m["id"] in ids]


def active_detail_limit(config, settings):
    limit = settings.get("activeDetailsPerMosque", config["maxDetailsPerMosque"]) if "activeMosqueIds" in settings else config["maxDetailsPerMosque"]
    if type(limit) is not int or not 1 <= limit <= 20:
        raise ValueError("Invalid active per mosque detail limit")
    return limit


def provider_plan(base, config, cancel=None):
    plans = {}
    for name in PROVIDERS:
        settings = config["providers"][name]
        if not settings.get("enabled"):
            continue
        adapter = None if name == "pinhome" else adapters.Adapter(name, core, cancel)
        mosques = copy.deepcopy(base)
        if adapter:
            for m in mosques:
                paths = m.get("paths")
                if paths is None:
                    paths = list(settings["mosqueAreas"][m["id"]]) + config.get("additionalMosqueAreas", {}).get(m["id"], [])
                m["sources"] = adapter.sources(paths, settings)
                for url in settings.get("mosqueSources", {}).get(m["id"], []):
                    canonical = adapter.canonical(url)
                    if adapter.is_detail(canonical) or canonical.endswith("/robots.txt"):
                        raise ValueError("Expected a public discovery source")
                    if canonical not in m["sources"]:
                        m["sources"].append(canonical)
        plans[name] = (adapter, mosques)
    return plans


def run_one(name, adapter, mosques, config, directory, search_limit=None, detail_limit=None, cancel=None, refresh_search=False):
    if not any(m.get("sources") for m in mosques):
        return {"name": name, "status": "not-applicable", "exitCode": 0,
                "run": {"status": "not-applicable", "reason": "no-source-for-active-mosques",
                        "requests": 0, "searchRequests": 0, "detailRequests": 0},
                "summary": {"mosques": len(mosques), "details": 0, "candidates": 0}}
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (directory / "crawl.lock").open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return {"name": name, "status": "already-running"}
        code = core.run(config, mosques, directory, search_limit, detail_limit, adapter, cancel, refresh_search)
        result = json.loads((directory / "latest.json").read_text())
        return {"name": name, "status": result["run"]["status"], "exitCode": code,
                "run": result["run"], "summary": result["summary"]}


def cross_source_matches(details):
    """Flag likely syndication without silently merging distinct apartment units."""
    buckets, pairs = {}, []
    for row in details.values():
        loc = row.get("location")
        if not loc or row.get("bedrooms") is None or not row.get("buildingAreaM2") or not row.get("monthlyEquivalent"):
            continue
        key = (round(loc["lat"], 3), round(loc["lng"], 3), row.get("kind"), row["bedrooms"], round(row["buildingAreaM2"], 1))
        for other in buckets.get(key, []):
            if other["provider"] == row["provider"]:
                continue
            point = other["location"]
            if (core.km((loc["lat"], loc["lng"]), (point["lat"], point["lng"])) <= 0.03
                    and abs(other["monthlyEquivalent"] / row["monthlyEquivalent"] - 1) <= 0.03):
                pairs.append({"urls": [other["url"], row["url"]], "reason": "nearby-point-same-size-bedrooms-price"})
                for a, b in [(row, other), (other, row)]:
                    if "possible-cross-source-duplicate" not in a["issues"]:
                        a["issues"].append("possible-cross-source-duplicate")
                    a.setdefault("duplicateSourceUrls", []).append(b["url"])
        buckets.setdefault(key, []).append(row)
    return pairs


def merge(directory, plans, config, runs, scope=None):
    state = {"details": {}, "pages": {}, "lastRun": {"status": "multi-provider-report", "providers": runs}}
    if scope is not None:
        state["lastRun"]["scope"] = scope
    base = copy.deepcopy(next(iter(plans.values()))[1])
    for m in base:
        m["sources"] = []
    for name, (_, mosques) in plans.items():
        location = directory if name == "pinhome" else directory / "providers" / name
        path = location / "state.json"
        if not path.exists():
            continue
        source = json.loads(path.read_text())
        for url, row in source["details"].items():
            state["details"][url] = {**copy.deepcopy(row), "provider": name}
        state["pages"].update(source["pages"])
        for index, m in enumerate(mosques):
            base[index]["sources"].extend(m["sources"])
    pairs = cross_source_matches(state["details"])
    result = core.report(state, base, config)
    # A named locality is a lead only; it is never linked to a mosque by radius.
    blocked = {"inactive-or-rented", "invalid-rent", "unknown-rent-period", "not-a-rental-offer",
               "non-idr-price-needs-review", "possible-cross-source-duplicate", "possible-duplicate-photo",
               "usage-or-period-needs-review", "property-kind-needs-review"}
    blocked.update({"payment-options-needs-review", "resident-policy-needs-review", "source-availability-needs-review"})
    area_leads = [r for r in result["results"] if not r.get("location") and r.get("amount") and r.get("period")
                  and not r["stale"] and not r["alreadyCatalogued"] and r.get("locality")
                  and r.get("budgetPriority") not in ("over-budget", "unknown")
                  and not blocked.intersection(r["issues"]) and not r.get("error")]
    area_leads.sort(key=lambda r: ({"preferred": 0, "stretch": 1, "unknown": 2, "over-budget": 3}.get(r.get("budgetPriority"), 0),
                                  r.get("monthlyEquivalent") or float("inf"), r["url"]))
    result.update(providers=runs, crossSourceMatches=pairs, areaLeads=area_leads)
    for mosque in result["coverage"]:
        mosque["focusByProvider"] = {r["name"]: next((m for m in r.get("run", {}).get("focus", {}).get("mosques", []) if m["id"] == mosque["id"]), None) for r in runs}
    result["summary"].update(providers=len(plans), areaLeads=len(area_leads), crossSourceMatches=len(pairs))
    if config.get("budgetPriority"):
        result["summary"]["newCandidatesByBudget"] = {band: sum(r["reviewStatus"] == "candidate" and not r["alreadyCatalogued"] and r.get("budgetPriority") == band for r in result["results"])
                                                        for band in ["preferred", "stretch", "unknown", "over-budget"]}
    result["summary"]["byProvider"] = {name: {
        "details": sum(bool(r.get("sha256")) for r in result["results"] if r["provider"] == name),
        "candidates": sum(r["reviewStatus"] == "candidate" for r in result["results"] if r["provider"] == name),
        "areaLeads": sum(r["provider"] == name for r in area_leads),
    } for name in plans}
    core.save(directory / "multi-latest.json", result)
    (directory / "multi-latest.md").write_text(markdown(result))
    (directory / "multi-latest.md").chmod(0o600)
    return result


def period_badges(row):
    label = {"monthly": "Bulanan", "yearly": "Tahunan"}.get(row.get("period"), "Periode belum jelas")
    minimum = row.get("minimumRentMonths")
    return "**" + label + "**" + (f" · **Minimal {minimum} bulan**" if minimum else "")


def markdown(result):
    s = result["summary"]
    scope = (result.get("run") or {}).get("scope")
    priority = "Prioritas masjid mengikuti konfigurasi sumber."
    if scope and scope.get("corridorOnly"):
        priority = (f"Fokus {len(scope['activeTransitIds'])} stasiun KRL/MRT/LRT, radius garis lurus "
                    f"{scope['transitRadiusKm']:g} km; plafon Rp5.000.000 per bulan ekuivalen. "
                    "Kelurahan dan slug pencarian merupakan seed, bukan irisan batas terverifikasi.")
    elif scope and scope.get("activeTransitIds"):
        priority = f"Fokus {len(scope['activeMosqueIds'])} masjid dan {len(scope['activeTransitIds'])} titik angkutan. Radius 1,2 km dari stasiun dan 0,7 km dari halte."
        if budget := scope.get("budgetPriority"):
            max_monthly = f"{budget['maxMonthly']:,}".replace(",", ".")
            priority += f" Plafon Rp{max_monthly} per bulan ekuivalen."
    elif scope and scope.get("priorityMode") == "ihrish-krl":
        priority = f"Fokus {len(scope['activeMosqueIds'])} masjid Ihrish di Jabodetabek. Prioritas jarak KRL dan aktivitas mengikuti konfigurasi."
    elif scope and len(scope["activeMosqueIds"]) < scope["referenceMosques"]:
        names = ", ".join(row["name"] for row in result["coverage"])
        priority = f"Fokus aktif: {names}; inventori acuan {scope['referenceMosques']} masjid tetap dipertahankan."
    lines = ["# Pantauan sewa dari beberapa situs", "", result["note"], "",
             f"Diperiksa {result['generatedAtUTC']}. {s['providers']} sumber, {s['details']} detail, {s['newCandidates']} kandidat baru. Cakupan kandidat: {s['mosquesWithCandidates']}/{s['mosques']} masjid dan {s.get('transitWithCandidates', 0)}/{s.get('transitStops', 0)} titik angkutan. {s['areaLeads']} penawaran kawasan belum bertitik.", "",
             priority + " Semua jarak garis lurus dari acuan. Kandidat belum otomatis masuk peta publik.", "",
             "| Sumber | Status terakhir | Detail dibaca | Kandidat bertitik | Penawaran kawasan |",
             "| --- | --- | ---: | ---: | ---: |"]
    for name, counts in s["byProvider"].items():
        run = next((r for r in result["providers"] if r["name"] == name), {})
        lines.append(f"| {name} | {run.get('status', 'cache sebelumnya')} | {counts['details']} | {counts['candidates']} | {counts['areaLeads']} |")
    lines += ["", "## Batas putaran dan cakupan", "",
              "Detail kumulatif di atas berbeda dari permintaan pada putaran ini. Antrean hanya berasal dari halaman pencarian yang masih segar; bukan seluruh inventaris portal.", "",
              "| Sumber | Pencarian / batas | Detail / batas | Antrean detail | Kawasan segar | Titik tercakup / dipetakan | Menit |",
              "| --- | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for provider in result["providers"]:
        run = provider.get("run", {})
        coverage = run.get("coverage")
        if coverage:
            covered = coverage["coveredMosques"] + coverage.get("coveredTransitStops", 0)
            configured = coverage["configuredMosques"] + coverage.get("configuredTransitStops", 0)
            lines.append(f"| {provider['name']} | {run['searchRequests']}/{coverage['searchLimit']} | {run['detailRequests']}/{coverage['detailLimit']} | {coverage['pendingDetailUrls']} | {coverage['freshSources']}/{coverage['plannedSources']} | {covered}/{configured} | {run['durationSeconds']/60:.1f} |")
    lines += ["", "## Kandidat sekitar masjid atau angkutan umum", ""]
    for r in result["results"]:
        if r["reviewStatus"] != "candidate" or r["alreadyCatalogued"]:
            continue
        near = (r.get("nearbyTransit") or r["nearbyMosques"])[0]
        amount = f"{r['amount']:,.0f}".replace(",", ".")
        period = "bulan" if r["period"] == "monthly" else "tahun"
        stamp = r.get("sourceUpdatedAt")
        stamp = stamp[:10] if stamp else "tanggal pembaruan tidak ditampilkan"
        options = "; ".join(f"{p['months']} bulan Rp {p['amount']:,.0f}".replace(",", ".") for p in r.get("priceOptions", []) if p.get("months"))
        terms = f" Opsi kontrak: {options}." if options else ""
        lines.append(f"- {period_badges(r)} · [{r['provider']} · {r['kind']} {r.get('bedrooms') or '?'} kamar, {r['locality']}]({r['url']}) — Rp {amount}/{period}; {near['name']} ≈{near['km']} km. {stamp}.{terms}")
        if "budgetPriority" in r:
            lines.append("  Prioritas anggaran: " + r["budgetPriority"] + ".")
    lines += ["", "## Penawaran kawasan dengan jarak belum terverifikasi", "",
              "Lokasi tertulis berikut adalah petunjuk pencarian. Koordinat penawaran, jarak ke acuan, dan ketersediaan perlu dikonfirmasi.", ""]
    for r in result["areaLeads"][:100]:
        amount = f"{r['amount']:,.0f}".replace(",", ".")
        lines.append(f"- {period_badges(r)} · [{r['provider']} · {r['kind']}, {r['locality']}]({r['url']}) — Rp {amount}/{'bulan' if r['period'] == 'monthly' else 'tahun'}.")
    if result["crossSourceMatches"]:
        lines += ["", "## Dugaan duplikat lintas situs", "",
                  "Ditahan untuk ditinjau; tidak dianggap unit baru atau dihapus diam-diam.", ""]
        for group in result["crossSourceMatches"]:
            lines.append("- " + " · ".join(f"[Sumber {i+1}]({url})" for i, url in enumerate(group["urls"])))
    return "\n".join(lines)+"\n"


def corridor_targets(corridor, names=()):
    """Keep station names, IDs and discovery paths consistent; paths are not verified boundaries."""
    stations = corridor["stations"]
    targets = corridor["transitTargets"]
    ids = [s["stopId"] for s in stations]
    station_names = [s["station"] for s in stations]
    if (not ids or len(ids) != len(set(ids)) or len(station_names) != len(set(station_names))
            or len(targets) != len(ids) or {t["stopId"] for t in targets} != set(ids)):
        raise ValueError("Invalid corridor inventory")
    by_id = {s["stopId"]: s for s in stations}
    if any(t["paths"] != by_id[t["stopId"]]["paths"] for t in targets):
        raise ValueError("Corridor discovery paths disagree with station seeds")
    if set(names) - set(station_names):
        raise ValueError("Unknown corridor station")
    return [t for t in targets if not names or by_id[t["stopId"]]["station"] in names]


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--report-only", action="store_true")
    parser.add_argument("--refresh-search", action="store_true", help="Refresh all configured first pages within the existing budgets")
    parser.add_argument("--transit-only", action="store_true", help="Use only the transit catchments for this run")
    parser.add_argument("--corridor-only", action="store_true", help="Use 28 KRL/MRT corridor seed targets with a separate crawl state")
    parser.add_argument("--corridor-file", type=Path, default=ROOT / "research/koridor-station-targets.json",
                        help="Corridor inventory inside research/; non-default files use their own crawl state")
    parser.add_argument("--station", action="append", default=[], help="Exact corridor station name; repeatable; isolated pilot state")
    parser.add_argument("--providers", default=",".join(PROVIDERS))
    parser.add_argument("--output-dir", type=Path, default=ROOT / ".runtime/research/rental-crawl")
    parser.add_argument("--max-search", type=int)
    parser.add_argument("--max-detail", type=int)
    args = parser.parse_args()
    if args.run and args.report_only:
        parser.error("Choose acquisition or report only")
    if any(n is not None and not 1 <= n <= 1000 for n in (args.max_search, args.max_detail)):
        parser.error("Request limits must be 1..1000")
    chosen = args.providers.split(",")
    if not chosen or len(set(chosen)) != len(chosen) or any(p not in PROVIDERS for p in chosen):
        parser.error("Unknown or duplicate provider")
    if args.station and not args.corridor_only:
        parser.error("--station requires --corridor-only")
    corridor_file = args.corridor_file.resolve()
    custom_corridor = corridor_file != (ROOT / "research/koridor-station-targets.json").resolve()
    if custom_corridor and not args.corridor_only:
        parser.error("--corridor-file requires --corridor-only")
    if not corridor_file.is_relative_to(ROOT / "research") or corridor_file.suffix != ".json" or not corridor_file.is_file():
        parser.error("Corridor file must be an existing JSON file inside research/")
    if args.corridor_only:
        args.transit_only = True
        if args.output_dir == ROOT / ".runtime/research/rental-crawl":
            suffix = "-" + corridor_file.stem if custom_corridor else ""
            if args.station:
                digest = hashlib.sha256(json.dumps(sorted(set(args.station))).encode()).hexdigest()[:16]
                suffix += "-pilot-" + digest
            args.output_dir = ROOT / (".runtime/research/corridor-crawl" + suffix)
        elif args.output_dir.resolve() in {(ROOT / ".runtime/research/rental-crawl").resolve(), Path("/var/lib/rumah-tinggal-rental-crawl").resolve()}:
            parser.error("Corridor crawl requires a separate private output directory")
    directory = args.output_dir.resolve()
    local = directory.is_relative_to(ROOT / ".runtime/research") and directory != ROOT / ".runtime/research"
    if not local and directory != Path("/var/lib/rumah-tinggal-rental-crawl").resolve():
        parser.error("Output must be a private research directory")
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    config = json.loads((ROOT / "research/rental-crawl-sources.json").read_text())
    if args.corridor_only:
        corridor = json.loads(corridor_file.read_text())
        try:
            config["transitTargets"] = corridor_targets(corridor, args.station)
        except ValueError as exc:
            parser.error(str(exc))
        corridor_radius = corridor.get("transitRadiusKm", 1.5)
        if type(corridor_radius) not in (int, float) or not 0.3 <= corridor_radius <= 3:
            parser.error("Corridor transitRadiusKm must be a number from 0.3 to 3")
        config["budgetPriority"] = {"preferredMonthly": 4_000_000, "maxMonthly": 5_000_000}
    core.validate_config(config)
    multi = json.loads((ROOT / "research/rental-crawl-providers.json").read_text())
    if multi.get("schemaVersion") != 1 or type(multi.get("parallelProviders")) is not int or not 1 <= multi["parallelProviders"] <= 3:
        parser.error("Invalid parallel provider config")
    for settings in multi["providers"].values():
        settings["mosqueAreas"] = config["targets"]
    cancel = threading.Event()
    reference = core.plan(config)
    selected = active_mosques(reference, multi)
    transit = core.transit_plan(config)
    if args.corridor_only:
        for stop in transit:
            stop["radiusKm"] = corridor_radius
    if args.transit_only and not transit:
        parser.error("No transit targets configured")
    if args.transit_only:
        selected = []
    per_mosque = active_detail_limit(config, multi)
    scope = {"referenceMosques": len(reference), "activeMosqueIds": [m["id"] for m in selected],
             "activeTransitIds": [s["id"] for s in transit],
             "radiusKm": config["radiusKm"], "detailsPerMosquePerProvider": per_mosque,
             "priorityMode": config.get("priorityMode", "legacy"), "budgetPriority": config.get("budgetPriority")}
    if args.corridor_only:
        scope.update(corridorOnly=True, transitRadiusKm=corridor_radius, boundaryStatus=corridor["boundaryStatus"],
                     requestedStations=sorted(set(args.station)))
    plans = provider_plan(transit + selected, multi, cancel)
    chosen = [name for name in chosen if name in plans]
    if not chosen:
        parser.error("No selected provider is enabled")
    if not args.run and not args.report_only:
        summary = {name: {"mosques": sum(m.get("type") != "transit" for m in rows), "transitStops": len(transit),
                          "sources": len({s for m in rows for s in m["sources"]})} for name, (_, rows) in plans.items()}
        summary = {name: counts for name, counts in summary.items() if name in chosen}
        core.save(directory / "multi-plan.json", {"generatedAtUTC": core.now(), "providers": summary, "parallelProviders": multi["parallelProviders"], "scope": scope})
        print(json.dumps(summary))
        return 0
    with (directory / "multi.lock").open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Multi-provider crawl already running")
            return 0
        runs = []
        if args.run:
            def stop(_signum, _frame):
                cancel.set()
            signal.signal(signal.SIGTERM, stop)
            signal.signal(signal.SIGINT, stop)
            with ThreadPoolExecutor(max_workers=multi["parallelProviders"]) as pool:
                futures = {}
                for name in chosen:
                    adapter, mosques = plans[name]
                    cfg = {**config, **{k: v for k, v in multi["providers"][name].items() if k in config}}
                    cfg["maxDetailsPerMosque"] = per_mosque
                    path = directory if name == "pinhome" else directory / "providers" / name
                    future = pool.submit(run_one, name, adapter, mosques, cfg, path, args.max_search, args.max_detail, cancel, args.refresh_search)
                    futures[future] = name
                for future in as_completed(futures):
                    name = futures[future]
                    try:
                        runs.append(future.result())
                    except Exception as exc:
                        runs.append({"name": name, "status": "failed", "reason": type(exc).__name__})
        result = merge(directory, plans, config, runs, scope)
        print(json.dumps(result["summary"]))
        return 2 if any(r.get("exitCode") or r["status"] in ("failed", "already-running") for r in runs) else 0


if __name__ == "__main__":
    raise SystemExit(main())
