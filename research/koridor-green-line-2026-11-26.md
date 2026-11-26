# Riset sewa KRL Green Line / Lin Rangkasbitung — 26 November 2026

## Tujuan dan metode

Setelah batch P0 sebelumnya, periksa setiap titik lintas Green Line, **bukan memaksakan setiap stasiun memiliki listing**. Prioritaskan rumah kontrakan dan kos keluarga; apartemen tetap diperiksa pada area yang relevan. Batas harga dasar Rp5 juta/bulan ekuivalen, jarak maksimum 3 km garis lurus. Harga tahunan atau minimum kontrak beberapa bulan bukan pembanding biaya cash-flow bulanan yang setara.

- 20 kelompok stasiun: 16 dalam snapshot produksi sampai Tigaraksa dan empat titik tambahan (Cikoya, Maja, Citeras, Rangkasbitung). Jadwal resmi KAI Commuter Desember 2025 menunjukkan 19 stasiun sebelum Jatake; rilis KAI menambah Jatake yang beroperasi mulai 28 Januari 2026. Ini bukan jadwal perjalanan terkini.
- 60 kueri rumah/kos/halaman pencarian, 11 kueri apartemen, empat kueri tambahan di barat. Pencarian pertama menghasilkan 633 hasil indeks (bukan 633 listing unik). 119 URL detail langsung unik dan 26 halaman area/gedung dipilih, dengan URL yang sudah dibaca/katalog tidak diulang. 26 halaman pencarian dibaca dan menemukan 31 detail tambahan.
- 150 detail dicoba, 141 terbaca dan sembilan error parser; 179 permintaan termasuk tiga robots dan 26 halaman area; tidak ada stop-source atau pending akibat limit. Empat detail dari portal lain dibaca manual melalui hasil web dan disimpan sebagai lead tertahan, bukan diimpor tanpa pin.
- Pencarian dengan petunjuk kampus: BINUS Kemanggisan, Moestopo, UHAMKA Limau, PKN STAN, UPJ Bintaro, UBSI BSD, Prasetiya Mulya BSD, Atma Jaya BSD, Trisakti Karet Tengsin dan La Tansa Mashiro. Tautan halaman kampus resmi ada dalam seed. Nama kampus/gedung adalah petunjuk pencarian, bukan bukti bahwa unit atau kampus berada dalam 3 km. Kos tetap mensyaratkan kategori campur dan izin pasutri serta anak yang eksplisit.

## Hasil

- **22 impor baru partial:** 12 rumah (3 kontrakan bulanan, 9 rumah sewa tahunan) dan 10 unit apartemen (3 bulanan, 7 paket tahunan). Katalog 894 → 916; berpin 881 → 903; berpin anggaran 778 → 800. Tidak ada kos baru yang memenuhi seluruh syarat impor dalam produksi; bukan berarti tidak tersedia kos di sepanjang koridor.
- Dua kandidat **research-only** di Maja, juga dekat titik Cikoya: rumah 2 KT Rp1,2 juta/bulan (minimum 12 bulan; pin 1,30 km dari Maja) dan kos 9 m² Rp1 juta/bulan (campur, pasutri dan anak diizinkan menurut portal; pin 0,925 km dari Maja). Tidak dimasukkan ke peta produksi karena batas penelitian aplikasi dan schema area yang masih meliputi lima wilayah.
- Contoh rumah: Pondok Betung Rp900 ribu/bulan, minimum satu bulan (1,667 km ke Pondok Ranji); Singabangsa Rp1 juta/bulan, minimum tiga bulan dari detail live (1,470 km ke Tenjo); Cilaku Rp1,2 juta/bulan, minimum enam bulan (1,267 km ke Tenjo); Daru Rp10 juta/tahun (0,919 km ke Daru); Cikasungka Rp10,5 juta/tahun (2,241 km ke Tigaraksa dan 0,513 km ke Cikoya yang research-only). Harga dasar portal, stok, biaya, penggunaan rumah secara eksklusif, dan rute aktual perlu dikonfirmasi.
- Satu listing apartemen dengan luas sumber hanya 1 m² ditahan, satu detail dengan konflik Muara Ciujung Timur/Barat ditahan. Alamat empat gedung dicocokkan dengan BIG dan sumber gedung/pengembang/BTN.

### Resolusi crawl

| Resolusi                                         | Jumlah |
| ------------------------------------------------ | -----: |
| Masalah sumber (status/pin/aturan penghuni/dll.) |     26 |
| Status tidak aktif/tidak terbukti                |     53 |
| Error detail                                     |      9 |
| Kandidat research-only (di luar peta produksi)   |      2 |
| Diimpor partial                                  |     22 |
| Di luar anggaran                                 |     12 |
| Di luar radius atau tanpa pin                    |      9 |
| Tanggal sumber terlalu lama                      |     12 |
| Label dan batas BIG tidak cocok                  |      1 |
| Kemungkinan duplikat                             |      3 |
| Spesifikasi tidak masuk akal                     |      1 |

### Audit per titik stasiun

Detail terarah adalah URL dalam antrean dengan petunjuk stasiun tersebut, bukan bukti lokasi; detail pin 3 km adalah hasil geometri (juga termasuk penawaran yang ditahan). Kandidat dan angka katalog per titik dapat overlap; jangan dijumlahkan menjadi total unik. Kolom tambahan research-only tidak dihitung sebagai katalog.

| Titik         | Lingkup       | Detail terarah terbaca | Detail pin ≤3 km | Impor baru ≤3 km | Kandidat research-only ≤3 km | Katalog anggaran 3 km sebelum → sesudah |
| ------------- | ------------- | ---------------------: | ---------------: | ---------------: | ---------------------------: | --------------------------------------: |
| Tanah Abang   | production    |                      8 |               13 |                0 |                            0 |                                   8 → 8 |
| Palmerah      | production    |                     11 |               17 |                0 |                            0 |                                 18 → 18 |
| Kebayoran     | production    |                     10 |                7 |                2 |                            0 |                                 15 → 17 |
| Pondok Ranji  | production    |                     12 |               15 |                2 |                            0 |                                  9 → 11 |
| Jurangmangu   | production    |                     12 |               19 |                3 |                            0 |                                 29 → 32 |
| Sudimara      | production    |                     10 |               15 |                3 |                            0 |                                 49 → 52 |
| Rawa Buntu    | production    |                      9 |               11 |                3 |                            0 |                                   1 → 4 |
| Serpong       | production    |                      8 |               14 |                4 |                            0 |                                  9 → 13 |
| Cisauk        | production    |                     10 |               14 |                7 |                            0 |                                  8 → 15 |
| Cicayur       | production    |                      8 |                9 |                5 |                            0 |                                  5 → 10 |
| Jatake        | production    |                      8 |                1 |                1 |                            0 |                                   1 → 2 |
| Parungpanjang | production    |                      6 |                5 |                1 |                            0 |                                   1 → 2 |
| Cilejit       | production    |                      2 |                3 |                2 |                            0 |                                   1 → 3 |
| Daru          | production    |                      4 |                7 |                4 |                            0 |                                   3 → 7 |
| Tenjo         | production    |                      6 |                8 |                2 |                            0 |                                   2 → 4 |
| Tigaraksa     | production    |                      6 |                4 |                1 |                            0 |                                   5 → 6 |
| Cikoya        | research-only |                      1 |                3 |                1 |                            2 |                                   4 → 5 |
| Maja          | research-only |                      8 |                4 |                1 |                            2 |                                   1 → 2 |
| Citeras       | research-only |                      8 |                1 |                0 |                            0 |                                   0 → 0 |
| Rangkasbitung | research-only |                      3 |                2 |                0 |                            0 |                                   0 → 0 |

Untuk Tanah Abang, Palmerah, Citeras, dan Rangkasbitung tidak ada kandidat baru yang lolos seluruh filter dalam pass terbatas ini. Ledger menyimpan prior reference, hasil detail, dan resolusi. Cikoya juga memakai referensi pemeriksaan sebelumnya serta halaman pencarian lokal. Pencarian tidak exhaustive.

## Empat titik tambahan

Peta produksi secara eksplisit dipotong di Tigaraksa. Tanpa mengubah cakupan tampilan, file extension menyimpan empat stop_position dari [relasi OSM](https://www.openstreetmap.org/relation/15094546), versi 23 yang sama dengan metadata produksi; koordinat adalah acuan lintas rel, bukan pintu masuk stasiun. BIG dipakai untuk point-in-polygon dan jarak batas desa/kelurahan ≤3 km; 84 poligon dibaca pada bbox tambahan.

| Titik         | Desa/kelurahan      | Kecamatan     | Kabupaten | Kode BIG      |
| ------------- | ------------------- | ------------- | --------- | ------------- |
| Cikoya        | Cikasungka          | Solear        | Tangerang | 36.03.31.2003 |
| Maja          | Maja                | Maja          | Lebak     | 36.02.13.2006 |
| Citeras       | Mekarsari           | Rangkasbitung | Lebak     | 36.02.14.2014 |
| Rangkasbitung | Muara Ciujung Timur | Rangkasbitung | Lebak     | 36.02.14.1012 |

## Banjir

- Tambah 9 laporan lokasi/wilayah resmi Pemkot Tangsel dan DSDABMBK (Ciputat, Pondok Kacang Timur, Puskesmas Rawa Buntu, dua perumahan terdampak pada peninjauan Juni 2025, empat lokasi genangan Januari 2026). Tanggal bantuan atau peninjauan dibedakan dari waktu mula kejadian. Tiga lokasi secara eksplisit dicocokkan ke BIG; lainnya tidak diberi pin atau kode kelurahan tanpa bukti.
- Total 52 laporan resmi tanpa koordinat terverifikasi, 19 marker historis resmi + 2 titik lama = 21 pin peta (tidak bertambah karena tidak ditemukan koordinat kejadian baru). BPBD Lebak WebGIS memiliki catatan kejadian Maja Baru, tetapi tanggal/koordinat tidak dapat ditentukan dari tabel yang diakses; simpan URL penelitian, bukan titik atau laporan bertanggal.
- Screening 916 listing: 903 dengan pin, 900 sesuai batas BIG, 16 memiliki titik historis resmi ≤1 km, 111 ≤3 km, 86 mempunyai laporan wilayah sama. Semua hazard tetap unknown. Tidak ada klaim bebas banjir.

## Lanjutan

1. Pendalaman kelurahan di Green Line, terutama kos di area kampus dan kontrakan bulanan. Periksa empat lead manual Rumah123/Brighton/Realoka pada ledger jika tersedia pin publik, tanpa membuat titik dari centroid wilayah atau klaim iklan.
2. Lanjutkan audit per titik untuk KRL Cikarang/Blue Line, Bogor, Tangerang, kemudian MRT/LRT/TransJakarta; refresh hasil aktual, tidak perlu target minimum jumlah listing. Hindari URL yang telah dibaca pada hari sama.
3. Peta produksi masih terpotong di Tigaraksa. Kandidat di Lebak tersimpan di ledger; perlu memperluas transit+region schema bila ingin menampilkan semua titik dan kandidat luar cakupan. Ini tidak dikerjakan pada PR yang fokus data.
4. Antrean 1.926 tugas baseline kelurahan/kategori tetap utuh; pencarian stasiun ini bukan penutupan tugas queue. Lakukan batch lokalitas lanjut secara eksplisit.

## Berkas dan reproduksi

- `koridor-green-line-seeds-2026-11-26.json`: kueri, URL terpilih, referensi kampus, sumber alamat gedung, lead manual.
- `koridor-green-line-extension-2026-11-26.json`: 4 titik OSM research-only dan batas BIG.
- `koridor-green-line-results-2026-11-26.json`: respons turunan (hash, price/pin/status, jarak, resolusi), audit per stasiun dan kandidat.

```sh
python3 -I scripts/corridor_priority_batch.py research/koridor-green-line-seeds-2026-11-26.json --output .runtime/research/green-line/plan.json
python3 -I scripts/corridor_priority_batch.py research/koridor-green-line-seeds-2026-11-26.json --run --max-details 100 --max-cards 1 --output .runtime/research/green-line/live.json
python3 -I scripts/green_line_rental_curate.py research/koridor-green-line-seeds-2026-11-26.json .runtime/research/green-line/live.json --output .runtime/research/green-line/proposals.json
python3 -I scripts/flood_rental_screening.py --run --output research/flood-rental-screening-2026-11-26.json
python3 -I scripts/build-properties.py --check
python3 -I scripts/test_station_flood_research.py
```

Run aktual memisahkan Jendela360 (limit 40 detail, dua kartu per halaman area) dari Pinhome/Mamikos (limit 100 detail per provider, satu kartu per halaman area). Buat seed pass terpisah dari daftar provider pada seed ini dan gabungkan output live sebagai positional arguments curator. Curator membuat usulan, tidak otomatis mengubah katalog. Eksekusi ulang memakai pengecualian URL yang telah dibaca dan keadaan portal saat akses. Raw HTML, kontak pengiklan dan geometri BIG tidak disimpan dalam Git. Tidak ada E2E, workflow atau deploy pada batch ini.
