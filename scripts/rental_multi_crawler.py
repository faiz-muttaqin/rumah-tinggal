"""Parallel rental providers, isolated state/rate limits, one private review report."""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import copy
import fcntl
import importlib.util
import json
import os
from pathlib import Path
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
PROVIDERS = ("pinhome", "jendela360", "realoka", "brighton", "jakartaprime", "mamikos")


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
                paths = settings["mosqueAreas"][m["id"]]
                m["sources"] = adapter.sources(paths, settings)
        plans[name] = (adapter, mosques)
    return plans


def run_one(name, adapter, mosques, config, directory, search_limit=None, detail_limit=None, cancel=None):
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (directory / "crawl.lock").open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return {"name": name, "status": "already-running"}
        code = core.run(config, mosques, directory, search_limit, detail_limit, adapter, cancel)
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


def merge(directory, plans, config, runs):
    state = {"details": {}, "pages": {}, "lastRun": {"status": "multi-provider-report", "providers": runs}}
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
                  and not blocked.intersection(r["issues"]) and not r.get("error")]
    area_leads.sort(key=lambda r: ("jakarta selatan" not in r["locality"].lower(), r.get("monthlyEquivalent") or float("inf"), r["url"]))
    result.update(providers=runs, crossSourceMatches=pairs, areaLeads=area_leads)
    result["summary"].update(providers=len(plans), areaLeads=len(area_leads), crossSourceMatches=len(pairs))
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
    lines = ["# Pantauan sewa dari beberapa situs", "", result["note"], "",
             f"Diperiksa {result['generatedAtUTC']}. {s['providers']} sumber, {s['details']} detail, {s['newCandidates']} kandidat baru sekitar {s['mosquesWithCandidates']}/{s['mosques']} masjid; {s['areaLeads']} penawaran kawasan belum memiliki titik yang terbukti.", "",
             "Prioritas: masjid dekat transportasi umum, Jakarta Selatan lalu melebar. Semua jarak garis lurus dari acuan. Kandidat belum otomatis masuk peta publik.", "",
             "| Sumber | Status terakhir | Detail dibaca | Kandidat sekitar masjid | Penawaran kawasan |",
             "| --- | --- | ---: | ---: | ---: |"]
    for name, counts in s["byProvider"].items():
        run = next((r for r in result["providers"] if r["name"] == name), {})
        lines.append(f"| {name} | {run.get('status', 'cache sebelumnya')} | {counts['details']} | {counts['candidates']} | {counts['areaLeads']} |")
    lines += ["", "## Kandidat sekitar masjid", ""]
    for r in result["results"]:
        if r["reviewStatus"] != "candidate" or r["alreadyCatalogued"]:
            continue
        near = r["nearbyMosques"][0]
        amount = f"{r['amount']:,.0f}".replace(",", ".")
        period = "bulan" if r["period"] == "monthly" else "tahun"
        stamp = r.get("sourceUpdatedAt")
        stamp = stamp[:10] if stamp else "tanggal pembaruan tidak ditampilkan"
        options = "; ".join(f"{p['months']} bulan Rp {p['amount']:,.0f}".replace(",", ".") for p in r.get("priceOptions", []) if p.get("months"))
        terms = f" Opsi kontrak: {options}." if options else ""
        lines.append(f"- {period_badges(r)} · [{r['provider']} · {r['kind']} {r.get('bedrooms') or '?'} kamar, {r['locality']}]({r['url']}) — Rp {amount}/{period}; {near['name']} ≈{near['km']} km. {stamp}.{terms}")
    lines += ["", "## Penawaran kawasan — jarak ke masjid belum terbukti", "",
              "Lokasi tertulis berikut adalah petunjuk pencarian. Tanpa titik, iklan tidak dihitung sebagai sewa dalam radius masjid. Tanggal relatif dan ketersediaan perlu dikonfirmasi.", ""]
    for r in result["areaLeads"][:100]:
        amount = f"{r['amount']:,.0f}".replace(",", ".")
        lines.append(f"- {period_badges(r)} · [{r['provider']} · {r['kind']}, {r['locality']}]({r['url']}) — Rp {amount}/{'bulan' if r['period'] == 'monthly' else 'tahun'}.")
    if result["crossSourceMatches"]:
        lines += ["", "## Dugaan duplikat lintas situs", "",
                  "Ditahan untuk ditinjau; tidak dianggap unit baru atau dihapus diam-diam.", ""]
        for group in result["crossSourceMatches"]:
            lines.append("- " + " · ".join(f"[Sumber {i+1}]({url})" for i, url in enumerate(group["urls"])))
    return "\n".join(lines)+"\n"


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--report-only", action="store_true")
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
    directory = args.output_dir.resolve()
    local = directory.is_relative_to(ROOT / ".runtime/research") and directory != ROOT / ".runtime/research"
    if not local and directory != Path("/var/lib/rumah-tinggal-rental-crawl").resolve():
        parser.error("Output must be a private research directory")
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    config = json.loads((ROOT / "research/rental-crawl-sources.json").read_text())
    multi = json.loads((ROOT / "research/rental-crawl-providers.json").read_text())
    if multi.get("schemaVersion") != 1 or type(multi.get("parallelProviders")) is not int or not 1 <= multi["parallelProviders"] <= 3:
        parser.error("Invalid parallel provider config")
    for settings in multi["providers"].values():
        settings["mosqueAreas"] = config["targets"]
    cancel = threading.Event()
    plans = provider_plan(core.plan(config), multi, cancel)
    chosen = [name for name in chosen if name in plans]
    if not chosen:
        parser.error("No selected provider is enabled")
    if not args.run and not args.report_only:
        summary = {name: {"mosques": len(rows), "sources": len({s for m in rows for s in m["sources"]})} for name, (_, rows) in plans.items()}
        core.save(directory / "multi-plan.json", {"generatedAtUTC": core.now(), "providers": summary, "parallelProviders": multi["parallelProviders"]})
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
                    path = directory if name == "pinhome" else directory / "providers" / name
                    future = pool.submit(run_one, name, adapter, mosques, cfg, path, args.max_search, args.max_detail, cancel)
                    futures[future] = name
                for future in as_completed(futures):
                    name = futures[future]
                    try:
                        runs.append(future.result())
                    except Exception as exc:
                        runs.append({"name": name, "status": "failed", "reason": type(exc).__name__})
        result = merge(directory, plans, config, runs)
        print(json.dumps(result["summary"]))
        return 2 if any(r.get("exitCode") or r["status"] in ("failed", "already-running") for r in runs) else 0


if __name__ == "__main__":
    raise SystemExit(main())
