# Publikasi hasil scraping — 5 November 2026

**76 penawaran ditambahkan setelah peninjauan sumber**: 68 rumah/kontrakan, 6 apartemen dan 2 kos keluarga. Katalog bertambah dari 410 menjadi **486 penawaran**, dengan 481 pin dan 458 penawaran dekat masjid Ihrish. Semuanya sebagian terverifikasi; stok belum dikonfirmasi langsung.

## Sumber dan cakupan

Memakai hasil scraping terjadwal 5 November yang sudah selesai. Dari 192 kandidat di luar katalog, 86 belum pernah ditinjau dan 106 sudah ditahan sebelumnya. Seluruh 86 halaman diambil ulang melalui HTTP publik dengan robots, jeda acak 2–5 detik, dan maksimal dua provider bersamaan. Sebanyak 13 rincian diperiksa lagi secara terarah. Tidak memicu fullcrawl duplikat.

Target pencarian tetap persis **78 masjid daftar Ihrish**, bukan semua masjid. Katalog publik masih memakai wilayah Jabodetabek. Tiga kandidat Bandung tetap privat, termasuk satu yang belum dapat dimasukkan karena skema wilayah katalog; dua lainnya juga bermasalah pada harga atau penggunaan bangunan. Batas pencarian dan batas penerbitan tersebut berbeda.

Sebanyak **76 diterima dan 10 ditahan**. Held lama tidak diterbitkan otomatis. URL yang sudah berkatalog tidak ditambahkan ulang. Sesuai arahan sebelumnya, kemiripan antarpenawaran berbeda URL tidak dianggap bukti unit unik maupun alasan tunggal untuk menghapus penawaran.

## Harga dan rincian unit

Harga numerik Rp 36.999.999/tahun dipertahankan walaupun label membulatkan Rp 37 juta. Penawaran Jatimelati Rp 3 juta/bulan mensyaratkan enam bulan, cocok dengan total paket Rp 18 juta pada deskripsi; Rp 30 juta/tahun adalah paket berbeda. Rumah Emerald Land memakai paket 12 bulan Rp 78 juta; enam bulan Rp 42 juta adalah total paket lain. Minimum 24 bulan tetap terlihat pada penawaran tahunan yang mensyaratkannya.

Lima jumlah kamar tidak dicantumkan ketika portal dan deskripsi tidak cukup selaras, termasuk studio yang tidak dianggap mempunyai satu kamar tidur terpisah. Tiga luas tidak dicantumkan karena konflik angka atau perubahan sesudah renovasi. Penawaran Pondok Labu hanya menyewakan bagian bawah; empat petakan pada satu halaman dicatat sebagai satu penawaran sumber, bukan empat unit tersedia.

Dua kos mempunyai izin pasutri dan anak secara eksplisit, status aktif dan kamar tersedia pada field sumber, serta nominal rupiah/periode yang cocok antarfield harga. Satu minimum satu bulan dicatat dari field sumber; minimum yang tidak ditampilkan tetap tidak diisi. Tata ruang, fasilitas bersama/pribadi, biaya akhir dan persyaratan aktual perlu konfirmasi.

Tanggal pemeriksaan dipisahkan dari tanggal pembaruan sumber: 42 tambahan bertanggal sumber 2025 dan 34 bertanggal 2026. Seluruh **410 penawaran lama**, **111 proyek**, dan **fakta 78 masjid** tetap sama. Tambahan memakai pin perkiraan portal dengan hubungan radius mentah maksimal 1,5 km; ini bukan kepastian pintu unit atau jarak berjalan.

## Kesehatan scraper

Run sore menyelesaikan lima provider, sedangkan Brighton gagal dengan `AttributeError`. Pemeriksaan terarah membuktikan satu halaman mengirim dua objek penawaran dalam daftar JSON-LD; parser sebelumnya menganggap `offers` selalu satu objek. Parser kini menerima daftar berisi satu objek dan menahan daftar ambigu sebagai detail yang perlu ditinjau, sehingga detail lain dapat dilanjutkan. Tes regresi memeriksa harga/status yang tetap sama dan kelanjutan run setelah penawaran ambigu.

OLX dan Facebook tetap manual; tidak menambahkan provider baru atau melewati pembatasan akses. Jadwal tiga jendela dan fokus per masjid tetap dipertahankan.

## Kandidat baru yang ditahan

| Sumber                                                                                                                                               | Alasan                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Halaman penawaran](https://www.pinhome.id/disewa/apartemen-sekunder/unit/disewakan-apartemen-siap-pakai-di-green-pramuka-city-2)                    | Tanggal pembaruan sumber masih Maret 2024; harga dan syarat saat ini belum cukup terbukti.                                                                                                                        |
| [Halaman penawaran](https://www.pinhome.id/disewa/apartemen-sekunder/unit/disewakan-apartemen-di-loftvilles-city)                                    | Apartemen Rp 2,5 juta/bulan mempunyai luas portal 220 m² tanpa deskripsi; ukuran dan identitas satu unit belum cukup jelas.                                                                                       |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-jalan-raya-cikaret)                                         | Deskripsi hanya menawarkan tiga kios dan lahan parkir 12 mobil; hunian keluarga tidak terbukti meskipun kategori portal rumah.                                                                                    |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-jl-permai-barat-raya)                                       | Label Rp 45 juta/tahun berbeda dari nominal deskripsi Rp42,000,0000 per tahun yang juga ambigu; tidak mengoreksi angka dengan tebakan.                                                                            |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-meruyung-diapit-2-pintu-tol-di-perumahan-di-meruyung-depok)    | Label Rp 35 juta/tahun berbeda dari harga deskripsi Rp 40 juta; nominal yang berlaku belum jelas.                                                                                                                 |
| [Halaman penawaran](https://mamikos.com/room/kost-kabupaten-bogor-kost-campur-eksklusif-rumah-kontrakan-d-cluster-pangrango-sukahati-cibinong-bogor) | Minimum sumber Min. 1 Th dan deskripsi minimal 1 tahun, tetapi tarif Rp 2 juta/bulan dan Rp 25 juta/tahun tidak menjelaskan pembayaran minimum yang sama. Jenis kos versus rumah kontrakan juga perlu diperjelas. |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-siap-huni-dekat-tol-di-danau-bogor-raya)                       | Tanggal pembaruan sumber masih Maret 2024; harga dan syarat saat ini belum cukup terbukti.                                                                                                                        |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-lux-di-dalam-komplek-di-cigadung)                              | Bandung di luar wilayah katalog Jabodetabek saat ini; selain itu label Rp 68 juta/tahun berbeda dari deskripsi Rp 78 juta/tahun dan tanggal sumber masih 2024.                                                    |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-maleer)                                                     | Bandung di luar wilayah katalog Jabodetabek saat ini; deskripsi menyebut rumah kost sehingga penggunaan seluruh bangunan sebagai hunian keluarga belum jelas.                                                     |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-rancanumpang)                                               | Kandidat berada di Bandung; skema wilayah katalog publik saat ini hanya Jabodetabek. Hasil pencarian tetap disimpan privat tanpa memberi label wilayah yang salah.                                                |

Sesudah input, sisa kandidat baseline **116**: 106 held lama dan 10 held baru. Angka kandidat pada laporan worker adalah snapshot sebelum input; tidak ditulis ulang sebagai root untuk memperbarui hitungan. Katalog worker yang diperbarui menjadi acuan deduplikasi pada run berikutnya.
