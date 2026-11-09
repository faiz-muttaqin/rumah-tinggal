# Hasil scraping gabungan dekat VCM — 9 November 2026

Laporan terbaru selesai **9 November 2026 pukul 06.31 WIB**, dari putaran terjadwal yang dimulai sekitar 06.29 WIB. Enam sumber terpetakan selesai tanpa error sumber. Jakarta Prime tetap terkonfigurasi tetapi dilewati tanpa request karena tidak melayani VCM. Fokus tetap satu Masjid As Sunnah VCM, radius 1,5 km garis lurus, dengan inventori acuan 78 masjid yang dipertahankan.

## Hasil gabungan lintas sumber

| Sumber       | Search pada putaran ini | Detail pada putaran ini | Tambahan publik setelah kurasi |
| ------------ | ----------------------: | ----------------------: | -----------------------------: |
| pinhome      |                       3 |                       2 |                              2 |
| jendela360   |                       4 |                       2 |                              2 |
| realoka      |                       4 |                       0 |                              0 |
| brighton     |                       4 |                       1 |                              0 |
| mamikos      |                      15 |                      12 |                              1 |
| rukita       |                       1 |                       0 |                              0 |
| jakartaprime |                       0 |                       0 |                              0 |

Putaran ini membaca **17 detail** dan melakukan **31 request pencarian**; ditambah enam robots menjadi **54 request**. Jumlah kumulatif 5.212 detail pada laporan adalah cache lintas putaran dan kawasan lama, bukan 5.212 listing baru atau seluruh inventaris portal. Dua kandidat baru dari Jendela360 terpisah dari satu kandidat Fortunia yang sebelumnya sudah ditahan.

Kurasi membandingkan hasil yang terkumpul sejak rilis 7 November, termasuk kos dan rumah yang dibaca pada 8 November lalu ditahan untuk tinjauan manual. Kolom tambahan publik bukan jumlah hasil baru dari 17 detail pagi ini saja.

Tiga hasil tambahan dari **selain Pinhome** diterbitkan: dua studio Jendela360 dan satu kos Mamikos. Dua rumah Pinhome juga lolos setelah tinjauan manual. Katalog menjadi **603 penawaran**, dengan **18 dekat VCM**: 11 rumah/kontrakan, 3 kos, dan 4 apartemen. Seluruh 598 penawaran lama, 111 proyek dan fakta 78 masjid dipertahankan.

## Tambahan yang diterbitkan

| Penawaran                                                                                                                                                                                                      | Harga sumber       | Minimum           | Jarak ke VCM | Tanggal sumber    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------- | ------------ | ----------------- |
| [Studio Cinere Terrace Suites — CINA003](https://jendela360.com/sewa-apartemen-cinere-terrace-suites-apartment/CINA003)                                                                                        | Rp35.350.000/tahun | 12 bulan          | ≈0.975 km    | Tidak ditampilkan |
| [Studio Cinere Terrace Suites — CINA001](https://jendela360.com/sewa-apartemen-cinere-terrace-suites-apartment/CINA001)                                                                                        | Rp42.930.000/tahun | 12 bulan          | ≈0.975 km    | Tidak ditampilkan |
| [Kos Nini Ku — Tipe Standar (putra)](https://mamikos.com/room/kost-depok-kost-putra-eksklusif-kost-nini-ku-tipe-standar-cinere-depok)                                                                          | Rp2.200.000/bulan  | Tidak ditampilkan | ≈0.959 km    | 2026-10-27        |
| [Rumah 2 kamar Pisangan — 60 m² (pin 400 m ke VCM)](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-2-lantai-baru-renovasi-akses-2-mobil-di-jl-gelagah-nodalam-no27-pisangan)                | Rp2.600.000/bulan  | 1 bulan           | ≈0.4 km      | 2025-09-03        |
| [Rumah 2 kamar Pisangan — 60 m² (pin 299 m ke VCM)](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-2-lantai-baru-renovasi-hanya-5-menit-ke-cinere-di-jl-bidan-gelagah-dalam-no-25-cirendeu) | Rp2.600.000/bulan  | 1 bulan           | ≈0.299 km    | 2025-09-12        |

Dua studio Cinere Terrace masing-masing 24 m² dan unfurnished menurut sumber. Keduanya hanya menampilkan paket 12 bulan; angka tahunan/12 tidak diubah menjadi tarif kontrak bulanan. Kode unit dan foto berbeda dipertahankan terpisah meskipun memakai titik gedung yang sama. Nominal tahunan dan harga kos cocok dengan halaman yang terlihat di browser.

Kos Nini Ku diterbitkan sebagai **kos putra biasa**: pasutri dan anak tidak diperbolehkan menurut sumber. Minimum kontrak dan kapasitas kamar belum dicantumkan; tidak dibuat badge minimum satu bulan hanya karena harganya bulanan. Dapur dan balkon bersama serta AC disebut dalam deskripsi. Indikator kamar tersedia pada portal bukan konfirmasi pemilik.

Dua rumah Rp2,6 juta/bulan sebelumnya ditahan karena deskripsi memuat kata kantor. Pembacaan manual membuktikan penggunaan **rumah tinggal maupun kantor** diperbolehkan; keduanya 2 lantai, 2 kamar tidur dan 2 kamar mandi menurut deskripsi, dengan IPL termasuk harga. Masing-masing memiliki URL, pin, dan foto berbeda; identitas unit tetap perlu konfirmasi saat survei. Pembaruan sumber masih September 2025 dan tidak diganti dengan tanggal pemeriksaan. Klaim bebas banjir dan waktu tempuh iklan tidak diperlakukan sebagai fakta terverifikasi.

Semua tambahan diperiksa ulang pada 9 November dan berstatus **partial**. Jarak adalah garis lurus dari pin perkiraan atau titik gedung, bukan rute berjalan. Stok, tanggal masuk, deposit, utilitas dan biaya akhir perlu konfirmasi. Fortunia tetap ditahan karena nama kawasan di deskripsi berbeda dengan lokasi/pin terstruktur; hasil itu tidak dimasukkan ulang sebagai listing baru.

## Jadwal dan pemisahan data

Pemeriksaan ini memakai hasil terjadwal, tanpa menjalankan ulang seluruh crawler. Cache worker dan ketiga timer dipertahankan; sinkronisasi worker hanya memperbarui katalog publik untuk deduplikasi. Hasil mentah tetap privat untuk kurasi dan tidak dipublikasikan otomatis. Tidak ada setup browser bersama, perubahan nginx/port, login akun, atau pesan kepada pengiklan.
