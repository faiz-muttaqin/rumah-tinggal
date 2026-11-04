# Kurasi hasil scraping siang — 4 November 2026

Sebanyak **33 penawaran tambahan** masuk katalog: **27 kontrakan/rumah sewa dan 6 apartemen**, dari 32 Pinhome dan 1 Jendela360. Katalog bertambah dari 283 menjadi **316 penawaran**, dengan **311 bertitik** dan **288 dalam radius acuan 1,5 km masjid Ihrish**. Seluruh tambahan berstatus sebagian terverifikasi; jumlah penawaran bukan jaminan unit unik atau stok tersedia.

## Hasil scraping dan pembandingan

Worker terjadwal enam sumber berjalan pada 4 November **12.55–13.08 WIB**, selesai exit 0. Laporan aktual dibuat pukul 13.08 WIB, memuat **2872 detail berhasil dari 2882 attempt secara kumulatif**, serta 906 petunjuk kawasan tanpa titik terbukti. Angka kumulatif bukan hasil satu putaran; petunjuk kawasan tidak dihitung sebagai hasil radius masjid. Putaran ini melakukan 444 permintaan detail: Pinhome 240, Jendela360 2, Realoka 80, Brighton 22, Jakarta Prime 40, dan Mamikos 60. Tidak ada pengambilan penuh manual tambahan.

Dari **113 kandidat yang belum berkatalog**, **70 sudah ditahan pada kurasi sebelumnya** dan **43 belum pernah ditinjau**. Semua 43 diambil ulang melalui HTTP publik dengan robots dan jeda minimal 1,5 detik/domain, tanpa kegagalan akses. Sebanyak 34 rincian diperiksa lagi secara terarah. Dari 43 tersebut, 33 diterima dan 10 ditahan. Keputusan held lama tetap memerlukan bukti baru.

Pembandingan mencakup URL katalog, penanda foto yang dipakai ulang dari worker, kedekatan pin dan spesifikasi terhadap penawaran lama maupun sesama kandidat, serta harga/periode/minimum pada halaman yang sama. Satu pasangan Pejaten Timur memiliki harga, luas, kamar, dan pin berdekatan; hanya satu penawaran dicatat. Opsi bulanan rumah Kiara 2 yang sudah berkatalog tahunan ditahan sebagai dugaan unit sama. Titik gedung bersama tidak membuktikan dua unit sama atau berbeda. Tidak ada tambahan Mamikos yang memenuhi syarat radius dari sampel ini; hasil nol bukan bukti tidak ada kos sekitar masjid.

## Harga dan batas bukti

Paket **12 bulan The Newton 2 Ciputra, NCWA018**, dicocokkan pada tampilan halaman Jendela360: **Rp 90,9 juta/tahun**, minimum 12 bulan untuk paket yang dicatat. Opsi 3 bulan Rp 27,35 juta dan 6 bulan Rp 49,58 juta tetap dicatat sebagai total kontrak berbeda.

Rumah Utan Kayu Utara memakai minimum **6 bulan** dari deskripsi, meski label portal menyebut 1 bulan. Rumah Sarua memakai minimum komitmen **3 bulan**, meski label portal menyebut 1 bulan; opsi paket 3/6 bulan memiliki total berbeda. Tarif pembayaran per bulan tidak menghapus minimum kontrak tersebut. Penawaran Pondok Kacang Timur mencatat paket **Rp 24 juta/tahun**; opsi bulanan Rp 2,1 juta memiliki pembayaran awal 6 bulan dan deposit Rp 4 juta.

Dua jumlah kamar tidak dicantumkan karena spesifikasi berbeda dari deskripsi atau mencakup ruang serbaguna. Luas Bogor Icon tidak dicantumkan karena portal menyebut 26 m² dan deskripsi 62 m². Sumber dengan konflik harga atau lokasi ditahan, bukan dikoreksi melalui tebakan. Klaim bebas banjir dan kedekatan fasilitas pada iklan tidak menjadi fakta terverifikasi mandiri.

Seluruh **283 penawaran lama**, **111 proyek**, dan **fakta 78 masjid** dipertahankan persis; hanya relasi ke penawaran baru yang bertambah. Tanggal sumber 21 tambahan berasal dari 2025, 11 dari 2026, dan 1 tidak ditampilkan. Tanggal pemeriksaan 4 November tidak menggantikan tanggal iklan. Pin portal dan titik gedung bukan kepastian pintu unit; stok, biaya akhir, izin keluarga, dan rute berjalan perlu dikonfirmasi langsung.

## Contoh tambahan

| Penawaran                                                                                                                                     | Harga paket / tagihan | Minimum  |
| --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------- |
| [Rumah sewa di Utan Kayu Utara](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-jalan-wahab-ii-utan-kayu-utara-matraman) | Rp 3.300.000/bulan    | 6 bulan  |
| [Rumah sewa 1 kamar di Sarua](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-jl-kembang-sepatu)                         | Rp 1.300.000/bulan    | 3 bulan  |
| [Rumah sewa di Pondok Kacang Timur — paket 12 bulan](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-maharta-1-c)        | Rp 24.000.000/tahun   | 12 bulan |
| [Studio The Newton 2 Ciputra — paket 12 bulan](https://jendela360.com/sewa-apartemen-the-newton-2-ciputra-apartment/NCWA018)                  | Rp 90.900.000/tahun   | 12 bulan |

## Kandidat baru yang ditahan

| Sumber                                                                                                                                                    | Alasan                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-swadaya-1-poltangan-rt-004-011-no30d-jaksel)                     | Dugaan duplikat Pejaten Timur: harga, 3 kamar, luas 100 m², dan kawasan sama, dengan pin berjarak sekitar 25 m; unit terpisah belum terbukti.    |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-apartemen-bassura-city-3)                                        | Kategori rumah tetapi judul menyebut apartemen; deskripsi kosong sehingga jenis hunian dan identitas unit belum cukup terbukti.                  |
| [Halaman penawaran](https://www.pinhome.id/disewa/apartemen-sekunder/unit/disewakan-apartemen-2br-di-kemang-view-tower-pinus-di-apartement-kemang-view)   | Pembaruan sumber 2024; ketersediaan dan ketentuan belum didukung bukti terkini.                                                                  |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-bojong-kulur-12)                                                 | Rumah Kiara 2 dengan spesifikasi sama sudah berkatalog tahunan, pin sekitar 10 m; opsi bulanan tidak membuktikan unit baru.                      |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-bebas-banjir-villa-nusa-indah-3-di-villa-nusa-indah-3-bojong-kulur) | Judul menyebut Villa Nusa Indah 3, deskripsi menyebut Villa Nusa Indah 4; lokasi klaster/unit belum konsisten.                                   |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-villa-mahkota-pesona-blok-ii6-no5)                               | Harga portal Rp 3,5 juta/bulan berbeda dari deskripsi Rp 2 juta/bulan; luas bangunan 54/92 m² juga bertentangan.                                 |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-ocbd-bogor-4)                                                    | Judul menyebut OCBD Bogor, deskripsi menyebut Bukit Cimanggu City; pin nyaris sama dengan kandidat lain, identitas lokasi belum cukup dibedakan. |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-bagus-2-lantai-di-pakuan-hills-tajur)                               | Judul menyebut Pakuan Hills Tajur, deskripsi menyebut Bukit Cimanggu City/OCBD, pin di Cibadak; lokasi belum konsisten.                          |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-cantik-asrie-hot-pisan-di-jln-batujajar)                            | Lokasi Bandung Barat berada di luar fokus Jabodetabek batch ini.                                                                                 |
| [Halaman penawaran](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-bagus-sekali-di-graha-kencana-batujajar-f9-no-15)                   | Lokasi Bandung Barat berada di luar fokus Jabodetabek batch ini.                                                                                 |

## Data dan tindak lanjut

Katalog dan ketentuan ada di `research/rentals.json`; lokasi, ketelitian, dan hash bukti ada di `research/rental-locations.json`. Dataset aplikasi dibangun dengan `scripts/build-properties.py`. Hasil scraping tidak menerbitkan atau menghapus katalog secara otomatis. Laporan worker masih memuat baseline sebelum input 33; putaran berikutnya akan membaca katalog terbaru. Sisa kandidat baseline 80 terdiri dari 70 held lama dan 10 held baru.
