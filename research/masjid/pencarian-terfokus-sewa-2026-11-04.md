# Pencarian sewa terfokus per masjid — 4 November 2026

**28 penawaran baru sudah diterbitkan lebih dahulu**, menjadi **344 penawaran**, melalui `release-20261104-2049`. Setelah pengguna menegaskan fokus tiap masjid, penemuan dan antrean detail dipersempit sebelum pengambilan, bukan hanya menyaring hasil setelah seluruh detail kota dibaca.

## Cara fokus bekerja

- Pinhome memakai kawasan kelurahan dari masing-masing **78 masjid**, dengan **142 URL awal** yang dipakai bersama bila kawasannya sama. Kartu rekomendasi dari kelurahan lain dan tautan tanpa ID kelurahan ditolak sebelum detail.
- Sepuluh jalur pencarian diperbaiki memakai hierarki dan ID lokasi pada rincian portal. Beberapa URL kelurahan kembali ke halaman kecamatan; ID kelurahan yang sudah diperiksa tetap menyaring kartu secara lokal dan halaman lebih luas itu tidak dipaginasi. Area pencarian merupakan petunjuk, bukan klaim alamat administratif masjid.
- Sumber lain memerlukan petunjuk nama kelurahan pada tautan, titik yang sudah berada dalam radius, atau acuan gedung yang sudah terbukti dekat. Pagination tingkat kota dilewati. Sitemap kota Mamikos tetap indeks penemuan tautan, lalu URL yang tidak memiliki petunjuk kawasan sesuai ditahan sebelum detail.
- Setiap masjid mendapat giliran, maksimal **2 permintaan detail per masjid per sumber per putaran**. Cursor diteruskan ke putaran berikutnya; satu URL yang relevan ke beberapa masjid cukup diambil sekali. Hasil suatu masjid dapat bertambah dari request yang dialokasikan ke masjid tetangga.
- Hubungan radius baru diterima dari koordinat detail pada batas mentah **1,5 km**. Kecocokan nama kawasan tidak dianggap bukti jarak. Target jeda acak **2–5 detik** per situs, mengikuti batas robots yang lebih besar; maksimal dua situs bersamaan.

Nama kawasan yang tersedia dapat melewatkan penawaran tanpa petunjuk lokasi yang cukup. Satu halaman yang tidak memuat kartu kelurahan sesuai tidak membuktikan tidak ada sewa. Kebijakan ini mempertahankan fokus, sementara stok, harga, identitas unit dan duplikasi tetap perlu kurasi.

## Hasil uji nyata

Uji setelah perbaikan berlangsung **21.45–21.57 WIB**, sekitar **11.5 menit**, keenam sumber selesai exit 0. Seluruh **78 titik** memiliki kawasan pencarian segar, dengan **247 URL awal** lintas sumber. Halaman yang masih segar dipakai dari cache; tes tidak mengulang seluruh indeks kota.

Putaran akhir mencatat **249 permintaan halaman**, terdiri dari **41 pencarian**, **202 detail**, dan 6 robots. Dari detail tersebut, 201 berhasil dan 1 gagal. Puncak memori tercatat **93.32 MiB** dari batas 256 MiB. Produksi tetap sehat dan dataset 344 penawaran tidak berubah.

| Sumber       | Pencarian / batas | Detail / batas | Detail terfokus menunggu | Menit |
| ------------ | ----------------- | -------------- | ------------------------ | ----- |
| jendela360   | 0/30              | 0/60           | 0                        | 0.36  |
| realoka      | 0/30              | 2/80           | 0                        | 0.12  |
| brighton     | 0/20              | 0/60           | 0                        | 0.01  |
| jakartaprime | 0/6               | 0/40           | 0                        | 0.01  |
| mamikos      | 0/40              | 60/60          | 2118                     | 3.87  |
| pinhome      | 41/162            | 140/240        | 2363                     | 11.13 |

Batas konfigurasi lintas situs **288 pencarian dan 540 detail** per putaran. Batas per masjid menurunkan plafon efektif detail menjadi paling banyak **432** pada pemetaan sumber saat ini, sebelum memperhitungkan cache, duplikasi tautan, dan sedikitnya kandidat. Angka ini adalah batas aplikasi, bukan batas maksimum portal. Timeout tetap 45 menit. Jadwal pagi/siang/sore dan awal acaknya dipertahankan.

Pada cache yang sama sebelum perubahan, penyaringan Mamikos mengurangi antrean 17.366 menjadi 2.231 tautan dengan petunjuk kawasan terpilih. Antrean akhir berbeda karena progres, cache, dan hasil baru; angka tersebut bukan jumlah kos tersedia atau jaminan semua berada dalam radius.

Satu detail Mamikos ditahan oleh pemeriksaan rute URL sumber (`URL outside public rental routes`); worker tidak melanjutkan ke rute tersebut. Sumber lain tetap menyelesaikan giliran.

## Bukti tiap masjid

Kolom berikut menunjukkan permintaan detail yang dialokasikan pada putaran akhir. Nol berarti tidak ada request detail baru pada giliran itu; data mungkin sudah berada di cache, tidak memiliki petunjuk yang cukup, atau belum mendapat jatah. Simbol — berarti sumber tidak dipetakan untuk masjid tersebut.

| Masjid                                     | Kawasan utama       | Pinhome | Jendela360 | Realoka | Brighton | Jakarta Prime | Mamikos |
| ------------------------------------------ | ------------------- | ------- | ---------- | ------- | -------- | ------------- | ------- |
| Masjid Nurul Iman Blok M                   | melawai             | 2       | 0          | 0       | 0        | 0             | 1       |
| Masjid Nur Salma                           | karet-semanggi      | 2       | 0          | 0       | 0        | 0             | 1       |
| Masjid Baitussalam Cilandak                | cilandak-barat      | 2       | 0          | 1       | 0        | 0             | 1       |
| Masjid Baiturrahman                        | pondok-pinang       | 2       | 0          | 0       | 0        | 0             | 2       |
| Masjid Nurul Amal                          | pasar-minggu        | 2       | 0          | 1       | 0        | 0             | 2       |
| Masjid Al Kautsar Matraman                 | kebon-manggis       | 0       | 0          | 0       | 0        | —             | 0       |
| Masjid Al Hidayah Tomang                   | jatipulo            | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Al Fattah                           | bali-mester         | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Raya Al Fatah                       | kayu-manis          | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Imam Nawawi                         | cipinang-cempedak   | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Al Mubarak                          | krukut              | 0       | 0          | 0       | 0        | —             | 2       |
| Masjid Al Azhar CPB                        | cempaka-putih-barat | 2       | 0          | 0       | 0        | 0             | 0       |
| Masjid Salman Al Farisi                    | kayu-putih          | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Al-Ihsan Cipinang                   | cipinang-muara      | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Al Barkah Sawah Baru                | sawah-baru          | 2       | 0          | 0       | 0        | —             | 2       |
| Masjid At Taufiq                           | cempaka-putih-timur | 2       | 0          | 0       | 0        | 0             | 0       |
| Masjid Al Mizan                            | jati                | 2       | 0          | 0       | 0        | —             | 2       |
| Masjid Al Amanah                           | sarua               | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Al-Muhajirin Villa Gunung Lestari   | jombang             | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Istiqomah Kavling Pengadilan        | klender             | 2       | 0          | 0       | 0        | —             | 2       |
| Masjid Al-Aqsho                            | jatibening          | 2       | 0          | 0       | 0        | —             | 2       |
| Masjid Al Ukhuwah                          | pagedangan          | 2       | 0          | 0       | 0        | —             | 2       |
| Masjid Raya Rahmatan Lil'alamin            | buaran-indah        | 2       | 0          | 0       | 0        | —             | 2       |
| Masjid Al Furqan Grand Galaxy City         | jakasetia           | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Al-Hakim                            | tanah-tinggi        | 2       | 0          | 0       | 0        | —             | 2       |
| Masjid Al Ikhlas Nirwana 2                 | harapanjaya         | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Al Jannah GCC                       | cilebut-timur       | 0       | 0          | 0       | 0        | —             | 2       |
| Masjid Al Hikmah DDN 2                     | pondok-labu         | 2       | 0          | 0       | 0        | 0             | 2       |
| Masjid An Nur Casagoya                     | kebon-jeruk         | 2       | 0          | 0       | 0        | —             | 2       |
| Masjid Al Adhim                            | pangkalan-jati-baru | 2       | 0          | 0       | 0        | —             | 2       |
| Masjid Jami' Utsman bin Affan              | jurangmangu-barat   | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid As Sunnah VCM                       | pisangan            | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid At Tabayyun                         | meruya-selatan      | 2       | 0          | 0       | 0        | —             | 2       |
| Masjid Al Hasanah Bintaro                  | jurangmangu-barat   | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Jami Al Jihad                       | paninggilan-utara   | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Raya Cipinang Muara                 | cipinang-muara      | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Ar Rahman Discovery Lumina          | parigi              | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Ash Shaff                           | parigi              | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Abu Bakar Ash Shiddiq Tangerang     | tajur               | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Al Hijrah Discovery Flamine         | parigi              | 2       | 0          | 0       | 0        | —             | 0       |
| Rumah Al-Qur'an RSB                        | jatimakmur          | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Aminussalam                         | jatimakmur          | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid An Naba'                            | sudimara-pinang     | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Nurul Iman Valencia                 | kunciran-indah      | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Baiturrahim Kavling Marinir         | pondok-kelapa       | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Al Muhajirin Wal Anshar             | grogol              | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Asy-Syakirin Depok                  | mekarsari           | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Al-Hakim Pamulang                   | pondok-benda        | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid As Sunnah Meruyung                  | maruyung            | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Hijau Nurul Iman                    | cilangkap           | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Al Lathiif                          | mekar-jaya          | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Al Ahdhar                           | jatimelati          | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Ar-Riyadh                           | mekar-jaya          | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Al-Hidayah                          | cakung-timur        | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Nurul I'tishom                      | kranji              | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Imam Asy-Syafi'i                    | sukmajaya           | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Muadz Bin Jabal                     | bojong-kulur        | 0       | 0          | 0       | 0        | —             | 1       |
| Masjid Raya At Taqwa Rawalumbu             | pengasinan          | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Bunga Bangsa                        | bekasijaya          | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Nurul Jannah PUP                    | kaliabang-tengah    | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Miftahu Khairil Ummah               | harapanbaru         | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Al Ikhlas Dukuh Bima                | lambangsari         | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Rihlatul Jannah                     | tajurhalang         | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid At-Tauhid                           | sukahati            | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Nuur 'Alaa Nuur (MASNAN)            | sumberjaya          | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Al-Ikhlas Tamansari Persada         | cibadak             | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Al-Istiqomah Taman Yasmin           | curug-mekar         | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Abu Bakr Ash-Shiddiq Cibitung       | kertamukti          | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Istiqomah IKEA Sentul City          | citaringgul         | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Nurut Tauhid                        | cimahpar            | 2       | 0          | 0       | 0        | —             | 1       |
| Masjid Al-Jihad Cikarang Baru              | pasirsari           | 2       | 0          | 0       | 0        | —             | 0       |
| Masjid Nur Ilahi                           | pandan-sari         | 0       | 0          | 0       | 0        | —             | 1       |
| Masjid Al Barkah Batujajar                 | selacau             | 0       | 0          | 0       | 0        | —             | —       |
| Masjid Umar bin Khattab Selacau            | selacau             | 0       | 0          | 0       | 0        | —             | —       |
| Masjid At-Tauhid Lembang                   | pagerwangi          | 0       | 0          | 0       | 0        | —             | —       |
| Masjid Al-Hafidz Cigadung                  | cigadung            | 2       | 0          | 0       | 0        | —             | —       |
| Masjid Ash Shiddiq Bandung                 | maleer              | 2       | 0          | 0       | 0        | —             | —       |
| Masjid Umar Bin Khattab Griya Cempaka Arum | rancanumpang        | 2       | 0          | 0       | 0        | —             | —       |

## Batas publikasi dan validasi

Cache gabungan memuat 3899 detail berhasil secara kumulatif dan 175 kandidat di luar katalog. Sebanyak 86 belum pernah ditinjau, termasuk hasil uji sebelum penajaman fokus; **44** di antaranya diambil pada putaran akhir ini. Kandidat tetap privat, bukan stok terkonfirmasi dan tidak diterbitkan otomatis.

Uji luas awal dihentikan saat pengguna menegaskan fokus. Uji fokus awal juga dihentikan untuk memperbaiki jalur/ID lokasi yang tidak dikenali; kedua run parsial tersebut tidak dinyatakan lulus penuh. Putaran akhir di atas memverifikasi 78 catatan fokus pada setiap provider, batas 2 request per masjid, kecocokan ID seluruh kartu Pinhome, tanpa pagination kota baru, jeda nyata, serta cleanup override.

Validasi kode: check/typecheck, 69 tes Node dan 54 tes Python lulus. Sembilan file worker cocok sumber; runtime/cursor/cache dipertahankan saat instalasi. Override tes telah dihapus dan tiga timer tetap aktif/enabled. Aplikasi tetap rilis `5448f30`; worker fokus ada pada `87a9b5f`. Env hanya dibandingkan metadatanya, SQLite dan konfigurasi privat tidak dibaca atau disalin.
