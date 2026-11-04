# Kurasi hasil scraping pagi — 4 November 2026

Sebanyak **39 penawaran tambahan** masuk katalog: **31 kontrakan/rumah sewa dan 8 apartemen**, dari 38 Pinhome dan 1 Jendela360. Katalog bertambah dari 244 menjadi **283 penawaran**, dengan **278 bertitik** dan **255 dalam radius acuan 1,5 km masjid Ihrish**. Seluruh tambahan berstatus sebagian terverifikasi; jumlah penawaran bukan jaminan unit unik atau stok tersedia.

## Hasil scraping dan pembandingan

Worker terjadwal enam sumber berjalan pada 4 November **06.20–06.35 WIB**, selesai exit 0. Laporan aktual dibuat 06.35 WIB, memuat 2429 detail berhasil dari 2439 attempt secara kumulatif serta 740 petunjuk kawasan. Angka tersebut bukan jumlah hasil satu putaran dan petunjuk kawasan tidak dianggap hasil dalam radius masjid. Putaran ini mengambil 494 detail (Pinhome 240, Jendela360 8, Realoka 80, Brighton 56, Jakarta Prime 40, Mamikos 60). Tidak diperlukan pengambilan penuh manual tambahan.

Dari 112 kandidat yang belum berkatalog, **58 sudah ditahan pada kurasi sebelumnya** dan **54 belum pernah ditinjau**. Semua 54 diambil ulang melalui HTTP publik dengan robots dan jeda minimal 1,5 detik/domain; tidak ada kegagalan akses. Sebanyak 20 rincian diperiksa lagi secara terarah untuk ketentuan yang belum jelas. Dari 54 tersebut, 39 diterima dan 15 ditahan. Keputusan held lama tidak dibatalkan hanya karena masih muncul sebagai kandidat worker.

Pembandingan meliputi URL katalog, hash foto sumber, lokasi dan spesifikasi kandidat terhadap penawaran lama, serta harga/periode/minimum dari halaman yang sama. Titik gedung bersama tidak dianggap bukti unit sama atau berbeda. Tidak ada penawaran baru Mamikos yang memenuhi radius dari sampel run ini; hasil nol bukan bukti tidak ada kos di sekitar masjid.

## Harga dan batas bukti

Harga paket 12 bulan tambahan Jendela360 dicocokkan dengan tampilan halaman: Rp 36,36 juta/tahun dengan minimum 12 bulan. Opsi pembayaran lain tetap dicatat sebagai total kontrak berbeda.

Tiga Pinhome memakai paket tahunan yang eksplisit dalam deskripsi: Bassura Rp 40 juta, Urbantown Rp 24 juta, dan Griya Alam Sentul Rp 20 juta. Angka ekuivalen bulanan pada portal tidak dijadikan janji pembayaran bulanan. Masing-masing bertajuk paket 12 bulan; opsi 3/6 bulan atau pembayaran bulanan berbeda harga dicatat bila tersedia. Minimum paket yang dicatat tidak menyatakan semua pilihan lain berdurasi 12 bulan.

Ketentuan minimum 3/6/12 bulan pada tambahan lain dipertahankan. IPL Embarcadero Rp 1,2 juta/bulan disebut terpisah dari sewa. Luas satu kontrakan lantai dua belum dicantumkan karena portal belum menjelaskan apakah ukuran tersebut milik unit. Konflik furnished tidak diputuskan dengan tebakan. Klaim bebas banjir atau kedekatan MRT pada judul sumber tidak menjadi fakta terverifikasi.

Seluruh 244 penawaran lama, 111 proyek dan fakta 78 masjid dipertahankan persis; hanya relasi masjid ke penawaran baru yang bertambah. Tanggal sumber 15 tambahan berasal 2025, 23 dari 2026 dan 1 tidak ditampilkan; tanggal pemeriksaan 4 November tidak menggantikan tanggal iklan. Pin perkiraan portal dan titik gedung bukan kepastian pintu unit. Stok, biaya akhir, izin keluarga dan rute berjalan perlu dikonfirmasi langsung.

## Contoh tambahan

| Penawaran                                                                                                                                                                                                     | Harga paket / tagihan | Minimum  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------- |
| [Studio di Urbantown Serpong — paket 12 bulan](https://www.pinhome.id/disewa/apartemen-sekunder/unit/disewakan-apartemen-di-apartmen-urbantown-serpong)                                                       | Rp 24.000.000/tahun   | 12 bulan |
| [Rumah sewa 2 kamar di Griya Alam Sentul — paket 12 bulan](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-rumah-griya-alam-sentul-2-kamar-tidur-baru-di-perum-griya-alam-sentul-c18-no-16) | Rp 20.000.000/tahun   | 12 bulan |
| [Apartemen 2 kamar Bassura City Apartment — paket 12 bulan](https://jendela360.com/sewa-apartemen-bassura-city-apartment/BSCC519)                                                                             | Rp 36.360.000/tahun   | 12 bulan |
| [Rumah sewa 2 kamar di Taman Kertamukti](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-daerah-cibitung-dengan-harga-terjangkau-di-taman-kertamukti-blok-c20-no-17)                     | Rp 750.000/bulan      | 3 bulan  |

## Kandidat baru yang ditahan

| Sumber                                                                                                                                                 | Alasan                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Halaman penawaran](https://www.pinhome.id/disewa/apartemen-sekunder/unit/disewakan-apartemen-di-fatmawati-city-center-2)                              | Label portal Rp 8,5 juta/tahun bertentangan dengan deskripsi Rp 8,5 juta/bulan; periode dan biaya kontrak belum konsisten.                               |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-jalan-gajah-mada-nmr-188)                                     | Kategori rumah berisi rincian apartemen bertower, dengan harga portal Rp 6 juta/bulan dan deskripsi Rp 6,5 juta/bulan; jenis dan harga perlu diperjelas. |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-jaan-multikarya)                                              | Portal Rp 3 juta/bulan minimum 12 bulan (Rp 36 juta) berbeda dari deskripsi Rp 34 juta/tahun; biaya kontrak perlu diperjelas.                            |
| [Halaman penawaran](https://www.pinhome.id/disewa/apartemen-sekunder/unit/disewakan-apartemen-lokasi-strategis-di-green-pramuka-city-1)                | Pembaruan sumber 2024; ketersediaan dan ketentuan belum didukung bukti terkini.                                                                          |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-jaka-mulya)                                                   | Harga portal Rp 33 juta/tahun berbeda dari deskripsi Rp 32 juta/tahun; biaya kontrak belum konsisten.                                                    |
| [Halaman penawaran](https://www.pinhome.id/disewa/apartemen-sekunder/unit/disewakan-apartemen-di-jatibening)                                           | Gedung apartemen tidak disebut, deskripsi kosong dan hanya kawasan Jatibening tersedia; identitas unit/lokasi gedung belum cukup terbukti.               |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-jalan-kebun-jeruk-gili-sampeng)                               | Deskripsi menawarkan overkontrak usaha barbershop beserta perlengkapan; bukan penawaran hunian untuk disewa.                                             |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-jlbuana-ayu-1-buana-gardenia)                                 | Hanya menyewakan satu kamar kos putri untuk satu orang, bukan satu rumah; tidak cocok untuk keluarga.                                                    |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-siap-pakai-harga-terbaik-jarang-ada-di-jalan-raya-villa-santika) | Pembaruan sumber 2024; ketersediaan dan ketentuan belum didukung bukti terkini.                                                                          |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-dua-lantai-super-strategis-di-jalan-kampung-sawah-krukut-depok)  | Pembaruan sumber 2024; ketersediaan dan ketentuan belum didukung bukti terkini.                                                                          |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-jalan-pinang-raya-no-99-kios-9m-persegi)                      | Deskripsi menyewakan kios 9 m², sedangkan portal mengategorikannya rumah 15 m²; bukan bukti penawaran hunian.                                            |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-ellok)                                                        | Spesifikasi 8 kamar dengan luas 60 m² tanpa deskripsi tidak menjelaskan apakah satu rumah atau beberapa unit; identitas hunian perlu diperjelas.         |
| [Halaman penawaran](https://www.pinhome.id/disewa/apartemen-sekunder/unit/disewakan-apartemen-sewa-sentul-tower-apartement-di-sentul-tower-apartement) | Studio Sentul Tower tanpa identitas unit pembeda dekat penawaran gedung yang telah dikurasi; luas 21/22 m² berbeda dan unit terpisah belum terbukti.     |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-jl-cigadung-wetan-no11-rt01-rw05-2)                           | Lokasi Bandung berada di luar fokus Jabodetabek batch ini.                                                                                               |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-kp-cipaheut-kaler-no-25-rt-04-rw-02)                          | Lokasi Bandung berada di luar fokus Jabodetabek batch ini.                                                                                               |

## Data dan tindak lanjut

Katalog dan ketentuan ada di `research/rentals.json`; lokasi, ketelitian dan hash bukti ada di `research/rental-locations.json`. Dataset aplikasi dibangun dengan `scripts/build-properties.py`. Hasil scraping tidak menerbitkan atau menghapus katalog secara otomatis; kandidat yang ditahan memerlukan bukti baru.
