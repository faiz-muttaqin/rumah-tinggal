"""Estimate residents around each research project from a WorldPop raster.

Usage: python3 scripts/build-population-context.py RASTER.tif
       [--research FILE] [--output FILE] [--checked-at YYYY-MM-DD]

RASTER.tif is the WorldPop R2025A constrained 100 m GeoTIFF for Indonesia
(idn_pop_2025_CN_100m_R2025A_v1.tif, CC BY 4.0). It is large and is not
stored in Git; keep it under .runtime/context/. The script uses only the
standard library: it reads the BigTIFF tags, decodes just the tiles around
each project point (LZW, horizontal predictor) and sums the people per pixel
whose centre lies within 0.5 km and 1 km of the point.

The output, research/context/population.json, records the coordinate used for
every project so scripts/build-properties.py can drop a value whose point has
since changed. Values are model estimates of where residents live, not
official counts and not daytime crowding.
"""

import argparse
import array
import hashlib
import json
import math
import pathlib
import struct
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
RADII_KM = (0.5, 1.0)
SOURCE = {
    "id": "worldpop-r2025a-idn-2025",
    "name": "WorldPop Global2, Indonesia 100 m constrained, tahun 2025 (rilis R2025A)",
    "publisher": "WorldPop, University of Southampton",
    "url": "https://hub.worldpop.org/geodata/summary?id=73823",
    "fileUrl": "https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/2025/IDN/v1/100m/constrained/idn_pop_2025_CN_100m_R2025A_v1.tif",
    "doi": "10.5258/SOTON/WP00839",
    "licence": "CC BY 4.0",
    "licenceUrl": "https://hub.worldpop.org/data/licence.txt",
    "published": "2025-09-01",
    "year": 2025,
}


class Raster:
    """Minimal reader for a tiled, LZW-compressed float32 BigTIFF."""

    def __init__(self, path):
        self.file = open(path, "rb")
        head = self.file.read(16)
        if head[:4] != b"II+\x00":
            sys.exit("Raster harus BigTIFF little-endian (WorldPop R2025A)")
        self.file.seek(struct.unpack("<Q", head[8:16])[0])
        count = struct.unpack("<Q", self.file.read(8))[0]
        tags = {}
        for _ in range(count):
            tag, kind, n = struct.unpack("<HHQ", self.file.read(12))
            tags[tag] = (kind, n, self.file.read(8))
        self.width = self.value(tags[256])[0]
        self.height = self.value(tags[257])[0]
        self.tile_w = self.value(tags[322])[0]
        self.tile_h = self.value(tags[323])[0]
        expected = {258: 32, 259: 5, 317: 2, 339: 3, 277: 1}
        for tag, want in expected.items():
            if self.value(tags[tag])[0] != want:
                sys.exit(f"Format raster tidak didukung: tag {tag} bukan {want}")
        self.offsets = self.value(tags[324])
        self.counts = self.value(tags[325])
        scale = self.value(tags[33550])
        tie = self.value(tags[33922])
        self.x0, self.y0, self.dx, self.dy = tie[3], tie[4], scale[0], scale[1]
        self.nodata = float(self.value(tags[42113]).rstrip(b"\x00"))
        self.tiles_across = math.ceil(self.width / self.tile_w)
        self.cache = {}

    def value(self, entry):
        kind, n, raw = entry
        fmt, size = {2: ("s", 1), 3: ("H", 2), 4: ("I", 4), 12: ("d", 8), 16: ("Q", 8)}[kind]
        if n * size > 8:
            self.file.seek(struct.unpack("<Q", raw)[0])
            raw = self.file.read(n * size)
        return raw[:n] if fmt == "s" else struct.unpack(f"<{n}{fmt}", raw[: n * size])

    def tile(self, index):
        if index not in self.cache:
            self.file.seek(self.offsets[index])
            data = lzw_decode(self.file.read(self.counts[index]))
            words = array.array("I", data[: self.tile_w * self.tile_h * 4])
            # Prediktor horizontal libtiff bekerja pada kata 32-bit, termasuk float.
            for row in range(0, self.tile_w * self.tile_h, self.tile_w):
                for col in range(row + 1, row + self.tile_w):
                    words[col] = (words[col] + words[col - 1]) & 0xFFFFFFFF
            self.cache[index] = array.array("f", words.tobytes())
        return self.cache[index]

    def pixel(self, col, row):
        if not (0 <= col < self.width and 0 <= row < self.height):
            return 0.0
        tile = self.tile((row // self.tile_h) * self.tiles_across + col // self.tile_w)
        value = tile[(row % self.tile_h) * self.tile_w + col % self.tile_w]
        return 0.0 if value == self.nodata or value != value or value < 0 else value

    def around(self, lat, lng, radii):
        # Jumlahkan piksel yang pusatnya berada dalam radius (jarak ekuirektangular).
        reach = max(radii) / 111.2
        cols = range(int((lng - reach / math.cos(math.radians(lat)) - self.x0) / self.dx) - 1,
                     int((lng + reach / math.cos(math.radians(lat)) - self.x0) / self.dx) + 2)
        rows = range(int((self.y0 - lat - reach) / self.dy) - 1, int((self.y0 - lat + reach) / self.dy) + 2)
        sums = [0.0] * len(radii)
        scale = math.cos(math.radians(lat))
        for row in rows:
            plat = self.y0 - (row + 0.5) * self.dy
            for col in cols:
                plng = self.x0 + (col + 0.5) * self.dx
                km = 111.2 * math.hypot((plng - lng) * scale, plat - lat)
                if km > reach * 111.2:
                    continue
                people = self.pixel(col, row)
                for i, radius in enumerate(radii):
                    if km <= radius:
                        sums[i] += people
        return sums


def lzw_decode(data):
    """TIFF LZW (MSB-first codes, 9 to 12 bits, early change)."""
    out = bytearray()
    table = [bytes([i]) for i in range(256)] + [b"", b""]
    padded = data + b"\x00\x00\x00"
    bits, width, previous = 0, 9, None
    limit = len(data) * 8
    while bits + width <= limit:
        chunk = int.from_bytes(padded[bits >> 3 : (bits >> 3) + 3], "big")
        code = (chunk >> (24 - (bits & 7) - width)) & ((1 << width) - 1)
        bits += width
        if code == 256:
            del table[258:]
            width, previous = 9, None
            continue
        if code == 257:
            break
        if previous is None:
            entry = table[code]
        else:
            entry = table[code] if code < len(table) else previous + previous[:1]
            table.append(previous + entry[:1])
            if len(table) + 1 >= 1 << width and width < 12:
                width += 1
        out += entry
        previous = entry
    return bytes(out)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("raster", type=pathlib.Path)
    parser.add_argument("--research", type=pathlib.Path, default=ROOT / "research/properties.json")
    parser.add_argument("--output", type=pathlib.Path, default=ROOT / "research/context/population.json")
    parser.add_argument("--checked-at", required=True)
    args = parser.parse_args()
    digest = hashlib.sha256(args.raster.read_bytes()).hexdigest()
    raster = Raster(args.raster)
    research = json.loads(args.research.read_text())
    values = {}
    for entry in research["properties"]:
        point = entry.get("coordinate")
        if not point or "lat" not in point:
            continue
        near, far = raster.around(point["lat"], point["lng"], RADII_KM)
        values[entry["id"]] = {
            "lat": point["lat"],
            "lng": point["lng"],
            # Estimasi model dibulatkan ke puluhan agar tidak tampak sebagai hitungan pasti.
            "within500m": int(round(near, -1)),
            "within1km": int(round(far, -1)),
            "densityKm2": int(round(far / math.pi, -1)),
        }
    result = {
        "source": dict(SOURCE, sha256=digest, checkedAt=args.checked_at),
        "method": "Jumlah orang per piksel WorldPop (sekitar 100 m) yang titik tengahnya berada dalam radius 500 m dan 1 km dari titik proyek; kepadatan = jumlah dalam 1 km dibagi luas lingkaran 3,14 km2.",
        "caveats": [
            "Estimasi model penduduk tempat tinggal, bukan hasil sensus atau registrasi penduduk.",
            "Tidak menggambarkan keramaian siang hari, pengunjung, atau arus komuter.",
            "Ketelitian mengikuti titik proyek; titik kawasan atau pin portal dapat bergeser dari lokasi unit.",
        ],
        "radiiKm": list(RADII_KM),
        "properties": dict(sorted(values.items())),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n")
    print(f"Ditulis {args.output}: {len(values)} proyek, sha256 raster {digest[:12]}")


if __name__ == "__main__":
    main()
