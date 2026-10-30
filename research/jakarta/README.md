# Rencana riset hunian Jakarta

Dicatat **2026-10-30 WIB**, atas arahan pengguna. **Status: berjalan bertahap sejak 2026-10-30.** Pelaksanaan memakai sedikit agen per langkah dengan hasil dicatat sebelum langkah berikutnya; lihat [progres](#progres-2026-10-30).

## Tujuan

Memperbanyak listing hunian Jakarta dan membangun konteks yang bisa ditelusuri: properti berada di wilayah mana, apa yang pernah terjadi di sekitarnya, bagaimana akses dan aktivitasnya, serta bagaimana wilayah tersebut terhubung ke tempat kerja. Setiap hubungan perlu bukti, tanggal, dan skala lokasi yang jelas.

Prioritas tujuan adalah memperkaya listing yang relevan. Kajian lingkungan, berita, dan mobilitas menjadi pengayaan bertahap; jumlah listing, jenis hunian, dan urutan pelaksanaannya belum ditetapkan.

## Titik awal yang sudah tersedia

Snapshot dari rilis `e680bdb`, dataset dicek **2026-10-30**:

| Bagian                        | Kondisi                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Katalog peta Jabodetabek      | 28 proyek; 12 dikelompokkan sebagai Jakarta                                                                    |
| Bukti pada 12 proyek Jakarta  | 1 `confirmed`, 11 `partial`; kelengkapan bukti perlu menjadi bagian rencana pengayaan                          |
| Bahan kurasi                  | 64 proyek; 36 belum masuk peta karena lokasi, radius, atau bukti                                               |
| Penemuan sebelumnya           | 171 kandidat pada 13 koridor; ada duplikat lintas koridor dan pemeriksaan belum lengkap                        |
| Cakupan riset awal            | Proyek baru untuk dibeli, maksimal 3 km garis lurus dari titik KRL/MRT/LRT dalam dataset aplikasi              |
| Integrasi yang sudah berjalan | Sumber/tanggal cek, peta, Listingku, pin pribadi, serta tautan lokasi dan rute Google Maps                     |
| Data yang belum tersedia      | Kajian banjir/kriminalitas, hubungan berita, ulasan dan keramaian tempat, populasi wilayah, serta arus komuter |

Angka awal tersebut bukan jumlah seluruh hunian Jakarta. Kandidat lintas koridor tidak boleh dijumlahkan sebagai properti unik tanpa pemeriksaan duplikat. Rincian sumber dan batas data awal ada di [metode riset](../../docs/property-research.md).

## Backlog rencana

Semua item berikut berstatus **PLANNED**. ID dipakai untuk merujuk pekerjaan nanti, bukan menunjukkan urutan prioritas yang sudah disepakati.

| ID     | Ruang riset                               | Keluaran yang direncanakan                                                                                                                                                                     |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JKT-01 | Cakupan dan kekosongan data               | Peta cakupan Jakarta per wilayah, koridor transportasi, jenis hunian, segmen harga, serta daftar sumber/kandidat yang belum diperiksa                                                          |
| JKT-02 | Perluasan listing properti                | Listing tambahan dari situs proyek/developer, portal, web publik, dan tautan Instagram; harga, status, sumber, tanggal cek, identitas proyek, serta koordinat yang dapat dipertanggungjawabkan |
| JKT-03 | Banjir dan kondisi lingkungan             | Catatan kejadian atau peta cakupan banjir yang terhubung ke wilayah/lokasi; periode, sumber, ketelitian lokasi, dan relevansi terhadap listing                                                 |
| JKT-04 | Kriminalitas dan keamanan                 | Catatan kejadian/statistik agregat dengan jenis kejadian, wilayah, periode, serta cakupan pelaporan; hubungan ke listing harus bisa ditelusuri                                                 |
| JKT-05 | Berita dan hubungan antarinformasi        | Kronologi kejadian serta perubahan kawasan, proyek, infrastruktur, dan akses; tautan yang mendukung, bertentangan, atau masih berupa dugaan hubungan                                           |
| JKT-06 | Google Maps, ulasan, dan aktivitas tempat | Pengayaan referensi tempat, ulasan, pola jam ramai/sepi bila tersedia, serta akses dari hunian; kelayakan akses dan penyimpanan data diperiksa saat pelaksanaan                                |
| JKT-07 | Populasi dan arus ke tempat kerja         | Penduduk dan kepadatan menurut wilayah/periode; kajian perbedaan aktivitas siang/malam, asal–tujuan komuter, pusat pekerjaan, dan akses transportasi                                           |
| JKT-08 | Penyajian dan pemeliharaan data           | Rancangan hubungan listing–wilayah–tempat–kejadian–sumber; cara menampilkan bukti, ketidakpastian, umur data, pembaruan, dan koreksi pada aplikasi                                             |

## Progres 2026-10-30

| ID                 | Status          | Hasil                                                                                                                                                                                                                                                                                               |
| ------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JKT-01             | Sebagian        | 81 stasiun KRL/MRT/LRT di wilayah Jakarta; tanpa proyek terbit dalam 3 km turun dari 39 menjadi 15 (Ancol, Angke, Buaran, Duri, Grogol, Jakarta International Stadium, Pesing, Pondok Jati, Tanjung Priok, Universitas Pancasila, serta LRT Boulevard Selatan, Equestrian, Halim, Pramuka, Pulomas) |
| JKT-02             | Sebagian        | 48 kandidat Jakarta yang verifikasinya tertunda diperiksa ulang: 23 confirmed, 24 partial, 1 ditolak. Katalog terbit 46 proyek, 29 di Jakarta (sebelumnya 12). Sebagian besar sisanya belum punya titik proyek terverifikasi                                                                        |
| JKT-03             | Sumber ditinjau | Belum ditampilkan; menunggu keputusan lisensi dan data BPBD. Rincian di [sumber konteks wilayah](sumber-konteks.md)                                                                                                                                                                                 |
| JKT-07             | Sebagian        | Estimasi penduduk dalam 500 m dan 1 km dari WorldPop 2025 tampil per proyek. Penduduk resmi BPS/Dukcapil dan komuter BPS 2023 memerlukan kunci atau unduhan manual                                                                                                                                  |
| JKT-04, 05, 06, 08 | Rencana         | Belum dimulai; Google Places API resmi tidak menyediakan jam ramai                                                                                                                                                                                                                                  |

## Calon sumber untuk diperiksa nanti

Daftar ini adalah agenda pencarian. Ketersediaan dataset, ketelitian lokasi, periode, cara akses, biaya, dan izin penggunaannya **belum diperiksa dalam tahap pencatatan ini**.

| Kebutuhan                     | Calon sumber atau jalur pencarian                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Listing                       | Situs developer/proyek, portal properti, web publik, tautan akun/unggahan Instagram, serta kandidat yang sudah ditemukan pada batch awal |
| Banjir                        | Instansi penanggulangan bencana dan pemerintah daerah, data kewilayahan resmi, serta berita kejadian sebagai pelengkap                   |
| Kriminalitas                  | Statistik atau laporan resmi yang tersedia, pemerintah daerah, serta berita kejadian yang dikonfirmasi silang                            |
| Berita dan perubahan kawasan  | Pengumuman resmi, sumber primer proyek/infrastruktur, dan media dengan tanggal serta lokasi kejadian yang jelas                          |
| Tempat, ulasan, dan aktivitas | Google Maps dan jalur akses resmi yang sesuai; cakupan fitur dan kelayakan pemakaian perlu ditentukan                                    |
| Penduduk dan komuter          | Publikasi BPS, pemerintah daerah, dan kajian transportasi/komuter yang menyediakan data agregat                                          |

## Cara menghubungkan informasi

Rancangan awal hubungan: **listing → titik/kawasan → wilayah atau tempat terkait → kejadian/indikator → sumber**. Hubungan lintas informasi perlu mencatat alasan pengaitan, periode, dan ketelitian lokasi.

- Harga dan ketersediaan tetap melekat pada listing/tipe unit beserta sumber dan tanggal ceknya. Nama developer atau pemasang iklan tidak otomatis membuktikan kepemilikan unit.
- Kejadian banjir dan kriminalitas dicatat sebagai kejadian atau statistik pada wilayah/periode tertentu. Berita yang menyebut satu kecamatan belum membuktikan kondisi pada setiap alamat di kecamatan itu.
- Bedakan tanggal kejadian, tanggal terbit, tanggal data berlaku, dan tanggal pemeriksaan. Informasi lama tidak otomatis menjadi kondisi saat ini.
- Beberapa berita yang mengutip kejadian atau sumber yang sama perlu dikelompokkan agar tidak dihitung sebagai bukti independen atau beberapa kejadian.
- Bedakan hubungan yang didukung bukti, hubungan yang bertentangan, kedekatan lokasi saja, dan hipotesis yang masih perlu diperiksa. Kedekatan lokasi/waktu bukan bukti sebab-akibat.
- Hubungan dengan Listingku dan pin pribadi tetap berada dalam konteks akun pengguna; data pribadi tidak disalin ke katalog riset publik.

Gunakan [template temuan](template-temuan.md) saat pelaksanaan. Ini usulan format catatan, belum merupakan skema database baru.

## Populasi, keramaian, dan arus manusia

Tiga ukuran perlu dipisahkan dalam rencana analisis:

| Ukuran                        | Yang hendak dikaji                                                               | Batas penafsiran                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Penduduk dan kepadatan hunian | Jumlah penduduk serta penduduk per luas wilayah pada periode tertentu            | Penduduk tempat tinggal tidak langsung menunjukkan keramaian jalan atau aktivitas siang hari                                          |
| Aktivitas suatu tempat        | Pola kunjungan atau jam ramai/sepi pada tempat tertentu, jika datanya tersedia   | Ulasan, jumlah ulasan, atau kepadatan penduduk tidak boleh langsung dianggap sebagai hitungan pengunjung saat ini                     |
| Arus komuter                  | Perpindahan agregat dari wilayah asal ke wilayah tujuan kerja menurut waktu/moda | Perlu data asal–tujuan atau dasar estimasi yang jelas; jumlah penduduk saja tidak cukup untuk menyimpulkan arah dan volume perjalanan |

Jika nanti memakai estimasi, catat asumsi, unit, periode, versi batas wilayah, dasar perhitungan, dan ketidakpastiannya. Perbandingan antarwilayah perlu memakai definisi yang sebanding. Analisis arus diarahkan pada data agregat, bukan pelacakan individu.

## Keputusan yang ditunda sampai perencanaan delegasi

- Cakupan Jakarta dan wilayah komuter pendukung; pembagian wilayah serta target jumlah listing per batch.
- Jenis listing tambahan: proyek baru, sekunder, iklan perorangan, sewa, atau kos. Pembatasan radius/moda riset awal juga perlu diputuskan ulang bila ingin diperluas.
- Urutan prioritas pengayaan, sumber yang akan dipakai, akses yang tersedia, dan anggaran bila diperlukan.
- Pembagian tugas agen, pemilik berkas, kriteria verifikasi, peninjauan hasil, serta cara integrasi ke aplikasi.

Ketika pengguna menyusun delegasi, tiap brief perlu menyebut tujuan tunggal, fakta yang sudah diperiksa, cakupan sumber/wilayah, berkas keluaran, batas tindakan, dan kriteria selesai. Tidak ada agen, jadwal riset otomatis, atau pengambilan data baru yang diaktifkan oleh dokumen ini.
