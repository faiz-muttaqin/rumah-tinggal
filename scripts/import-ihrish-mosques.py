"""Export the public mosque rows from a saved Ihrish map, without networking.

Example:
    python3 -I scripts/import-ihrish-mosques.py peta.html \
        --checked-at 2026-10-31 --profiles-dir saved-pages --output-dir output

Only map coordinates, mosque details, and anonymous schedule totals are kept.
Saved pages are parsed as untrusted HTML; their scripts are never executed.
--check compares JSON content independently of repository formatting or object
field order, preserving array order and values; CSV is compared byte for byte.
"""

import argparse
import collections
import csv
import datetime
import hashlib
import io
import json
import math
import os
import pathlib
import re
import sys
import tempfile
import urllib.parse
from html.parser import HTMLParser


SOURCE_URL = "https://ihrish.app/peta/?kapan=semua"
ORIGIN = "https://ihrish.app"
WIB = datetime.timezone(datetime.timedelta(hours=7))
CONTACT = re.compile(r"(?:\+?62|\b0)8\d{2}[\s.-]?\d{3,4}[\s.-]?\d{3,5}|wa\.me/|whatsapp|\btel:", re.I)
MAP_HOSTS = {
    "maps.app.goo.gl", "goo.gl", "google.com", "www.google.com",
    "maps.google.com", "google.co.id", "www.google.co.id", "maps.google.co.id",
}
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


class Invalid(ValueError):
    pass


def clean_text(value, field, maximum=300):
    if not isinstance(value, str):
        raise Invalid(f"{field}: teks wajib diisi")
    value = " ".join(value.split())
    if not value or len(value) > maximum or CONTACT.search(value) or any(c in value for c in "<>"):
        raise Invalid(f"{field}: teks kosong, terlalu panjang, atau memuat kontak/markup")
    return value


def coordinate(value, field, bound):
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise Invalid(f"{field}: koordinat tidak valid") from error
    if not math.isfinite(number) or not -bound <= number <= bound:
        raise Invalid(f"{field}: koordinat di luar rentang")
    return round(number, 6)


def map_url(value):
    if not value:
        return None
    if not isinstance(value, str) or any(c.isspace() or ord(c) < 32 for c in value):
        raise Invalid("data-route: URL tidak valid")
    parsed = urllib.parse.urlsplit(value)
    if (
        parsed.scheme not in ("http", "https") or parsed.hostname not in MAP_HOSTS
        or parsed.username is not None or parsed.password is not None
        or CONTACT.search(urllib.parse.unquote(value))
    ):
        raise Invalid("data-route: wajib URL peta publik tanpa kredensial/kontak")
    try:
        if parsed.port is not None:
            raise Invalid("data-route: port khusus tidak diizinkan")
    except ValueError as error:
        raise Invalid("data-route: port tidak valid") from error
    if parsed.hostname == "goo.gl" and not parsed.path.startswith("/maps/"):
        raise Invalid("data-route: tautan pendek bukan tautan Maps")
    if "google." in parsed.hostname and parsed.hostname != "maps.google.com" and parsed.hostname != "maps.google.co.id" and not parsed.path.startswith("/maps"):
        raise Invalid("data-route: wajib halaman Maps")
    return value


class MapParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.row = None
        self.badge_depth = 0
        self.badge_text = []
        self.headline_depth = 0
        self.headline_text = []
        self.headlines = []
        self.template_depth = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "template":
            self.template_depth += 1
        if self.template_depth:
            return
        if self.badge_depth and tag not in VOID_TAGS:
            self.badge_depth += 1
        if self.headline_depth and tag not in VOID_TAGS:
            self.headline_depth += 1
        if "data-map-headline" in attrs:
            if self.headline_depth:
                raise Invalid("data-map-headline bertumpuk")
            self.headline_depth = 1
            self.headline_text = []
        if tag == "a" and "data-mosque-row" in attrs:
            if self.row is not None:
                raise Invalid("data-mosque-row bertumpuk")
            self.row = {"attrs": attrs, "badges": []}
        if "data-row-badge" in attrs and self.row is not None:
            if self.badge_depth:
                raise Invalid("data-row-badge bertumpuk")
            self.badge_depth = 1
            self.badge_text = []

    def handle_data(self, data):
        if self.template_depth:
            return
        if self.badge_depth:
            self.badge_text.append(data)
        if self.headline_depth:
            self.headline_text.append(data)

    def handle_endtag(self, tag):
        if self.template_depth:
            if tag == "template":
                self.template_depth -= 1
            return
        if self.badge_depth:
            self.badge_depth -= 1
            if self.badge_depth == 0:
                if self.row is None:
                    raise Invalid("badge tanpa baris masjid")
                self.row["badges"].append(" ".join("".join(self.badge_text).split()))
        if self.headline_depth:
            self.headline_depth -= 1
            if self.headline_depth == 0:
                self.headlines.append(" ".join("".join(self.headline_text).split()))
        if tag == "a" and self.row is not None:
            if self.badge_depth:
                raise Invalid("badge masjid belum ditutup")
            self.rows.append(self.row)
            self.row = None

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)


class ProfileParser(HTMLParser):
    def __init__(self, source_id, checked_at):
        super().__init__(convert_charrefs=True)
        self.source_id = source_id
        self.checked_at = checked_at
        self.template_depth = 0
        self.events = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "template":
            self.template_depth += 1
        if self.template_depth or tag != "article" or attrs.get("data-mosque-id") != self.source_id:
            return
        event_id = attrs.get("data-id")
        starts = attrs.get("data-starts")
        if not event_id or not starts or "placeholder" in event_id.lower():
            return
        try:
            stamp = datetime.datetime.fromisoformat(starts)
        except ValueError as error:
            raise Invalid("profil: tanggal jadwal tidak valid") from error
        if stamp.utcoffset() is None:
            raise Invalid("profil: zona waktu jadwal wajib diisi")
        date = stamp.astimezone(WIB).date().isoformat()
        if date < self.checked_at:
            return
        topic = attrs.get("data-cat") or "umum"
        if not re.fullmatch(r"[a-z][a-z0-9-]{0,39}", topic):
            raise Invalid("profil: kategori jadwal tidak valid")
        event = {
            "date": date,
            "cancelled": "data-cancelled" in attrs,
            "regular": "data-rutin" in attrs,
            "topic": topic,
        }
        if event_id in self.events and self.events[event_id] != event:
            raise Invalid("profil: ID jadwal duplikat dengan nilai berbeda")
        self.events[event_id] = event

    def handle_endtag(self, tag):
        if tag == "template" and self.template_depth:
            self.template_depth -= 1


def profile_summary(path, mosque, checked_at):
    if not path.is_file():
        return None
    raw = path.read_bytes()
    parser = ProfileParser(mosque["sourceId"], checked_at)
    parser.feed(raw.decode("utf-8"))
    parser.close()
    events = list(parser.events.values())
    active = [e for e in events if not e["cancelled"]]
    dates = sorted({e["date"] for e in active})
    return {
        "url": mosque["sourceUrl"],
        "sha256": hashlib.sha256(raw).hexdigest(),
        "listedUpcoming": len(events),
        "notCancelledUpcoming": len(active),
        "cancelledUpcoming": len(events) - len(active),
        "regularNotCancelled": sum(e["regular"] for e in active),
        "distinctDates": dates,
        "firstDate": dates[0] if dates else None,
        "lastDate": dates[-1] if dates else None,
        "topics": dict(sorted(collections.Counter(e["topic"] for e in active).items())),
    }


def catalog(html_path, checked_at, profiles_dir):
    raw = html_path.read_bytes()
    parser = MapParser()
    parser.feed(raw.decode("utf-8"))
    parser.close()
    if parser.row is not None or parser.badge_depth or parser.headline_depth or parser.template_depth:
        raise Invalid("HTML peta belum lengkap")
    if len(parser.headlines) != 1:
        raise Invalid("peta wajib memiliki tepat satu headline jumlah")
    headline = parser.headlines[0]
    counts = re.fullmatch(r"([0-9]+) kajian di ([0-9]+) masjid", headline)
    if not counts:
        raise Invalid("headline jumlah kajian/masjid tidak dikenali")
    event_total, mosque_total = map(int, counts.groups())
    mosques = []
    seen_ids = set()
    seen_source_ids = set()
    for row in parser.rows:
        attrs = row["attrs"]
        href = attrs.get("href") or ""
        match = re.fullmatch(r"/masjid/([a-z0-9]+(?:-[a-z0-9]+)*)/", href)
        if not match:
            raise Invalid("baris masjid: href bukan halaman masjid Ihrish")
        slug = match.group(1)
        source_id = attrs.get("data-mosque-id") or ""
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,160}", source_id):
            raise Invalid("baris masjid: ID sumber tidak valid")
        if slug in seen_ids or source_id in seen_source_ids:
            raise Invalid("ID masjid duplikat")
        seen_ids.add(slug)
        seen_source_ids.add(source_id)
        badges = row["badges"]
        if len(badges) != 1 or not re.fullmatch(r"[0-9]+", badges[0]) or not 1 <= int(badges[0]) <= 100_000:
            raise Invalid("baris masjid: tepat satu badge jumlah positif wajib diisi")
        lat = coordinate(attrs.get("data-lat"), "data-lat", 90)
        lng = coordinate(attrs.get("data-lng"), "data-lng", 180)
        mosque = {
            "id": slug,
            "name": clean_text(attrs.get("data-name"), "data-name", 160),
            "address": clean_text(attrs.get("data-address"), "data-address"),
            "lat": lat,
            "lng": lng,
            "sourceId": source_id,
            "sourceUrl": ORIGIN + href,
            "sourceMapUrl": map_url(attrs.get("data-route")),
            "googleMapsUrl": f"https://www.google.com/maps/search/?api=1&query={lat:.6f},{lng:.6f}",
            "eventCount": int(badges[0]),
        }
        mosque["profile"] = profile_summary(profiles_dir / f"{slug}.html", mosque, checked_at) if profiles_dir else None
        mosques.append(mosque)
    if len(mosques) != mosque_total or sum(m["eventCount"] for m in mosques) != event_total:
        raise Invalid("jumlah baris/badge tidak cocok dengan headline; tidak ada output diubah")
    return {
        "schemaVersion": 1,
        "checkedAt": checked_at,
        "source": {
            "url": SOURCE_URL,
            "sha256": hashlib.sha256(raw).hexdigest(),
            "scope": "mapped-upcoming-snapshot",
            "headline": headline,
            "reportedMosques": mosque_total,
            "reportedEvents": event_total,
        },
        "notes": [
            "Daftar diambil dari satu halaman peta publik yang disimpan, tanpa crawling atau permintaan jaringan oleh importer.",
            "Snapshot berisi lokasi dengan jadwal yang ditampilkan pada peta; bukan seluruh direktori masjid atau riwayat kajian Ihrish.",
            "eventCount adalah jumlah jadwal pada snapshot, bukan frekuensi kajian rutin; hitungan peta dapat mencakup jadwal dibatalkan.",
            "Adanya kajian sudah cukup untuk pencantuman. Penanda rutin pada profil hanya informasi tambahan, bukan syarat rekomendasi.",
            "Agregat profil hanya tersedia untuk halaman yang diperiksa terpisah; pembatalan dikeluarkan dari hitungan aktif dan rutin.",
            "Jadwal hari pengecekan dan sesudahnya dihitung menurut tanggal WIB, bukan kepastian bahwa acara belum dimulai atau masih tersedia.",
            "Koordinat berasal dari direktori pihak ketiga, dibulatkan enam desimal, dan belum disurvei atau diverifikasi di lapangan.",
            "Konfirmasi jadwal dan akses kepada pengelola sebelum berangkat. Nama pemateri, kontak, rekening, poster, dan caption tidak disimpan.",
        ],
        "mosques": mosques,
    }


def exports(data):
    metadata = {k: v for k, v in data.items() if k != "mosques"}
    geojson = {
        "type": "FeatureCollection",
        "metadata": metadata,
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [m["lng"], m["lat"]]},
                "properties": {k: v for k, v in m.items() if k not in ("lat", "lng")},
            }
            for m in data["mosques"]
        ],
    }
    output = io.StringIO(newline="")
    fields = [
        "id", "name", "address", "lat", "lng", "sourceId", "sourceUrl",
        "sourceMapUrl", "googleMapsUrl", "eventCount", "profileListedUpcoming",
        "profileNotCancelledUpcoming", "profileCancelledUpcoming", "profileRegularNotCancelled",
    ]
    writer = csv.DictWriter(output, fields, lineterminator="\n")
    writer.writeheader()
    for mosque in data["mosques"]:
        row = {k: mosque[k] for k in fields if k in mosque}
        profile = mosque["profile"]
        for key in ("listedUpcoming", "notCancelledUpcoming", "cancelledUpcoming", "regularNotCancelled"):
            row["profile" + key[0].upper() + key[1:]] = profile[key] if profile else ""
        writer.writerow(row)
    encode = lambda value: (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n").encode("utf-8")
    return {
        "ihrish-mosques.json": encode(data),
        "ihrish-mosques.geojson": encode(geojson),
        "ihrish-mosques.csv": output.getvalue().encode("utf-8"),
    }


def write_exports(files, directory, check):
    if check:
        stale = []
        for name, expected in files.items():
            target = directory / name
            if not target.is_file():
                stale.append(name)
                continue
            actual = target.read_bytes()
            if target.suffix in (".json", ".geojson"):
                # Biome may reflow short arrays; retain value/array-order checks.
                try:
                    normalize = lambda value: json.dumps(json.loads(value), sort_keys=True, allow_nan=False)
                    matches = normalize(actual) == normalize(expected)
                except (ValueError, UnicodeError):
                    matches = False
            else:
                matches = actual == expected
            if not matches:
                stale.append(name)
        if stale:
            raise Invalid("output belum cocok: " + ", ".join(stale))
        return
    directory.mkdir(parents=True, exist_ok=True)
    for name, value in files.items():
        target = directory / name
        if target.is_file() and target.read_bytes() == value:
            continue
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=directory, prefix=f".{name}.", delete=False) as handle:
                temporary = pathlib.Path(handle.name)
                handle.write(value)
            os.replace(temporary, target)
        finally:
            if temporary is not None and temporary.exists():
                temporary.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html", type=pathlib.Path)
    parser.add_argument("--checked-at", required=True)
    parser.add_argument("--profiles-dir", type=pathlib.Path)
    parser.add_argument("--output-dir", type=pathlib.Path, required=True)
    parser.add_argument("--check", action="store_true", help="Periksa isi JSON (format repository boleh berbeda) dan byte CSV tanpa menulis.")
    args = parser.parse_args()
    try:
        if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", args.checked_at):
            raise Invalid("--checked-at wajib YYYY-MM-DD")
        datetime.date.fromisoformat(args.checked_at)
        data = catalog(args.html, args.checked_at, args.profiles_dir)
        write_exports(exports(data), args.output_dir, args.check)
    except (Invalid, OSError, UnicodeError, ValueError) as error:
        print(f"ihrish: {error}", file=sys.stderr)
        return 1
    print(f"ihrish: {len(data['mosques'])} masjid, {data['source']['reportedEvents']} jadwal, {sum(m['profile'] is not None for m in data['mosques'])} profil; {'cocok' if args.check else 'tersimpan'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
