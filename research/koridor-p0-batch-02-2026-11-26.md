# Riset P0 koridor — batch 02 (26 November 2026)

Lanjutan `koridor-p0-batch-01-2026-11-26.md`. Fokus data sewa (kontrakan/rumah, kos keluarga, apartemen) dan bukti banjir resmi, tanpa perubahan workflow, E2E, atau deploy.

## Lingkup dan hasil

- 30 tugas P0: Kadu Sirung, Jatake, Mekar Wangi, Dangdang, Bantarjati, Gunungputri, Citeureup, Pluit, Penjaringan, Pejagalan × tiga kategori. Empat pencarian tambahan dan penemuan URL publik dilakukan sebagai petunjuk, bukan bukti detail. Semua 36 URL pending batch 01 dibaca; 25 URL unik dari dokumen koridor lama yang belum tercatat/dibaca juga diperiksa.
- 19 halaman pencarian dicoba (18 terbaca, satu URL ditolak validator); 183 URL detail dicoba, 181 terbaca, dua error parser (Cisauk Point CSPA001 dan Kos Senada Cisauk). Tidak ada pending karena batas batch atau penghentian portal. 205 permintaan pada empat run provider (termasuk robots/search), dengan pacing dan kebijakan robots; tanpa bypass atau kontak pengiklan.
- 15 listing baru `partial`: **2 rumah sewa tahunan, 2 kos keluarga bulanan, 11 apartemen dengan paket 12 bulan**. Katalog 879 → 894; berpin 866 → 881; berpin dengan harga dasar ≤ Rp5 juta/bulan ekuivalen 763 → 778. Harga paket tahunan tidak berarti boleh dibayar bulanan. Konfirmasi IPL, deposit, utilitas, kebijakan penghuni, stok dan pembayaran.
- 10 tugas memiliki detail yang cocok dengan kode BIG dan kategori, enam memiliki impor. 60 tugas unik dari dua batch telah dicoba, **0** ditutup sebagai tuntas; 1.866 tugas lainnya belum dicoba dalam kedua batch, termasuk 495 tugas baseline P0. Snapshot dan antrean baseline tetap utuh.
- Semua 25 lead dokumen lama ditahan (14 status tidak aktif/tidak terkonfirmasi, tujuh masalah sumber, empat tanggal terlalu lama), nol impor dokumen. Seluruh 36 URL carryover juga selesai diperiksa tetapi ditahan (16 status, 15 masalah sumber, dua di luar anggaran, dua di luar lingkup/pin, satu tanggal). Jangan mengimpor hanya karena dokumen menyebutnya; audit ada pada ledger hasil.

### Resolusi dari 183 detail

| Resolusi                               | Jumlah |
| -------------------------------------- | -----: |
| Diimpor partial                        |     15 |
| Masalah sumber (lokasi/kebijakan/dll.) |     64 |
| Status tidak aktif atau belum terbukti |     56 |
| Tidak memenuhi lingkup/pin             |     23 |
| Tanggal detail terlalu lama            |     13 |
| Di luar anggaran                       |      6 |
| Kemungkinan duplikat                   |      2 |
| Spesifikasi belum lengkap              |      2 |
| Error detail                           |      2 |

## Cakupan transit

Tiga gap tersisa dari batch 01 sekarang memiliki penawaran berpin:

| Titik peta | Kandidat 3 km baru                | Contoh harga dasar             | Jarak garis lurus |
| ---------- | --------------------------------- | ------------------------------ | ----------------: |
| KRL Jatake | 1 rumah                           | Rp27 juta/tahun                |          1,877 km |
| KRL Nambo  | 1 rumah (Tlajung Udik)            | Rp15 juta/tahun                |          2,833 km |
| TJ Pluit   | 1 kos keluarga, 11 unit apartemen | Laguna Pluit Rp23,3 juta/tahun |          1,187 km |

KAI menyatakan Stasiun Jatake mulai beroperasi pada 28 Januari 2026 ([rilis KAI](https://www.kai.id/publikasi/siaran-pers/7185-stasiun-jatake-perkuat-akomodasi-mobilitas-wilayah-barat-jawa-melalui-pengembangan-layanan-bertahap)). Tidak menyimpulkan seluruh titik pada snapshot sedang beroperasi. Semua jarak adalah dari koordinat publik/gedung, bukan pintu rumah atau rute jalan kaki. Koordinat dan label wilayah dicocokkan terhadap poligon BIG; bukti alamat tambahan untuk Pluit Sea View dan Teluk Intan dicatat dalam seed/ledger. Unit apartemen berkode berbeda adalah penawaran terpisah, bukan 11 gedung.

| Mode         | Titik | Tanpa kandidat anggaran sebelum → sesudah | Tanpa rumah sesudah | Tanpa kos sesudah | Tanpa apartemen sesudah |
| ------------ | ----: | ----------------------------------------: | ------------------: | ----------------: | ----------------------: |
| KRL          |    80 |                                     2 → 0 |                   4 |                26 |                      23 |
| LRT          |    29 |                                     0 → 0 |                   2 |                 4 |                       6 |
| MRT          |    13 |                                     0 → 0 |                   0 |                 0 |                       4 |
| TransJakarta |   251 |                                     1 → 0 |                   5 |                33 |                      43 |
| Total        |   373 |                                     3 → 0 |                  11 |                63 |                      76 |

34 titik berubah cakupannya; radius tumpang tindih sehingga angka per mode/titik bukan jumlah properti unik. Tidak adanya gap kategori keseluruhan **bukan** bukti setiap kategori tersedia atau listing sudah diverifikasi pengiklan.

## Bukti banjir

- Tambah empat marker peta Siaga112/BPBD Pemkab Bogor yang dicocokkan dengan BIG: Karang Asem Barat (24 Mei 2024), Puspasari (4 Juli 2025), Puri Harmoni 9 dan Villa Asri Cileungsi 2 di Cikahuripan (7 Juli 2025). Total 19 titik resmi dalam evidence plus dua titik lama pada peta = **21 pin**.
- Tambah lima laporan jalan wilayah Penjaringan dari BPBD DKI pada 18 Januari 2026: Jl. Muara Baru di depan Pluit Sea View, Jembatan Tiga Raya, Pluit Selatan Raya, Pluit Raya, Nizam Zachman. Tidak dibuat pin sintetis. Total 43 laporan resmi tanpa koordinat terverifikasi. BPBD melaporkan genangan jalan depan Pluit Sea View 50 cm pukul 10.00 dan 30 cm pukul 18.00, surut pada laporan 19 Januari pukul 06.00; catatan akses jalan, bukan bukti banjir unit.
- Screening ulang 894 listing: 881 berpin; 878 cocok batas BIG; 15 punya titik kejadian resmi ≤1 km, 107 ≤3 km; 81 punya laporan satu kelurahan/desa. Dari 15 impor, enam memiliki titik resmi ≤1 km dan tujuh memiliki laporan satu kelurahan/desa; dapat tumpang tindih. Seluruh 894 tetap `hazardUnknown` — ketiadaan bukti kejadian **bukan** bukti bebas banjir.

## Prioritas lanjutan

1. Refresh prioritas berdasarkan katalog terbaru, bukan mengejar gap keseluruhan lama yang sudah terisi. Selesaikan kategori rumah yang masih kosong (11 titik), lalu kos keluarga (63) dan apartemen (76), khususnya Jatake dan Nambo yang hanya mempunyai satu rumah serta Pluit tanpa rumah. Pertahankan filter BIG, radius maksimum 3 km, status aktif dan aturan penghuni.
2. Lanjutkan 495 tugas baseline P0 yang belum dicoba, diikuti kategori P1, radius 1 km (P2), dan sisanya. Hitung satu tugas berdasarkan kode BIG × kategori, periksa koridor overlap sekali saja. Dua detail error dan satu URL pencarian ditahan untuk verifikasi sumber/adapter yang didukung, tanpa bypass. URL yang telah dibaca/waktu akses dan status terdokumentasi, bukan daftar penolakan permanen.
3. Periksa dokumen lain yang memiliki URL belum tercatat; impor hanya bila detail aktual lolos. Prioritaskan penawaran rumah bulanan dan kos campur yang secara eksplisit mengizinkan pasutri dan anak, karena penawaran batch ini didominasi paket tahunan.
4. Lanjutkan bukti resmi BPBD/Siaga112 dan verifikasi layer bahaya BNPB/InaRISK sesuai resolusi lokasi. Pisahkan riwayat kejadian, risiko unit, elevasi, dan akses jalan.

## Reproduksi

```sh
python3 -I scripts/corridor_priority_batch.py research/koridor-p0-batch-02-seeds-2026-11-26.json --output .runtime/research/p0-batch-02/plan.json
python3 -I scripts/corridor_priority_batch.py research/koridor-p0-batch-02-seeds-2026-11-26.json --run --max-details 90 --max-cards 3 --output .runtime/research/p0-batch-02/live.json
python3 -I scripts/corridor_priority_curate.py .runtime/research/p0-batch-02/live.json research/koridor-p0-batch-02-seeds-2026-11-26.json --include-task-matches --output .runtime/research/p0-batch-02/proposals.json
python3 -I scripts/flood_rental_screening.py --run --output research/flood-rental-screening-2026-11-26.json
python3 -I scripts/build-properties.py --check
python3 -I scripts/test_station_flood_research.py
```

Pass kedua dibuat dari `documentLeads` dalam seed (salin ke `seeds`, `sources: []`; keluarkan URL yang sudah terbaca pass pertama), maksimum 25 detail, hanya jika provider tidak berhenti; hasil kedua digabungkan dengan pass pertama sebelum curation. Ledger `koridor-p0-batch-02-results-2026-11-26.json` menyimpan hasil aktual kedua pass, status carryover/lead dokumen, bukti sumber, task dan cakupan per mode. Curator hanya membuat proposal. Eksekusi ulang pada katalog terbaru mengabaikan URL yang sudah dibaca; hasil pada waktu lain tidak dijamin sama. Tidak menyimpan HTML mentah atau detail kontak.
