# Data KRL Jabodetabek

`public/data/transit.geojson` adalah snapshot geografis **29 Oktober 2026** untuk konteks pencarian hunian. Berisi **80 stasiun unik** dan **6 fitur jalur**: lima keluarga lintas KRL dengan cabang Nambo sebagai fitur tersendiri. Tidak memuat jadwal, tarif, waktu tempuh, status layanan, atau posisi kereta.

## Sumber dan lisensi

Koordinat stasiun dan geometri rel berasal dari **OpenStreetMap contributors**, dengan lisensi [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Tampilkan atribusi yang terlihat pada peta: [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Berkas GeoJSON ini adalah salinan turunan data OSM yang tersedia untuk diunduh; pertahankan informasi sumber dan lisensinya saat dibagikan atau diperbarui.

| ID jalur        | Sumber relasi OSM                                                                                              | Stasiun dalam cakupan |
| --------------- | -------------------------------------------------------------------------------------------------------------- | --------------------: |
| `bogor`         | [16877210 — Jakarta Kota–Bogor](https://www.openstreetmap.org/relation/16877210)                               |                    24 |
| `nambo`         | [16877211 — Jakarta Kota–Nambo](https://www.openstreetmap.org/relation/16877211)                               |                    24 |
| `cikarang`      | [2922163 — lintas lingkar Cikarang](https://www.openstreetmap.org/relation/2922163)                            |                    26 |
| `rangkasbitung` | [15094546 — Tanah Abang–Rangkasbitung](https://www.openstreetmap.org/relation/15094546), dipotong di Tigaraksa |                    16 |
| `tangerang`     | [17193463 — Duri–Tangerang](https://www.openstreetmap.org/relation/17193463)                                   |                    11 |
| `tanjung-priok` | [17193008 — Jakarta Kota–Tanjung Priuk](https://www.openstreetmap.org/relation/17193008)                       |                     5 |

Jumlah per jalur mencakup stasiun transit yang dipakai bersama. Setiap stasiun hanya memiliki satu fitur `Point`, berdasarkan ID node stasiun fisik OSM; node `stop_position` untuk masing-masing arah atau peron tidak dijadikan stasiun terpisah. Setiap fitur menyediakan tautan `source` langsung ke objek OSM asal.

Sebagai pemeriksaan konteks lintas, situs [KAI Commuter](https://commuterline.id/) dan [peta lintas dalam laporan perusahaan](https://www.commuterline.id/files/download/annual_report/AR%20KCI%2019082024%20LR%20-%20LK%20under%2010MB.pdf) dirujuk. Dokumen resmi tersebut adalah referensi historis, bukan validasi jadwal atau layanan tahun 2026. Halaman situs resmi mengalami timeout saat pengambilan; cuplikan dokumen yang terindeks tetap mengonfirmasi keluarga lintas serta reaktivasi Pondok Rajeg pada Oktober 2024.

## Bentuk geometri dan batas cakupan

- Fitur jalur memakai `MultiLineString` dari koordinat node pada anggota `way` berjenis `railway=rail` di relasi OSM. Nilai `geometryKind` adalah `osm-railway`. Geometri tidak dibuat dengan menarik garis lurus antarstasiun. Segmen terpisah dan jalur paralel dipertahankan; tidak ada sambungan buatan pada celah sumber.
- Jalur Bogor dan Nambo berbagi koridor Jakarta Kota–Citayam. Keduanya boleh bertumpuk pada peta dan memiliki warna keluarga yang sama. Cikarang menyertakan koridor lingkar utara dan selatan sesuai relasi sumber.
- Lintas Rangkasbitung hanya ditampilkan sampai node pemberhentian **Tigaraksa**. Atribut `clippedAt` dan `coverageNote` menjelaskan bahwa lintas sebenarnya berlanjut ke Rangkasbitung. Batas ini adalah batas tampilan awal, bukan batas administratif Jabodetabek.
- Titik stasiun adalah posisi node stasiun pada OSM, bukan koordinat pintu masuk. Jarak lurus dari listing ke titik ini tidak boleh ditampilkan sebagai jarak berjalan kaki atau waktu perjalanan.
- Daftar pemberhentian relasi OSM dapat tertinggal. [Pondok Rajeg](https://www.openstreetmap.org/node/1228345121) dan [Jakarta International Stadium](https://www.openstreetmap.org/node/5726702622) ditambahkan dari node stasiun OSM pada koridor yang sama; atribut `mappingNote` mencatat perbedaan ini. Dataset tidak menjanjikan kelengkapan informasi operasional.
- MRT, LRT, kereta bandara, dan angkutan lain belum termasuk. Bounding box aktual berurutan `[west, south, east, north]` adalah `[106.4330918, -6.5942887, 107.1457636, -6.1105573]`.

## Skema

Koleksi berupa GeoJSON `FeatureCollection`, dengan `bbox` dan `metadata` yang menyimpan tanggal snapshot, atribusi, tautan lisensi, batas cakupan, serta versi dan waktu perubahan setiap relasi OSM.

| Jenis fitur               | Atribut                                                                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stasiun (`Point`)         | `id: string`, `name: string`, `mode: "KRL"`, `lines: string[]`, `source: string`; opsional `osmName`, `mappingNote`                                                                                 |
| Jalur (`MultiLineString`) | `id: string`, `name: string`, `mode: "KRL"`, `color: string`, `geometryKind: "osm-railway"`, `source: string`, `stationIds: string[]`, `snapshotDate: string`; opsional `clippedAt`, `coverageNote` |

ID stasiun mengikuti format `osm-node-<id>`. Semua ID dalam `lines` merujuk ke ID fitur jalur; `stationIds` merujuk kembali ke fitur stasiun. Urutan daftar stasiun Cikarang mengikuti relasi lintasan lingkar dengan kemunculan ulang stasiun yang sama dihapus, sehingga bukan representasi jadwal perjalanan.

## Cara memperbarui

1. Ambil relasi sumber sebagai JSON melalui `https://api.openstreetmap.org/api/0.6/relation/<id>/full.json`. Pilih hanya anggota `way` rel dan `node` pemberhentian. Simpan versi dan timestamp relasi tanpa nama atau ID pengguna penyunting.
2. Ambil node stasiun publik dalam area awal menggunakan [Overpass API](https://overpass-api.de/api/interpreter) dengan kueri `[out:json][timeout:40];node["railway"="station"](-6.65,106.40,-6.06,107.18);out body;`. Cocokkan nama pemberhentian dengan stasiun beratribut `train=yes`; periksa juga node tambahan yang disebut di atas. Jangan masukkan stasiun MRT/LRT bernama sama.
3. Gabungkan ke satu fitur per ID node stasiun, gunakan koordinat `[longitude, latitude]`, dan potong lintas barat pada node pemberhentian Tigaraksa `10312804556`. Pertahankan geometri rel dari sumber.
4. Perbarui `snapshotDate`, versi sumber, jumlah fitur, dan dokumentasi. Cek perubahan layanan ke operator sebelum menambahkan klaim operasional apa pun.

Validasi snapshot ini memeriksa parsing GeoJSON, 86 ID fitur unik, 80 nama stasiun unik, referensi timbal balik stasiun–jalur, semua koordinat dalam kotak awal `[106.35, -6.85, 107.30, -6.0]`, serta kehadiran tunggal Manggarai, Depok Baru, Bogor, Tangerang, dan Bekasi. Dataset berukuran sekitar 135 KB tanpa paket tambahan atau permintaan data langsung dari browser.
