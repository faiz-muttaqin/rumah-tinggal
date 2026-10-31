# Uji Instagram tanpa langganan berbayar

Diperiksa **31 Oktober 2026 WIB**. Uji langsung **Bright Data Scraper API Free** berhasil: 9 akun organisasi menghasilkan 79 unggahan dan 1 baris error; 14 unggahan lolos filter awal menjadi kandidat privat. Skrip Business Discovery resmi Meta tetap tersedia untuk jalur akun profesional/Page.

## Penawaran yang diperiksa

| Jalur                       | Penawaran pada sumber resmi                                                                                                                                                                                | Kebutuhan dan batas                                                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Meta Business Discovery     | [Koleksi resmi Meta](https://www.postman.com/meta/instagram/collection/6yqw8pt/instagram-api) mendokumentasikan metadata akun profesional lain dan media.                                                  | Tetap membutuhkan akun profesional sendiri, Facebook Page, aplikasi dan izin Meta. Koneksi proyek belum aktif. Pemeriksaan sumber ini belum memberi matriks harga/izin lengkap. |
| **Bright Data Scraper API** | [Halaman Instagram](https://brightdata.com/products/web-scraper/instagram) dan [harga Scraper API](https://brightdata.com/pricing/web-scraper) menampilkan **5.000 record per bulan, tanpa kartu kredit**. | Pengguna mengonfirmasi 5.000 kredit dan mengizinkan uji. Kuota dipakai bersama; potongan aktual belum diperiksa di dashboard.                                                   |
| Apify Free                  | [Harga platform](https://apify.com/pricing): **US$5 kredit per bulan**, tanpa kartu kredit. [Actor resmi Instagram](https://apify.com/apify/instagram-scraper): US$2,70/1.000 hasil pada Free plan.        | Jumlah hasil yang tercakup bergantung Actor dan penggunaan kredit. Angka promosi “from US$1,50” bukan harga Free plan.                                                          |
| HikerAPI                    | [Situs penyedia](https://hikerapi.com/) menampilkan **100 request uji** untuk akun baru.                                                                                                                   | Ini request, bukan jaminan jumlah postingan; harga US$0,60/1.000 dalam teks pengguna belum dikonfirmasi.                                                                        |

Penawaran Scraper API dan Scraper Studio berbeda: [FAQ Scraper Studio](https://docs.brightdata.com/datasets/scraper-studio/faqs) masih mencantumkan trial 100 record. Untuk rencana ini pilih **Instagram Posts di library Scraper API** yang menawarkan paket 5K, lalu pastikan kuota pada akun yang dipakai.

## Uji pertama yang dijalankan

Rencana: **9 akun organisasi × maksimal 10 unggahan = 90 record postingan yang diharapkan**. Target berasal dari [watchlist](../research/instagram-watchlist.json) yang tautannya ditemukan pada situs organisasi. Pengguna mengonfirmasi kuota 5.000 kredit dan meminta penggunaannya. Anggaran pembayaran tetap **Rp0**; tidak mengubah paket atau mengisi saldo.

Satu job REST berhasil diselesaikan. Percobaan CLI sebelumnya berhenti tanpa ID job; daftar snapshot kemudian diperiksa dan kosong sebelum memakai REST. Pengunduhan ulang snapshot yang sama dipakai untuk pemeriksaan dan perbaikan parsing, tanpa membuat job tambahan.

| Hasil                                      | Jumlah                                            |
| ------------------------------------------ | ------------------------------------------------- |
| Baris keluaran                             | 80                                                |
| Unggahan berhasil                          | 79                                                |
| Baris tidak tersedia                       | 1 (`ahsanuamala.id_`, dilaporkan tidak ditemukan) |
| Kandidat keluarga muslim                   | 14                                                |
| Dilewati karena pemilik di luar watchlist  | 17, semuanya memiliki data co-author              |
| Dilewati karena tidak cocok filter caption | 48                                                |

Kandidat berasal dari `ahsanuamalaproperti` (4), `maxirecon.official` (6), `bumisakinah_cileungsi` (1), `tkitnf_` (2), dan `sditnf_` (1). Akun lain tidak menghasilkan kandidat dalam batas uji, bukan bukti tidak ada properti/fasilitas relevan. Empat belas unggahan ini mencakup bukti pendidikan dan pemasaran proyek; bukan empat belas rumah atau proyek baru. Ada unggahan 2024–2025, sehingga penemuan dari profil tidak diasumsikan berurutan atau mutakhir.

Potongan kredit aktual belum terverifikasi karena key tidak memberi akses baca billing. Jangan mengurangi 5.000 dengan 80 lalu menyatakan sisa kredit pasti; ada satu baris error dan pemakaian produk lain mungkin memakai kuota bersama. [Free tier resmi](https://docs.brightdata.com/general/account/billing-and-pricing/free-tier) membedakan Scraper API (per record), SERP/Unlocker (per request), dan Browser API (5 kredit/MB).

Bahan lokal privat yang sudah disiapkan:

- `.runtime/instagram/pilot-profile-urls.txt`: 9 URL profil untuk dashboard.
- `.runtime/instagram/brightdata-pilot-input.json` dan `.csv`: input `url` dan `num_of_posts: 10`.
- `.runtime/instagram/pilot-plan.json`: cakupan uji; tidak mengandung token.
- `.runtime/instagram/brightdata-live-candidates.json`: kandidat tersaring berizin `600`; tidak disajikan situs.
- `.runtime/instagram/brightdata-live-summary.json`: ringkasan hasil dan batas pemeriksaan tanpa respons profil/komentar mentah.

Skema resmi [Instagram](https://docs.brightdata.com/scrapers/instagram.com.json) diperiksa: dataset Posts `gd_lk5ns7kz21pck8jpis`, metode `discover_by_url`, input `url`, `num_of_posts`, serta filter tanggal/jenis opsional. Identitas dataset dan input harus dicek kembali bila skema penyedia berubah.

Alternatif menjalankan batch lain melalui dashboard/ekspor:

1. Gunakan akun **Bright Data Free** yang sudah ada. Pastikan paket dan sisa kuota mencakup batch berikutnya; pembayaran atau saldo berbayar belum diotorisasi untuk pekerjaan ini.
2. Pilih **Instagram → Posts → discovery dari profile URL** pada library Scraper API. Masukkan input JSON/CSV yang disiapkan dan pastikan batas 10 unggahan per profil diterapkan.
3. Jalankan sekali setelah kuota di dashboard dipastikan. Akun privat, tidak ditemukan, atau hasil kosong tetap dicatat sebagai kegagalan akuisisi; jangan memperbesar cakupan otomatis untuk menggantinya.
4. Ekspor hasil **JSON atau NDJSON** ke `.runtime/instagram/brightdata-export.json` pada workspace privat. Untuk alur dashboard/ekspor ini, importer lokal tidak memerlukan API key. Uji API langsung memakai key hanya di memori proses, tanpa menyimpannya; pengambilan terjadwal belum dikonfigurasi.
5. Periksa impor tanpa menulis keluaran:

```sh
./dev exec node scripts/instagram-import.ts --provider brightdata --input .runtime/instagram/brightdata-export.json --dry-run
```

6. Simpan kandidat privat:

```sh
./dev exec node scripts/instagram-import.ts --provider brightdata --input .runtime/instagram/brightdata-export.json
```

Importer juga menerima ekspor postingan Actor Apify dengan `--provider apify`. Input Bright Data memakai `user_posted`, `description`, `date_posted`, `url`; Apify memakai `ownerUsername`, `caption`, `timestamp`, `url`. Profil, komentar, atau bentuk ekspor lain tidak diasumsikan sebagai postingan.

## Data untuk riset hunian

Importer hanya menerima akun organisasi di watchlist dan memakai filter keluarga muslim dari skrip yang sudah ada. Cuplikan caption, harga dalam teks, nama wilayah yang tertulis, sinyal kajian/pendidikan, waktu, jenis media dan permalink disimpan sebagai **kandidat untuk diperiksa**. Kontak di caption dihapus; field profil, komentar, metrik pengikut dan data tambahan tidak disalin. Link eksternal, akun privat yang ditandai penyedia, baris error dan duplikat disisihkan. Keluaran baru berizin `600` di `.runtime/instagram/`; tidak mengubah katalog atau situs.

Harga/lokasi tetap hasil pembacaan caption, bukan field properti resmi. Nama kota dalam caption atau label area akun belum membuktikan alamat rumah. Fasilitas rencana, kegiatan sekali jalan, kajian rutin, serta pendidikan anak harus diperiksa terpisah. Gambar poster atau suara video belum dibaca oleh importer ini.

Uji nyata menemukan format seperti `Rp900 jutaan` dan `800 Jt-an`. Parser diperbaiki agar satuan tersebut tetap utuh, angka bersatuan tanpa `Rp` terbaca, dan kontak dihapus sebelum ekstraksi pada kedua jalur. Teks harga juga dapat berupa DP atau promo; belum dinormalisasi menjadi harga unit yang terverifikasi.

Daftar metrik dalam jawaban Meta bukan jaminan semua field tersedia pada semua endpoint. Batas pencarian hashtag terpisah dari Business Discovery berdasarkan username; skrip proyek saat ini tidak memanggil pencarian hashtag. Angka 30 hashtag/7 hari belum dapat diperiksa langsung karena referensi Meta mengembalikan 429.

**Status terbaru:** autentikasi resmi dan akuisisi Instagram REST berhasil tanpa zone. Endpoint saldo dan tarif menjawab HTTP 403; angka kuota berasal dari konfirmasi pengguna, bukan API billing. [Dashboard billing](https://brightdata.com/cp/billing/overview) tetap menjadi tempat memeriksa sisa kredit. Key hanya digunakan di memori proses dan tidak disimpan. Hasil tersaring tetap privat; tidak ada listing baru yang diterbitkan atau jadwal otomatis. Lihat [pilihan pengumpulan data dan akses agen/MCP](property-agent-access.md) untuk pengembangan berikutnya.
