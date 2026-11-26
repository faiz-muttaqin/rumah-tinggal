# Batch P0-01 — validasi hunian dekat titik transit, 26 November 2026

## Hasil

- 10 desa/kelurahan × tiga kategori (30 dari 555 tugas P0, dari total 1.926 tugas baseline): Tenjo, Daru, Parungpanjang, Cikasungka, Rawabuntu, Lenteng Agung, Cibogor, Nambo, Sunter Agung, Tanjung Priok. Pencarian indeks per tugas; hasil agregat per batch adalah lead, bukan bukti alamat.
- 16 halaman pencarian portal dibaca; 106 halaman detail aktual dibaca (65 Pinhome, 35 Mamikos, 6 Jendela360); 36 URL detail menunggu batas batch, empat URL sebelumnya sudah tercatat. Hentikan portal saat diblokir; tidak ada bypass. Detail tambahan untuk validasi jenis hunian Pinhome dan alamat tiga gedung dibaca terpisah.
- **19 penawaran baru**: 7 kontrakan bulanan, 6 rumah sewa tahunan, 5 unit apartemen (kode unit berbeda), 1 kos keluarga campur yang mengizinkan pasutri dan anak menurut portal. 14 penawaran sesuai tugas wilayah/jenis yang dicari, lima temuan insidental masih di dalam radius P0. Katalog 860 → 879, berpin 847 → 866, berpin sesuai batas harga 744 → 763. Semua entri baru `partial`; stok/biaya akhir belum dikonfirmasi kepada pengiklan.
- **25 → 3** titik peta transit tanpa penawaran berpin dengan harga dasar ≤ Rp5 juta/bulan ekuivalen dalam 3 km. 22 titik memperoleh setidaknya satu penawaran; lingkaran saling tumpang tindih, bukan 22 properti atau stasiun beroperasi yang berbeda. Jarak garis lurus bukan jarak jalan. Apartemen dengan harga tahunan tetap membutuhkan pembayaran paket sesuai ketentuan, bukan otomatis dibayar bulanan. Harga belum termasuk IPL/deposit/utilitas jika tidak dinyatakan.
- 13 dari 30 tugas memiliki detail yang cocok dengan kode BIG dan jenis; 6 tugas memperoleh impor. Tidak satu pun dianggap tuntas/exhaustive. 1.896 tugas lain belum dicoba dalam batch ini. Snapshot baseline dan antrean awal tidak ditulis ulang.

### Seleksi detail

| Resolusi                                                        | Jumlah |
| --------------------------------------------------------------- | -----: |
| Diimpor, partial                                                |     19 |
| Kemungkinan duplikat                                            |      4 |
| Tanggal sumber terlalu lama (>365 hari)                         |     18 |
| Status tidak aktif/tidak terkonfirmasi dari detail              |     19 |
| Masalah sumber (harga/status/aturan penghuni/lokasi/penggunaan) |     37 |
| Label wilayah berbeda dengan pin BIG                            |      2 |
| Spesifikasi belum lengkap                                       |      2 |
| Kos khusus putra, bukan rumah utuh                              |      1 |
| Tanpa pin atau di luar gap 3 km                                 |      4 |
| Menunggu batas batch                                            |     36 |

Tiga gedung apartemen diverifikasi dengan sumber alamat dan batas BIG; Mahata Tanjung Barat dipasarkan dengan nama stasiun tetapi alamat pengembang berada di Lenteng Agung. Satu penawaran Perumnas I berada sangat dekat batas Cibunar–Parungpanjang; label portal dan pin cocok dengan Parungpanjang, lokasi bangunan/pintu akses tetap perlu dikonfirmasi. Kriteria duplikasi selain URL kanonik menguji kategori, spesifikasi, jarak ≤100 m, serta harga ekuivalen selisih ≤10%; calon yang meragukan ditahan. Ini bukan identifikasi pasti unit/bangunan.

### Banjir

Tambahan pada `flood-official-evidence-2026-11-26.json`:

- 3 titik kejadian historis dari marker peta resmi Siaga112 Pemkab Bogor (Tenjo 29 April 2026, Ciomas di Kecamatan Tenjo 18 April 2026, Cibunar 30 November 2025); lokasi marker dicocokkan dengan batas BIG. 15 titik resmi dalam berkas dan dua titik lama pada peta, total 17 pin banjir.
- 5 laporan tanpa koordinat terverifikasi dari BPBD DKI (Tanjung Priok, Sunter Agung, Sungai Bambu, Pademangan Barat pada 18 Januari 2026; Lenteng Agung 4 Maret 2025). Total 38 laporan wilayah resmi. Jangan pakai centroid desa sebagai pin kejadian.
- Rilis Pemkab Tangerang 24 November 2026 mencantumkan kewaspadaan hujan untuk beberapa kecamatan termasuk Jambe dan Solear; bukan kejadian atau kelas bahaya suatu unit. Disimpan sebagai rujukan sumber, bukan pin.
- Screening ulang seluruh 879 penawaran: 866 berpin, 863 dipetakan pada batas BIG, 9 punya titik resmi dalam 1 km, 96 dalam 3 km, 74 memiliki laporan satu desa/kelurahan. Dari 19 penawaran baru, dua dekat kejadian resmi ≤1 km dan tujuh cocok dengan wilayah laporan historis (tidak harus saling terpisah). Semua 879 kelas bahaya tetap `unknown`. Tidak adanya catatan bukan tanda aman.

## Lanjutan antrean

1. Selesaikan 36 URL detail pending dalam batch berikutnya dengan pacing dan robots, kemudian skrining ulang hasil yang ditahan bila ada bukti baru.
2. Tiga titik tanpa kandidat anggaran: KRL Jatake (Kadu Sirung, Jatake, Cisauk, Mekar Wangi, Dangdang, Situ Gadung); KRL Nambo (Bantarjati, Gunungputri, Nambo, Citeureup, Tlajung Udik, Lulut); TJ Pluit (Pluit, Penjaringan, Pejagalan, Kapuk Muara dan sekitar). Periksa status operasi aktual, khususnya titik rencana/alih nama; keberadaan pin tidak membuktikan layanan kereta.
3. Lanjutkan P0 sisanya, refresh prioritas dari katalog baru (hindari pengulangan URL yang sudah dibaca) kemudian P1 untuk kategori yang masih kosong, P2 jarak 1 km dan P3. Dokumen koridor yang belum tercakup tetap backlog untuk pencocokan URL dan validasi detail.
4. Lanjutkan validasi BPBD setempat dan akses layer bahaya/risiko resmi dengan resolusi sesuai kebutuhan. Riwayat, kesiapsiagaan, bahaya, akses, dan risiko bangunan harus tetap dipisahkan.

## Reproduksi

```sh
python3 -I scripts/corridor_priority_batch.py research/koridor-p0-batch-01-seeds-2026-11-26.json --output .runtime/research/p0-batch-01/plan.json
python3 -I scripts/corridor_priority_batch.py research/koridor-p0-batch-01-seeds-2026-11-26.json --run --max-details 65 --max-cards 4 --output .runtime/research/p0-batch-01/live.json
python3 -I scripts/corridor_priority_curate.py .runtime/research/p0-batch-01/live.json research/koridor-p0-batch-01-seeds-2026-11-26.json --output .runtime/research/p0-batch-01/proposals.json
python3 -I scripts/build-properties.py
python3 -I scripts/test_station_flood_research.py
```

Tanpa `--run` crawler menghasilkan plan saja. Curator membaca cache BIG (mengambil polygon resmi apabila belum tersedia) dan menghasilkan usulan, tidak mengubah katalog. Hasil langsung bergantung pada waktu akses, katalog dan snapshot kandidat sebelumnya; eksekusi ulang mengabaikan URL yang sudah dibaca. `koridor-p0-batch-01-results-2026-11-26.json` adalah ledger aktual dengan status, pin publik, hash respons, review penggunaan, sumber alamat, tugas dan cakupan sebelum/sesudah; raw HTML/geometri BIG tidak disimpan di Git. Impor diputuskan setelah pemeriksaan manual.
