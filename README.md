# Rumah Tinggal

Eksplorasi calon hunian Jabodetabek melalui peta wilayah dan akses KRL, dengan koleksi pribadi setelah login Google. Implementasi memakai TypeScript tanpa framework UI, MapLibre, Vite, Firebase Authentication, dan backend HTTP bawaan Node.js dengan SQLite.

## Fitur tahap pertama

- Peta interaktif dengan 14 batas kabupaten/kota, dikelompokkan menjadi Jakarta, Bogor, Depok, Tangerang, dan Bekasi.
- Lapisan geografis 80 stasiun KRL dan geometri rel OpenStreetMap; pencarian stasiun serta fokus lokasi pada peta.
- Toggle bangunan dan marker/detail hunian secara terpisah, dengan jalan tetap terlihat. Bangunan awalnya disembunyikan dan tersedia saat zoom mendekat.
- Tautan Google Maps dari detail hunian: lokasi, rute ke hunian, serta rute berjalan ke stasiun terdekat. Jarak dan waktu rute diperiksa di Google Maps.
- Filter wilayah, anggaran beli, jenis hunian, dan jarak garis lurus ke stasiun; pengurutan harga atau jarak KRL.
- Delapan contoh hunian sintetis untuk mencoba antarmuka. Semuanya ilustrasi, bukan iklan atau penawaran properti.
- Listingku: tambah lokasi dan catatan survei, simpan contoh sebagai titik awal, serta hapus listing. Data disimpan di SQLite per UID pengguna terverifikasi.
- Setiap akun dapat menyimpan hingga 500 listing; menghapus listing membuka slot kembali.
- Tampilan responsif dengan pilihan daftar/peta pada layar kecil. Daftar tetap dapat digunakan jika WebGL tidak tersedia.

Belum ada katalog properti nyata, pengambilan iklan otomatis, jadwal/tarif KRL, atau perhitungan rute/waktu tempuh di dalam aplikasi. Jarak pada kartu adalah garis lurus ke titik stasiun OSM. Tautan Google Maps memakai koordinat hunian dan titik stasiun, bukan pintu masuk yang telah diverifikasi. Integrasi popup Google sudah dibuat; alur OAuth Google nyata belum diuji melalui browser karena pengaturan domain masih perlu diselesaikan.

Lihat [sumber batas wilayah](docs/data-sources.md) dan [sumber serta keterbatasan data KRL](docs/transit-data.md). Pola peta Nafkah dipakai sebagai referensi; analisis kode dengan Graphify dilakukan di direktori sementara dan keluarannya tidak dimasukkan repository.

## Menjalankan lokal

Toolchain proyek berada di `.tools/`, terpisah dari Node/npm global dan aplikasi lain di server. Pada checkout baru, sediakan npm dan Gitleaks di `PATH`, lalu:

```sh
sh scripts/bootstrap.sh
cp .env.example .env
chmod 600 .env
./dev run doctor
./dev build
./dev start
```

Buka `http://127.0.0.1:3100`. Backend melayani hasil build `dist/` dan `/api` pada loopback. Konfigurasi Firebase web lokal disimpan di `.env` yang diabaikan Git; isi sesuai project Firebase untuk mengaktifkan login. Jangan menimpa `.env` lokal yang sudah dikonfigurasi.

Untuk pengembangan dengan Vite, atur `.env` lokal secara eksplisit menjadi `APP_ORIGIN=http://127.0.0.1:3101`. Jalankan dua terminal:

```sh
./dev dev:api
```

```sh
./dev dev
```

Buka `http://127.0.0.1:3101`; Vite meneruskan `/api` ke backend port 3100. Untuk kembali menjalankan hasil build pada port 3100, ubah `APP_ORIGIN` menjadi `http://127.0.0.1:3100`. Untuk domain produksi, gunakan origin HTTPS final. Origin permintaan tulis harus cocok persis; tidak ada pengecualian autentikasi untuk mode pengembangan.

## Toolchain dan pemeriksaan

| Komponen       | Versi       | Peran                                                  |
| -------------- | ----------- | ------------------------------------------------------ |
| Node.js        | 26.13.0 LTS | HTTP server, eksekusi TypeScript native, SQLite bawaan |
| pnpm           | 12.16.1     | Package manager native, versi dipin                    |
| TypeScript     | 7.0.2       | Compiler native Go untuk pemeriksaan tipe              |
| Biome          | 2.6.4       | Formatter dan linter                                   |
| Vite           | 8.3.5       | Dev server dan build frontend                          |
| MapLibre GL JS | 6.16.0      | Peta WebGL                                             |
| Firebase       | 13.1.0      | Login Google di browser                                |
| jose           | 6.2.14      | Verifikasi Firebase JWT di backend                     |

```sh
./dev install --frozen-lockfile
./dev check
./dev test
./dev build
./dev test:e2e
```

Tes keamanan berjalan pada repository Git sementara; tes backend memakai token bertanda tangan offline, HTTP loopback, dan SQLite sementara. Tes browser memeriksa antarmuka publik; login Google nyata memerlukan pengujian terpisah setelah authorized domain/OAuth siap. Playwright memerlukan browser Chromium yang sesuai pada mesin pengujian.

Worker MapLibre 6 dibundel dan di-host bersama aplikasi. Peta jalan/bangunan memakai
tile vektor OpenFreeMap dengan atribusi OpenMapTiles dan OpenStreetMap; style ringkas
dibuat di aplikasi, tanpa API key. Wilayah/KRL tetap lokal saat tile tidak tersedia.
Tes browser memakai tile sintetis lokal dan memblokir seluruh request tile eksternal.
Playwright berjalan di port QA 13100 dengan database `.runtime/e2e`, terpisah dari
layanan produksi 3100. Lihat [catatan peta dasar](docs/data-sources.md#peta-dasar-dan-tautan-rute).

## Privasi dan Git

- `.env`, private key, JSON kredensial, database beserta WAL/SHM, backup, log, cache, dan toolchain lokal diabaikan Git. Hanya `/.env.example` boleh dipublikasikan, dengan nilai kosong atau konstanta lokal yang diizinkan.
- `data/` menyimpan SQLite privat; dua pengecualian tepat di `public/data/` adalah `regions.geojson` dan `transit.geojson`, yaitu dataset geografis publik dengan atribusi.
- Hooks menolak path privat yang dipaksa masuk index dan menjalankan Gitleaks dengan output tersensor. Isi `.env.example` diperiksa dari blob staged dan riwayat, sehingga working copy yang bersih tidak menyembunyikan nilai staged. Push memeriksa seluruh ref/riwayat lokal, termasuk file yang sudah dihapus.
- Aktifkan hooks pada setiap clone melalui bootstrap atau `node scripts/install-hooks.mjs`. Pemeriksaan manual: `./dev security:staged` dan `./dev security:history`. Jangan melewati hooks memakai `--no-verify`.

Pola pemindaian dan hooks lokal memiliki batas; tinjau perubahan staged sebelum push. Rahasia yang pernah masuk riwayat perlu dicabut/dirotasi dan riwayatnya dibersihkan. `.env` dan database proyek referensi tidak disalin. Backend tidak memakai private key service account atau OAuth client secret.

## Deployment

Domain produksi: **`https://rumah.faizmuttaqin.com`**. Service `rumah-tinggal` berjalan otomatis pada `127.0.0.1:3100` di belakang nginx. Login Google nyata tetap perlu diverifikasi dengan pengaturan domain Firebase/Google.

Lihat [login Google](docs/auth-google.md), [deployment server](docs/deployment.md), [template nginx](deploy/nginx.conf.example), dan [template systemd](deploy/rumah-tinggal.service.example). Template tetap memakai placeholder; konfigurasi aktif tersimpan di `/etc`. Agen yang bekerja pada checkout server ini membaca `AGENTS.md` dan `.context/` untuk status serta handoff lokal; keduanya diabaikan Git.
