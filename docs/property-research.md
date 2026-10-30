# Riset properti dekat KRL, MRT, dan LRT

Halaman `/riset` dan tab **Riset** di peta menampilkan kurasi kandidat proyek hunian di sekitar stasiun KRL, MRT, dan LRT Jabodetabek. Status yang belum pasti diberi label sebagian terverifikasi. Setiap entri memiliki harga dari halaman sumber yang dibuka pada tanggal cek, tautan ke sumber asli, daftar bukti, dan tanggal pengecekan. Jarak ke stasiun dihitung aplikasi, bukan diambil dari klaim pemasaran.

Dokumen ini mencatat cara data ditemukan agar dapat dipakai ulang. Metode di sini **tidak wajib**: cara baru boleh dipakai selama mengikuti batas di bagian [Etika dan batas](#etika-dan-batas), lalu dicatat di katalog metode.

Perluasan berikutnya dicatat di [ruang riset hunian Jakarta](../research/jakarta/README.md): penambahan listing dan pengayaan banjir, kriminalitas, berita, Google Maps, populasi, serta arus komuter. Seluruh pengayaan tersebut masih rencana; pengguna akan menyusun delegasinya kemudian.

## Cakupan

- **Masuk:** proyek baru (rumah tapak atau apartemen/rusunami, termasuk subsidi dan TOD) yang sedang dipasarkan untuk dibeli, dengan titik proyek paling jauh **3 km garis lurus** dari salah satu stasiun dalam dataset aplikasi (80 KRL, 13 MRT, 29 LRT; lihat [data transportasi](transit-data.md)).
- **Belum dicakup oleh riset awal:** sewa, kos, ruko/komersial, kavling, dan iklan resale perorangan. Tautan web atau Instagram dari pemilik/agen tetap bisa disimpan sendiri lewat **Tambah listing**, dengan koordinat yang dipilih di peta. Proyek habis terjual dan proyek tanpa harga tidak masuk kurasi peta.
- Stasiun di luar dataset (misalnya Maja dan Rangkasbitung) belum tercakup.
- Harga dalam IDR. Basis harga dicatat apa adanya: "harga mulai", "rentang price list", "harga unit tertentu", "harga subsidi", atau "harga promo". Harga bukan penawaran dan dapat berubah; pengguna diminta mengonfirmasi ke developer.

## Tingkat bukti

| Nilai `verdict` | Arti                                                                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `confirmed`     | Harga ditemukan pada halaman yang dibuka saat cek, status pemasaran terbukti (price list, "dijual/tersedia", promo atau pembaruan portal dalam sekitar 12 bulan), lokasi konsisten. |
| `partial`       | Harga ditemukan saat cek, tetapi status atau lokasi baru sebagian terbukti.                                                                                                         |

Kandidat tanpa harga yang dapat dibaca saat cek tidak dimasukkan. Setiap sumber mencatat `fetched`: `true` berarti isinya dibuka saat cek; `false` berarti tautan hanya ditemukan dari hasil mesin pencari (dipakai untuk Instagram).

## Alur data

1. **Temukan kandidat** per koridor stasiun dengan beberapa cara (katalog di bawah).
2. **Verifikasi**: buka ulang sumber harga, status, dan lokasi, lalu beri `verdict`. Batch sebelumnya memakai pemeriksa terpisah; lanjutan pada 30 Oktober dilakukan proses utama. Ikuti batas delegasi proyek saat menjalankan metode ini.
3. **Gabungkan** hasil ke berkas kurasi: `python3 scripts/merge-research.py HASIL.json ... --checked-at YYYY-MM-DD --labels LABEL.json`. Proyek yang muncul di beberapa koridor digabung; skrip mencetak hal yang perlu dilihat manusia dan tidak mengisi nilai yang hilang.
4. **Koordinat**: pakai titik eksplisit dari halaman sumber (tautan Google Maps dengan koordinat, `locationPin` portal, data proyek Pinhome/cariproperti). Tolak pin yang ternyata dipakai ulang oleh proyek tak terkait atau bertentangan dengan alamat. Untuk sisanya, `python3 scripts/geocode-properties.py [--write]` mencari nama proyek di OpenStreetMap Nominatim satu per satu (jeda 1,1 detik, cache di `.runtime/research/`), hanya menerima kawasan/gedung yang namanya cocok, dan menolak titik desa/kelurahan. Tanpa titik terverifikasi, proyek tercatat di daftar "belum masuk".
5. **Bangun dataset publik**: `python3 scripts/build-properties.py` memvalidasi `research/properties.json` lalu menulis `public/data/properties.geojson`. Skrip menolak URL non-http(s), nomor telepon/WhatsApp/email, sumber media sosial yang ditandai dibuka otomatis, harga tanpa sumber yang dibuka, kutipan lebih dari 150 karakter, dan harga di luar rentang wajar. `excludeReason` dapat mencatat bukti yang membatalkan penerbitan, misalnya sumber harga sudah tidak tersedia. Wilayah dan stasiun terdekat dihitung dari `regions.geojson`, `transit.geojson`, dan `mobility.geojson`. Entri di luar radius atau tanpa koordinat masuk `metadata.excluded` beserta alasannya.
6. **Uji**: `./dev test` menjalankan `scripts/properties.test.ts` (dataset sinkron dengan sumber kurasi, bukti harga, jarak, tanpa kontak pribadi) dan tes skrip; `./dev test:e2e` memakai data fiktif `tests/research-fixture.ts`.

Satu cara menjalankan langkah 1 dan 2 sekaligus adalah [research/property-research.workflow.js](../research/property-research.workflow.js) dengan Workflow Claude Code. Argumennya berisi daftar koridor dan stasiun; keluarannya langsung bisa diproses `merge-research.py`.

## Skema `research/properties.json`

Berkas kurasi berisi `checkedAt`, `maxDistanceKm`, `methods`, `coverage`, `gaps`, dan `properties`. Setiap entri `properties`:

| Field                                           | Isi                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                            | `prj-<slug>` unik                                                                                                              |
| `name`, `developer`, `kind`                     | Nama proyek, developer, `Rumah` atau `Apartemen`                                                                               |
| `subsidized`                                    | `true`, `false`, atau `null` bila tidak dinyatakan                                                                             |
| `locationText`                                  | Kelurahan/kecamatan dan kota/kabupaten menurut sumber                                                                          |
| `status`, `statusQuote`, `statusUrl`            | `dipasarkan`, `pre-launch`, `inden`, `siap-huni`, atau `tidak-jelas`, beserta kutipan dan tautannya                            |
| `price`                                         | `min`, `max`, `basis`, `quote` (≤150 karakter), `url`, `pageDate`                                                              |
| `units`                                         | Hingga empat tipe unit dari sumber: label, kamar, luas tanah/bangunan, harga                                                   |
| `transitClaim`                                  | Kutipan klaim akses stasiun dari sumber; tidak dipakai menghitung jarak                                                        |
| `officialUrl`                                   | Halaman resmi developer/proyek bila ada                                                                                        |
| `coordinate`                                    | `lat`, `lng`, `method`, `url`, `precision`, `note`; `null` bila belum terverifikasi                                            |
| `sources`                                       | `url`, `kind` (developer, portal, news, instagram, government, osm, other), `title`, `fetched`, `pageDate`, `supports`, `note` |
| `verdict`, `lastChecked`, `corridor`, `methods` | Tingkat bukti, tanggal cek (WIB), koridor pencarian, metode yang menghasilkan bukti                                            |

Dataset publik menambahkan `region`, `area`, dan `nearest` (hingga empat stasiun dalam radius, dengan moda, nama, jarak km, dan koordinat stasiun).

## Katalog metode

Katalog lengkap beserta hasil penggunaannya tampil di `/riset#metode` dan disimpan di `research/properties.json`. Ringkasan per 30 Oktober 2026:

- **Portal proyek baru (rumah123).** Sitemap area proyek baru dan halaman `/perumahan-baru/properti/...` dapat dibaca dengan permintaan biasa. Data yang andal: rentang harga (termasuk JSON-LD `AggregateOffer`), tipe unit, `updatedAt`, stasiun terdekat dengan menit tempuh menurut portal. Koordinat `district` adalah pusat kecamatan, bukan titik proyek. Halaman POI stasiun kadang menampilkan tantangan Cloudflare; jangan diakali.
- **Portal proyek baru lain.** Pinhome (`__PROJECT_DETAIL__`: harga minimum/maksimum dan koordinat proyek), cariproperti (`__NEXT_DATA__`: harga per tipe), dan halaman proyek baru Brighton. Tanggal pembaruan sering tidak tersedia, sehingga status bisa hanya `partial`.
- **Situs developer.** Paling kuat untuk status dan nama resmi, tetapi banyak developer kecil tidak memajang harga dan mengandalkan portal atau media sosial.
- **Berita 2025 sampai 2026.** Berguna untuk peluncuran, program pemerintah/BUMN, dan tanggal; harga dari berita diberi jenis `news` beserta tanggalnya.
- **Pencarian web.** Kueri per stasiun ("perumahan dekat stasiun X harga", "apartemen dekat stasiun X price list") lebih banyak memberi petunjuk daripada harga; mengecualikan portal resale membantu menemukan portal proyek baru.
- **Instagram.** Lihat bagian berikut.
- **Diblokir saat cek, jangan diakali:** 99.co dan lamudi.co.id (HTTP 403 untuk klien biasa), registri SiKumbang/Tapera (WAF), sebagian halaman POI rumah123.

## Instagram

`robots.txt` Instagram menyatakan pengumpulan data otomatis dilarang tanpa izin tertulis, dan Meta [Automated Data Collection Terms](https://www.facebook.com/legal/automated_data_collection_terms) mensyaratkan izin tersurat. Karena itu riset ini tidak membuka halaman instagram.com secara otomatis. Tautan Instagram hanya dicatat bila muncul di hasil mesin pencari, dengan `fetched: false`.

Tautan yang ditemukan dapat dibuka manual dari bagian **Bukti & sumber**. Pada data awal, tautan Instagram tersedia untuk Metland Cibitung, Samesta Mahata Margonda, dan Samesta Mahata Serpong. Tautan belum membuktikan bahwa akun tersebut dimiliki developer; isi unggahan tidak dipakai sebagai bukti harga yang telah dibuka.

Otomasi opsional disiapkan pada `scripts/instagram-discovery.ts`, menggunakan [Business Discovery resmi Meta](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery). Ini membutuhkan akun profesional sendiri, aplikasi Meta, izin yang sesuai, dan token pengguna; belum dihubungkan ke akun atau dijalankan secara langsung dalam sesi ini. Dokumentasi Meta mengembalikan HTTP 429 pada pengecekan ulang sesi lanjutan; pembatasan itu tidak diakali. Persyaratan dan versi harus dipastikan saat aktivasi.

Jalankan lewat lingkungan privat yang sudah memiliki `IG_USER_ID` dan `IG_ACCESS_TOKEN`, lalu `node scripts/instagram-discovery.ts akun1 akun2`. Versi dapat dipilih lewat `IG_GRAPH_VERSION` (bawaan skrip `v26.0`). Hasil kandidat disimpan di `.runtime/instagram/` yang diabaikan Git. Skrip menghapus kontak dari cuplikan, memantau header penggunaan, dan berhenti pada batas laju/token tidak valid. Kandidat harus diperiksa sebelum masuk kurasi. Belum ada pengambilan caption otomatis pada aplikasi, pencarian seluruh Instagram, atau pembaruan berkala terjadwal.

## Etika dan batas

- Satu permintaan per host pada satu waktu, User-Agent yang jelas (`rumah-tinggal-research/0.1`), dan hanya halaman yang diperlukan. Nominatim maksimal satu permintaan per detik dengan cache.
- Jangan mengakali 403, 429, captcha, dinding login, atau larangan `robots.txt`: hentikan untuk host tersebut dan catat.
- Jangan menyimpan nama, nomor telepon, WhatsApp, atau email agen/marketing/penjual, dan jangan memasukkan iklan resale perorangan.
- Kutipan maksimal 150 karakter; jangan menyalin deskripsi atau gambar.
- Unduhan diperlakukan sebagai data tidak tepercaya: simpan di direktori kosong tersendiri dan jangan dieksekusi.

## Memperbarui data

Jalankan ulang langkah 1 sampai 6 secara berkala atau untuk koridor tertentu. Entri lama dengan `id` sama diganti hasil cek terbaru; entri yang tidak dicek ulang tetap memakai `lastChecked` lamanya, sehingga pengguna dapat melihat umur buktinya. Hapus entri yang sudah habis terjual atau tidak lagi memiliki harga yang dapat dibuka.

## Integrasi koleksi dan pin

- **Lihat di peta** membuka titik beserta sumber harga dan stasiun terdekat.
- **Simpan ke Listingku** menyimpan judul, harga awal, titik, sumber harga, tanggal cek, tautan bukti, serta tautan Instagram bila ada. Sumber utama tetap harga yang dikutip, walaupun proyek mempunyai situs resmi berbeda.
- **Simpan sebagai pin** menyimpan lokasi dalam kategori Lainnya, dengan sumber dan tanggal di catatan. Dari detail peta, nama/kategori/catatan dapat disesuaikan sebelum disimpan.
- Keduanya memerlukan login dan memakai API per UID yang sama dengan koleksi pribadi. Memilih atau menyimpan proyek tidak mempublikasikan koleksi pengguna.
- Verifikasi sumber dan developer bukan verifikasi identitas pemilik, hak atas tanah, atau kepemilikan unit.

## Hasil kurasi 30 Oktober 2026

171 kandidat ditemukan pada 13 koridor pencarian (termasuk duplikat lintas koridor). Dari hasil pemeriksaan yang selesai, 64 proyek dicatat pada berkas kurasi; 28 dapat diterbitkan pada peta, sementara 36 belum masuk karena titik belum pasti, di luar radius, atau sumber tidak tersedia. Ada 4 proyek dengan bukti confirmed dan 24 partial. Halaman menampilkan cakupan aktual dan alasan belum masuk; tidak mengklaim seluruh kandidat telah selesai diperiksa.
