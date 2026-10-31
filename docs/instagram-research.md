# Instagram untuk riset hunian keluarga di Jabar

Diperiksa **31 Oktober 2026 WIB**. Cakupan putaran ini: Kota/Kabupaten Bogor, Kota Depok, serta Kota/Kabupaten Bekasi. Belum mencakup seluruh Jawa Barat.

## Jalur koneksi yang sesuai

Untuk membaca unggahan akun developer lain yang sudah diketahui namanya, gunakan **Instagram API with Facebook Login / Business Discovery**. Koleksi resmi [Meta di Postman](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-1ff01566-3509-48bd-a0f4-8571a91ccfdf) menjelaskan akses metadata akun Business/Creator lain, akun profesional sendiri yang terhubung ke Facebook Page, dan ketidaktersediaan akses akun konsumen/pribadi.

| Pilihan                                          | Kegunaan untuk riset ini                                                  | Status                                                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Pencarian web dan situs developer/masjid/sekolah | Menemukan proyek, sumber harga, fasilitas, serta tautan Instagram         | Sudah digunakan; hasil pencarian tetap perlu verifikasi halaman                                                                                |
| Business Discovery dengan Facebook Login         | Membaca caption/media publik akun profesional target berdasarkan username | Skrip tersedia; akun dan akses nyata belum diuji                                                                                               |
| Instagram Login                                  | Mengelola akun profesional yang memberikan akses                          | Tidak diasumsikan sebagai pengganti Business Discovery untuk akun lain                                                                         |
| Plugin analitik sosial                           | Umumnya analitik akun atau brand yang dihubungkan                         | Pencarian plugin menemukan Windsor.ai dan Metricool; belum membuktikan kemampuan riset akun developer lain, sehingga belum disarankan dipasang |

Menghubungkan akun pribadi saja belum memenuhi prasyarat API tersebut. Membaca feed akun yang diikuti, mencari semua caption di Instagram, dan menemukan seluruh rumah baru di suatu kota juga bukan kemampuan yang dijanjikan integrasi ini.

## Persiapan akun dan aplikasi

1. Gunakan akun Instagram milik sendiri berjenis **Business atau Creator**. Bila akun sekarang pribadi, pilih dahulu apakah akan mengubah jenisnya atau memakai akun riset terpisah.
2. Hubungkan akun profesional itu ke Facebook Page yang Anda kelola.
3. Buat atau pilih aplikasi di [Meta for Developers](https://developers.facebook.com/apps/) dengan konfigurasi Instagram API **with Facebook Login**. Untuk percobaan awal, pengguna penguji harus memiliki peran dan akses yang sesuai pada aplikasi, Page, dan akun profesional.
4. Periksa izin baca serta tingkat akses **Business Discovery** di dasbor aplikasi. Koleksi resmi mencantumkan `instagram_basic`, `pages_read_engagement`, dan `pages_show_list` bersama izin lain untuk fitur koleksi yang lebih luas. Daftar tersebut bukan matriks izin minimal Business Discovery yang telah diuji pada proyek ini; jangan meminta izin publikasi atau pesan hanya untuk riset. App Review, akses tambahan, atau verifikasi bisnis mengikuti persyaratan fitur di dasbor aplikasi.
5. Gunakan Graph API Explorer/login resmi untuk memperoleh token pengguna dan memetakan Page ke `instagram_business_account.id`. ID ini yang dipakai sebagai `IG_USER_ID`, bukan username atau ID Page. Koleksi Meta menyediakan contoh `/me/accounts` untuk pemetaan tersebut; simpan hasil autentikasi hanya di lingkungan privat.
6. Pilih `IG_GRAPH_VERSION` yang didukung oleh aplikasi pada saat aktivasi. Skrip sekarang meminta versi eksplisit; tidak menganggap versi lama `v26.0` otomatis merupakan versi terkini.

Referensi [Business Discovery](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery) dan [Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login) mengembalikan HTTP 429 saat pemeriksaan. Pembatasan tidak diakali. Konsep akses diperiksa lewat koleksi resmi Meta; matriks izin, kuota hashtag, masa berlaku token, dan versi terbaru belum diverifikasi langsung dari referensi tersebut. Keberhasilan aplikasi pihak lain bukan bukti bahwa aplikasi ini sudah memperoleh akses.

## Menjalankan skrip yang sudah disiapkan

[Watchlist](../research/instagram-watchlist.json) memuat **9 akun organisasi** dari tautan yang ditemukan ulang pada situs resmi: dua proyek Depok, dua proyek/developer Bogor, dua proyek Bekasi, serta tiga akun pendidikan Islam anak di Depok. Kepemilikan tautan bersumber situs; status Business/Creator dan akses API tiap akun belum diuji. Daftar ini belum menjadi pemantauan otomatis.

Periksa rencana tanpa kredensial atau permintaan jaringan:

```sh
./dev exec node scripts/instagram-discovery.ts --focus muslim-family --watchlist research/instagram-watchlist.json --dry-run
```

Setelah autentikasi resmi siap, isi variabel berikut lewat editor pada berkas privat `.runtime/instagram/private.env` dengan izin direktori `700` dan berkas `600`: `IG_USER_ID`, `IG_ACCESS_TOKEN`, dan `IG_GRAPH_VERSION`. Jangan menaruh nilai token dalam chat, dokumentasi, argumen perintah, atau Git.

Uji satu akun lebih dahulu:

```sh
./dev exec node --env-file=.runtime/instagram/private.env scripts/instagram-discovery.ts --focus muslim-family ahsanuamalaproperti
```

Setelah satu akun berhasil, gunakan watchlist:

```sh
./dev exec node --env-file=.runtime/instagram/private.env scripts/instagram-discovery.ts --focus muslim-family --watchlist research/instagram-watchlist.json
```

Mode `muslim-family` menangkap petunjuk masjid, kajian/pengajian, TPQ, tahsin/tahfidz, pesantren, TKIT/SDIT, sekolah Islam, dan lingkungan muslim. Harga dan kata stasiun tidak diwajibkan, sehingga pengumuman kegiatan atau pendidikan anak dapat menjadi kandidat. Mode bawaan `transit` tetap mensyaratkan harga dan kata transit.

Token dikirim lewat header, keluaran menghapus kontak, dan hasil ditulis dengan izin `600` di `.runtime/instagram/discovery-<waktu>.json`. Skrip berhenti pada kegagalan token/izin, batas laju termasuk HTTP 429, pemakaian yang mencapai ambang, atau kegagalan koneksi; tidak mencoba ulang secara otomatis. Bawaan: satu halaman berisi maksimal 25 media per akun, ambang pemakaian 75%; dapat diatur melalui `IG_MEDIA_LIMIT` dan `IG_STOP_PERCENT`.

## Cara memverifikasi temuan

- Nama wilayah yang tertulis pada caption disimpan sebagai petunjuk. Akun yang sudah berlabel Bogor/Depok/Bekasi di watchlist tetap dapat mengunggah proyek luar wilayah; label akun tidak membuktikan lokasi setiap unggahan.
- Caption tanpa harga tetap berupa kandidat fasilitas atau kegiatan. Caption berharga juga belum membuktikan rumah tersedia, baru, atau dijual langsung oleh developer.
- Pisahkan fasilitas sudah berjalan, rencana pembangunan, pengumuman satu acara, dan jadwal berulang. Catat tanggal, kelompok usia anak, akses peserta luar, serta biaya hanya jika sumber memublikasikannya.
- Harga di poster gambar, suara Reels, caption yang tidak tersedia, serta unggahan di luar halaman media pertama belum dianalisis. Hasil kosong bukan bukti tidak ada hunian atau kegiatan.
- Sumber harga, alamat administratif, titik proyek, jadwal kajian, dan pendidikan anak diperiksa terpisah sebelum dimasukkan ke katalog. Hasil API tidak diterbitkan otomatis.

Status akhir putaran ini: **dry-run dan pengujian offline tersedia; koneksi akun nyata belum aktif** karena kredensial belum ada. Tidak ada jadwal pengambilan berkala yang diaktifkan.
