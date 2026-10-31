# Pengumpulan data dan akses agen AI

Diperiksa **31 Oktober 2026 WIB**. Rekomendasi untuk proyek ini: gunakan Bright Data untuk akuisisi Instagram, lalu pertahankan normalisasi, deduplikasi, bukti sumber, dan kurasi di aplikasi sendiri. Untuk situs developer, mulai dari HTTP dan parser; gunakan browser hanya bila konten memerlukannya.

## Pilihan alat pengumpulan

| Kebutuhan                                            | Pilihan awal                                                            | Hasil dan batas                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Caption dan tautan unggahan Instagram publik         | Instagram Scraper API                                                   | JSON terstruktur; tetap periksa error per input, batas jumlah unggahan, dan relevansi sumber. |
| Menemukan situs, proyek, atau akun organisasi        | SERP API                                                                | Hasil pencarian sebagai petunjuk; halaman sumber tetap perlu dibuka.                          |
| Membaca halaman HTML                                 | HTTP biasa, kemudian Web Unlocker bila diperlukan dan diizinkan         | Parser isi properti tetap menjadi tanggung jawab aplikasi.                                    |
| Konten JavaScript, pagination atau interaksi browser | Playwright lokal; Browser API bila memerlukan browser kelolaan penyedia | Interaksi dan ekstraksi tetap perlu dirancang untuk situs target.                             |

[Dokumentasi produk Bright Data](https://docs.brightdata.com/left-over/scraping-automation-introduction) menjelaskan perbedaan SERP, Unlocker, dan Browser API. [Instagram Scraper API](https://docs.brightdata.com/products/scrapers/instagram/introduction) menyediakan parser Instagram yang dipelihara penyedia.

Menurut [ketentuan free tier yang diperiksa](https://docs.brightdata.com/general/account/billing-and-pricing/free-tier), 5.000 kredit bulanan dipakai bersama: Scraper API satu kredit per record, SERP/Unlocker satu kredit per request, dan Browser API lima kredit per MB. Jumlah kuota akun dikonfirmasi pengguna; sisa kredit serta potongan aktual belum tersedia dari key baca billing yang dipakai. Jangan menganggap 5.000 kredit sebagai 5.000 sesi browser atau jatah terpisah untuk setiap produk.

Repositori sudah memakai Node/TypeScript dan Playwright untuk pengujian browser. Worker TypeScript dapat memakai perangkat tersebut tanpa menambah runtime baru. [Go chromedp](https://github.com/chromedp/chromedp) juga dapat mengendalikan browser melalui Chrome DevTools Protocol; pilihan bahasa tersebut belum menghilangkan kebutuhan menangani perubahan halaman, sesi, batas akses, dan kualitas data. Belum ada implementasi crawler Go atau crawler browser umum.

## Alur data yang disarankan

1. Temukan URL dan batasi akun/domain target; untuk uji Instagram awal gunakan watchlist organisasi serta maksimum sepuluh unggahan per akun.
2. Ambil dengan adapter sumber yang sesuai. Simpan ID job agar proses yang menunggu dapat dilanjutkan tanpa memulai job duplikat.
3. Normalisasi menjadi kandidat: sumber/permalink, tanggal unggahan dan pengambilan, harga beserta satuannya, lokasi tertulis, serta cuplikan bukti kajian/pendidikan. Hapus kontak sebelum ekstraksi harga. Pisahkan unggahan duplikat dari pencocokan proyek/unit.
4. Periksa alamat, harga dan stok, status fasilitas, serta tanggal kegiatan. Harga dalam poster dan suara video memerlukan pembacaan tambahan; caption saja belum mencakup semuanya.
5. Masukkan hasil terverifikasi melalui alur kurasi dan pembangunan dataset yang sudah ada. Akuisisi tidak langsung menerbitkan listing.

[Importer Instagram](../scripts/instagram-import.ts) sudah menjalankan sebagian langkah normalisasi untuk Bright Data/Apify. Hasilnya kandidat privat, bukan katalog publik. [Uji gratis](instagram-free-pilot.md) mencatat hasil akuisisi aktual. Worker terjadwal dan penerbitan otomatis belum diaktifkan.

## Akses agen AI yang sudah tersedia

Agen dengan alat HTTP dapat membaca [dataset publik](https://rumah.faizmuttaqin.com/data/properties.geojson) langsung. Pemeriksaan nyata memberikan HTTP 200, sekitar 0,92 MB, dan 106 proyek di `features[].properties`. Data mencakup `id`, `name`, `area`, `price`, `islamic`, `sources`, `lastChecked`, serta tautan sumber. Sewa, petunjuk, dan iklan dijual terdapat pada bagian terpisah di `metadata`; jumlah proyek bukan jumlah semua jenis entri.

Halaman [/riset](https://rumah.faizmuttaqin.com/riset) dirender JavaScript. Browser dapat membaca halaman tersebut, sedangkan pengolahan JSON lebih langsung untuk penyaringan wilayah, harga, dan bukti fasilitas. Agen menelusuri URL pada `sources` dengan alat HTTP/browser miliknya; kemampuan mengakses situs asal tetap bergantung situs dan alat itu. Situs tetap memakai `noindex, nofollow, noarchive`; URL langsung ini tidak memerlukan pengindeksan mesin pencari.

Listingku dan pin pribadi memakai API dengan autentikasi serta kepemilikan pengguna. Endpoint tersebut tidak menjadi dataset publik untuk agen anonim.

## Kapan menambah MCP

Saat ini **belum ada server MCP**. JSON publik sudah cukup untuk agen yang dapat melakukan HTTP dan memproses hasil. MCP berguna bila klien agen memerlukan penemuan alat standar dan jawaban ringkas tanpa memuat seluruh GeoJSON.

Rancangan opsional berikut belum diimplementasikan:

- `search_properties`: filter wilayah, rentang harga, bukti kajian/pendidikan, dan batas hasil.
- `get_property`: rincian satu ID proyek beserta ketidakpastian dan tanggal pemeriksaan.
- `get_sources`: sumber dan bukti untuk satu ID proyek, sehingga agen dapat memeriksa halaman asal.

Adapter pertama dapat membaca dataset publik yang sama dan menyediakan operasi baca saja. Jika kelak mengakses data pribadi, pertahankan autentikasi dan batas kepemilikan yang sudah ada. [Arsitektur MCP](https://modelcontextprotocol.io/docs/learn/architecture) memisahkan host, client, dan server penyedia alat/data: MCP bukan crawler, dan memasangnya tidak otomatis memberikan akses Instagram atau kemampuan mengikuti seluruh tautan eksternal.
