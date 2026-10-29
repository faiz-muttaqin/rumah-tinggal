# Data transportasi Jabodetabek

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
- File KRL ini tidak mencampurkan moda lain; MRT, LRT, dan koridor utama TransJakarta tersedia pada `mobility.geojson` yang dijelaskan di bawah. Kereta bandara belum termasuk. Bounding box KRL aktual berurutan `[west, south, east, north]` adalah `[106.4330918, -6.5942887, 107.1457636, -6.1105573]`.

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

## MRT, LRT, dan TransJakarta

`public/data/mobility.geojson` adalah snapshot OSM **29 Oktober 2026**: 18 fitur jalur dan 293 titik pemberhentian (13 MRT, 29 LRT, 251 TransJakarta). Lisensi ODbL dan atribusi OSM yang sama berlaku pada file ini. Ini adalah geometri komunitas, bukan daftar layanan resmi, jadwal, tarif, atau bukti sebuah halte/stasiun sedang melayani penumpang.

MRT/LRT awalnya terlihat dan memiliki toggle tersendiri; TransJakarta awalnya tersembunyi. Lapisan LRT mencakup LRT Jakarta dan LRT Jabodebek, tetap dibedakan nama jaringan dan warna lintas. TransJakarta hanya mencakup **14 koridor utama BRT**, tanpa rute lintas-koridor, pengumpan, Mikrotrans, atau Transjabodetabek. Legenda dapat dibuka bila dibutuhkan. Pencarian stasiun/halte mencakup semua moda dan mengaktifkan lapisan yang dipilih. Filter jarak, pengurutan, dan jarak pada kartu hunian tetap menyebut **KRL** secara eksplisit.

### Relasi sumber yang dipin

| ID                | Lintas                    | Titik unik pada lintas | Sumber master OSM                                           |
| ----------------- | ------------------------- | ---------------------: | ----------------------------------------------------------- |
| `mrt-north-south` | MRT Utara–Selatan         |                     13 | [9677671](https://www.openstreetmap.org/relation/9677671)   |
| `lrt-jakarta`     | LRT Jakarta · Lin Selatan |                     11 | [10693161](https://www.openstreetmap.org/relation/10693161) |
| `lrt-cibubur`     | LRT Jabodebek · Cibubur   |                     12 | [16035222](https://www.openstreetmap.org/relation/16035222) |
| `lrt-bekasi`      | LRT Jabodebek · Bekasi    |                     14 | [16079480](https://www.openstreetmap.org/relation/16079480) |
| `tj-1`            | TransJakarta Koridor 1    |                     26 | [16739342](https://www.openstreetmap.org/relation/16739342) |
| `tj-2`            | TransJakarta Koridor 2    |                     23 | [6783311](https://www.openstreetmap.org/relation/6783311)   |
| `tj-3`            | TransJakarta Koridor 3    |                     14 | [17027439](https://www.openstreetmap.org/relation/17027439) |
| `tj-4`            | TransJakarta Koridor 4    |                     17 | [14717457](https://www.openstreetmap.org/relation/14717457) |
| `tj-5`            | TransJakarta Koridor 5    |                     18 | [16871390](https://www.openstreetmap.org/relation/16871390) |
| `tj-6`            | TransJakarta Koridor 6    |                     20 | [17011751](https://www.openstreetmap.org/relation/17011751) |
| `tj-7`            | TransJakarta Koridor 7    |                     15 | [16035086](https://www.openstreetmap.org/relation/16035086) |
| `tj-8`            | TransJakarta Koridor 8    |                     27 | [17027438](https://www.openstreetmap.org/relation/17027438) |
| `tj-9`            | TransJakarta Koridor 9    |                     39 | [16935599](https://www.openstreetmap.org/relation/16935599) |
| `tj-10`           | TransJakarta Koridor 10   |                     25 | [17003245](https://www.openstreetmap.org/relation/17003245) |
| `tj-11`           | TransJakarta Koridor 11   |                     16 | [17004173](https://www.openstreetmap.org/relation/17004173) |
| `tj-12`           | TransJakarta Koridor 12   |                     26 | [16873303](https://www.openstreetmap.org/relation/16873303) |
| `tj-13`           | TransJakarta Koridor 13   |                     15 | [13251860](https://www.openstreetmap.org/relation/13251860) |
| `tj-14`           | TransJakarta Koridor 14   |                     10 | [16732070](https://www.openstreetmap.org/relation/16732070) |

Setiap fitur jalur mencantumkan `routeRelations` untuk kedua arah yang dipakai. `metadata.relationVersions` menyimpan versi, waktu perubahan, dan SHA-256 JSON masukan setiap master/rute. Nama pengguna, ID editor, changeset, dan metadata penyunting tidak disalin ke dataset publik.

### Transformasi dan batas ketelitian

- Geometri jalur berasal dari anggota `way` rel/jalan masing-masing arah, digabung berdasarkan ID way. Tidak menarik garis lurus antarstasiun, tidak menutup celah, dan tidak memasukkan jalan yang berstatus `highway=construction` atau rel yang bukan `subway`/`light_rail`. Tiga anggota way nonoperasional pada snapshot ini dilewati (dua di koridor1, satu di koridor4); celah geometri dipertahankan.
- Titik MRT/LRT memakai `stop_position` dari relasi rute. Titik TransJakarta memakai anggota `platform`; jika berupa way, titik adalah rata-rata vertex unik platform. Titik tersebut bukan pintu masuk atau hasil survei alamat.
- Nama sama dalam jaringan/moda yang sama dan berjarak ≤350 meter digabung dari dua arah. Koordinat representatif pertama dipertahankan; semua objek asal dicatat di `sources`. Nama sama yang berjauhan tetap berbeda. Dua jaringan LRT tidak digabung, termasuk stasiun bernama sama.
- Jalur Cibubur dan Bekasi berbagi delapan titik LRT Jabodebek pada koridor Dukuh Atas–Cawang. LRT Jakarta pada relasi snapshot ini mencakup Kelapa Gading–Manggarai, 11 titik. Periksa operator untuk status operasi dan nama komersial terkini; aplikasi tidak menyatakan kesiapan layanan dari geometri saja.
- Warna jalur mengikuti palet relasi, dengan beberapa warna koridor bus digelapkan untuk keterbacaan pada latar terang. Popup memperlihatkan jaringan, koordinat, dan tautan lokasi Google Maps.

Konteks operator diperiksa pada [MRT Jakarta](https://bisnis.jakartamrt.co.id/location), [pelayanan LRT Jakarta](https://www.lrtjakarta.co.id/service), [peta LRT Jabodebek](https://lrtjabodebek.kai.id/informasi-peta-rute), dan [rute TransJakarta](https://www.transjakarta.co.id/rute). Halaman LRT Jabodebek hanya tersedia melalui cuplikan terindeks saat pemeriksaan (akses halaman403); gambar peta LRT Jakarta yang ditautkan operator gagal verifikasi rantai TLS. Geometri tidak diambil dari gambar atau peta operator, dan sumber tersebut tidak dipakai sebagai bukti status layanan real-time. ID master awal ditemukan lewat wiki OSM, lalu dikonfirmasi ke API inti OSM; MRT memakai master9677671 yang berisi relasi layanan, bukan master infrastruktur9434553.

### Membangun ulang snapshot tambahan

1. Unduh `https://api.openstreetmap.org/api/0.6/relation/<id>/full.json` untuk master yang tercantum pada `SPECS`/`TJ_MASTERS` dalam `scripts/build-mobility.py`, lalu setiap child relation rutenya, ke direktori lokal yang di-ignore dengan nama `relation-<id>.json`. Maksimal tiga request bersamaan cukup; cache respons yang sudah didapat.
2. Jalankan `python3 scripts/build-mobility.py INPUT_DIR public/data/mobility.geojson --snapshot YYYY-MM-DD`. Script hanya memakai stdlib Python, tidak membuat request, dan tidak membutuhkan paket baru.
3. Tinjau perubahan geometri/nama dan dokumentasi. Validasi ID unik, koordinat cakupan, referensi timbal balik stop–jalur, 14 koridor BRT, dan uji toggle render sebenarnya di browser. Jangan menyimpan raw JSON API yang memuat editor metadata ke Git.
