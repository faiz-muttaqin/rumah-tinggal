# Pantauan sewa sekitar masjid Ihrish

Worker [rental_multi_crawler.py](../scripts/rental_multi_crawler.py) menjalankan pencarian pada **Pinhome, Jendela360, Realoka, Brighton, Jakarta Prime, dan Mamikos**, maksimal dua situs bersamaan. Jakarta Prime merupakan sumber broker tambahan, bukan portal agregator nasional. Setiap situs mempunyai adapter, state, robots, dan pembatasan request sendiri; kegagalan satu situs tidak menghentikan sumber lain. [Konfigurasi masjid](../research/rental-crawl-sources.json) mencakup semua 78 lokasi dalam snapshot Ihrish 31 Oktober 2026, sedangkan [konfigurasi sumber](../research/rental-crawl-providers.json) mengatur kawasan dan jatah tiap situs. Beberapa masjid berbagi kawasan sehingga halaman cukup diambil sekali.

| Sumber        | Hasil yang dapat digunakan                                              | Batas utama                                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pinhome       | Harga/periode dan pin perkiraan dari detail iklan                       | Pusat administratif dan duplikat ditahan                                                                                                                           |
| Jendela360    | Opsi pembayaran 1/3/6/12 bulan dan titik gedung                         | Harga tampilan dapat berbeda dari harga periode; tanggal pembaruan tidak selalu tersedia                                                                           |
| Realoka       | Harga bulanan/tahunan dan kawasan tertulis                              | Tanpa titik terbukti, hanya menjadi penawaran kawasan                                                                                                              |
| Brighton      | Penawaran sewa, harga, tanggal dan kawasan dari JSON-LD                 | Periode harus eksplisit; koordinat iklan banner tidak dipakai; query pagination dilarang robots                                                                    |
| Jakarta Prime | Harga sewa bulanan/tahunan dan kawasan dari JSON-LD                     | Jakarta Selatan/Pusat dan kategori rumah; USD, tanah, harga tidak konsisten, dan stok tidak aktif ditahan; tanpa pin unit terbukti hanya menjadi penawaran kawasan |
| Mamikos       | Kos dari sitemap kota, harga pembayaran, aturan penghuni dan pin publik | Harga yang berbeda antarfield, kamar penuh, pemilik tidak aktif, atau izin pasutri/anak belum terbukti ditahan; pin tetap perkiraan                                |

Rumah123 dan Properti1 mengembalikan HTTP403 pada pemeriksaan server, sedangkan kategori OLX timeout. Ketiganya belum dijadwalkan otomatis; pembatasan akses tidak diakali.

Pemeriksaan tambahan 3 November 2026: kategori 99.co ditolak HTTP403; robots Dot Property, Lamudi, dan Sewa-Apartemen.net juga ditolak HTTP403. Situs tersebut tetap sumber manual. Hasil pencarian web yang dapat dibaca tidak membuktikan server worker dapat mengambil halaman secara terjadwal.

Prioritas mengikuti permintaan pengguna: masjid dekat transportasi umum, mulai Jakarta Selatan lalu menjauh dari Blok M. Kedekatan awal memakai batas 1,5 km untuk MRT/KRL/LRT dan 700 meter untuk halte Transjakarta dari dataset lokal. Stasiun rencana tidak dipakai. Blok M hanya acuan pengurutan kawasan. Semua jarak garis lurus; posisi pintu masuk, rute berjalan, waktu tempuh, dan jadwal layanan belum dibuktikan oleh perhitungan ini.

## Menjalankan

Python 3 stdlib cukup; tidak membutuhkan API key, akun portal, atau dependency baru. Dari root proyek:

```sh
./dev rentals:plan
./dev rentals:crawl
./dev test:rental-crawler
```

Perintah pertama hanya membuat rencana tanpa jaringan. Pengambilan nyata memerlukan `--run`. Untuk pilot kecil:

```sh
python3 -I scripts/rental_crawler.py --run --max-search 6 --max-detail 12
```

Contoh di atas menjalankan Pinhome saja. Untuk membatasi pilot lintas situs:

```sh
python3 -I scripts/rental_multi_crawler.py --run \
  --providers jendela360,realoka,brighton --max-search 24 --max-detail 12
./dev rentals:report
```

Batas request berlaku **per situs**, bukan total gabungan. Keluaran lokal berada di `.runtime/research/rental-crawl/`: state Pinhome lama tetap di root, sumber lain di `providers/NAMA/`, dan laporan gabungan di `multi-latest.md/json`. `rentals:report` menyusun ulang laporan dari cache tanpa jaringan. Direktori privat bermode 700 dan file 600. Lock global dan per situs mencegah job ganda. Hasil tidak masuk Git, document root, atau SQLite aplikasi. Pembatalan dan batas waktu menyimpan progres serta laporan sebagian.

## Penemuan dan mutu bukti

1. Ambil `robots.txt` setiap run. Gunakan User-Agent yang menjelaskan aplikasi, satu request pada satu waktu, dan jeda minimal 1,5 detik atau `Crawl-delay` yang lebih besar.
2. Baca halaman kategori sewa per kawasan untuk dua jenis hunian. Simpan tautan iklan dan ringkasan kartu; jangan mengeksekusi JavaScript sumber. Satu putaran mengambil halaman pertama setiap kawasan sebelum memutar halaman lanjutan. Cursor bergilir mencegah pagination kawasan besar menghabiskan seluruh jatah.
3. Baca detail bergiliran antarkawasan, mengikuti prioritas masjid. URL yang belum pernah dibaca didahulukan agar pengambilan harian terus menemukan pilihan baru. Dalam kelompok tersebut harga kartu yang lebih rendah didahulukan. Harga kartu hanya petunjuk pengurutan; kandidat memerlukan harga dan periode dari detail.
4. Terima hubungan masjid hanya bila koordinat halaman iklan berada dalam radius mentah 1,5 km. Tolak koordinat administratif bawaan. Tanpa koordinat yang terbukti, iklan tetap ditahan. Pin portal tetap titik perkiraan, bukan pintu unit.
5. Tahan status tidak aktif/tersewa, periode tidak dikenal, harga tidak wajar, indikasi penggunaan komersial/harian, pin perkiraan yang dipakai bersama, dan foto yang dipakai lebih dari satu iklan. Beberapa unit apartemen boleh berbagi titik gedung; itu tidak otomatis berarti unitnya sama. Kemiripan koordinat, luas, kamar dan harga antarsitus menandai dugaan sindikasi beserta kedua URL; iklan tidak digabung atau dihapus diam-diam. Kandidat lain juga masih memerlukan kurasi lokasi, isi iklan, dan ketersediaan.
6. Pertahankan tanggal pembaruan sumber terpisah dari waktu pengambilan. Pembagian harga tahunan dengan 12 hanya pembanding; bukan janji pembayaran bulanan. Nama/kontak pengiklan, alamat unit lengkap, cookies, gambar, deskripsi penuh, dan HTML mentah tidak disimpan oleh worker.

Batas pencarian/detail per putaran: Pinhome150/240, Jendela36030/60, Realoka30/80, Brighton20/60, Jakarta Prime6/40, dan Mamikos40/60. Total batas detail menjadi **540 per putaran**, dengan batas276permintaan pencarian; angka ini bukan jumlah penawaran valid atau baru. Jeda dalam tiap situs minimal1,5detik. Pinhome dan Realoka memutar pagination; Brighton hanya memakai halaman tanpa query sesuai robots, sedangkan Jendela360 memakai unit sewa SSR yang tersedia pada halaman publik (data awal lain dapat memuat unit dijual). Jakarta Prime membaca dua kategori apartemen yang telah diuji dan kategori rumah, tanpa query/filter/API internal. Cache pencarian **4 jam** memungkinkan halaman kategori diperbarui pada putaran pagi, siang, dan sore. Cache detail tetap **72 jam**; URL baru didahulukan, sehingga tiga putaran tidak berarti seluruh iklan lama diperiksa ulang tiga kali sehari. Cache kedaluwarsa ditandai dan tidak menjadi kandidat siap diperiksa. Pengambilan dengan batas tersebut adalah sampel, bukan inventaris seluruh unit. Nol kandidat tidak membuktikan tidak ada sewa di sekitar masjid. Laporan menyertakan jumlah detail dibaca, jumlah tautan ditemukan, tanggal pengambilan, dan kegagalan per sumber.

Badge **Bulanan** dan **Tahunan** mengikuti periode harga sumber; ekuivalen tahunan/12 tidak mengubah badge menjadi Bulanan. Badge **Minimal N bulan** hanya muncul jika durasi minimum tersedia secara terstruktur. Untuk Jendela360, harga kontrak tahunan, harga bulanan langsung, dan opsi3/6bulan disimpan terpisah; `display_price` tidak dipakai sebagai janji pembayaran bulanan. Tanggal relatif Realoka dipertahankan tanpa diubah menjadi tanggal hari pengambilan. Penawaran kawasan tanpa titik berada di bagian terpisah dan tidak dihitung sebagai hasil radius masjid.

Jakarta Prime memakai `offers.priceSpecification.billingDuration` (`P1M` atau `P1Y`) dan mata uang IDR, bukan angka ekuivalen di halaman. Periode tagihan tidak dianggap minimum sewa. `datePosted` tetap tanggal publikasi sumber; tidak diganti tanggal pemeriksaan. Geo `RealEstateAgent` adalah kantor broker dan diabaikan. Koordinat unit belum terbukti dari HTML sampel; iklan baru dari situs ini belum menjadi pin atau penawaran dalam radius masjid secara otomatis. Contoh bukti primer: [kategori Jakarta Selatan](https://jakartaprime.com/sewa-apartemen/jakarta-selatan), [kategori rumah](https://jakartaprime.com/sewa-rumah), dan [detail studio Fatmawati](https://jakartaprime.com/listing/disewakan-apartemen-fatmawati-city-center-studio-full-furnished-kdm8mz).

Mamikos memakai **39 sitemap publik kos** yang tercantum pada [indeks sumber](https://mamikos.com/sitemaps/sitemap/sitemap-index-detail-kost.xml): Jakarta9, Bekasi9, Bogor6, Depok5, dan Tangerang10. Total rencana lintas sumber209URL. Cakupan sitemap adalah kota, bukan pencarian khusus setiap masjid; Bandung belum tercakup. Hanya `url/loc` tingkat properti yang dibaca, tanpa mengunduh foto. Halaman kategori Mamikos memuat daftar melalui JavaScript, sehingga worker tidak menganggap HTML kategori kosong sebagai nol kos dan tidak memakai API internal. Detail dibaca dari satu nilai JSON `var detail`, tanpa menjalankan JavaScript halaman.

Harga bulanan/tahunan Mamikos harus cocok dengan `price_title_formats` dalam rupiah dan periode yang sama. Nominal promo `price_title` tidak menggantikan harga kontrak. Opsi3/6bulan disimpan sebagai total periode; minimum hanya dari `min_month`, tanpa mengarang minimum1bulan atau12bulan. Kamar penuh, harga konflik, pemilik tidak aktif dan penanda sumber belum diperbarui ditahan. Label campur tidak membuktikan izin pasutri atau anak: keduanya harus eksplisit pada `booking_rules` sebelum menjadi kandidat keluarga. Koordinat `detail.latitude/longitude` adalah pin perkiraan portal; field `location` tidak digunakan sebagai pengganti. Tanggal sumber tetap dipertahankan, termasuk tanggal lama atau tidak tersedia. Contoh kos keluarga pada [halaman sumber](https://mamikos.com/room/kost-bekasi-kost-campur-murah-kost-pondok-asri-tipe-standar-tambun-utara-bekasi) juga memperlihatkan alasan pentingnya menahan ketidakcocokan harga antarfield.

HTTP401/403/429 atau halaman tantangan menghentikan situs terkait untuk putaran tersebut tanpa retry, sementara situs lain melanjutkan. Redirect harus tetap pada domain dan path publik yang diizinkan. Perubahan struktur halaman dicatat sebagai kegagalan parser, bukan dianggap nol listing.

## Jadwal dan pemisahan produksi

Template [service](../deploy/rumah-tinggal-rental-crawl.service.example) menjalankan salinan worker di `/opt/rumah-tinggal/research-worker` sebagai `DynamicUser`, dengan state sendiri di `/var/lib/rumah-tinggal-rental-crawl`. Bundle memuat9file: ketiga script crawler/adapter, dua konfigurasi, inventori masjid, `research/rentals.json` publik untuk deduplikasi, dan dua dataset transit. Worker tidak membutuhkan `.env`, kredensial, server aplikasi, atau database produksi. `ProtectHome` menutup akses `/root`; konfigurasi dan state aplikasi juga diblokir eksplisit.

Tiga timer memulai worker **tiga kali sehari**, dengan waktu acak baru di dalam masing-masing rentang WIB:

| Waktu | Rentang mulai   | Template timer                                                    |
| ----- | --------------- | ----------------------------------------------------------------- |
| Pagi  | **06.20–06.30** | [pagi](../deploy/rumah-tinggal-rental-crawl.timer.example)        |
| Siang | **12.30–13.00** | [siang](../deploy/rumah-tinggal-rental-crawl-siang.timer.example) |
| Sore  | **17.10–17.50** | [sore](../deploy/rumah-tinggal-rental-crawl-sore.timer.example)   |

Semua menunjuk `rumah-tinggal-rental-crawl.service` yang sama; service dan lock mencegah proses ganda. `RandomizedDelaySec` masing-masing 10/30/40 menit dengan `AccuracySec=1us` dan `FixedRandomDelay=no`, sesuai [dokumentasi systemd.timer](https://www.freedesktop.org/software/systemd/man/255/systemd.timer.html). `Persistent=no` melewati jadwal saat server mati, sehingga reboot malam tidak mengejar jadwal yang terlewat. Tidak ada jadwal malam. Rentang di atas adalah waktu mulai; satu proses dibatasi 45 menit. Worker tidak membuka port dan tidak me-restart `rumah-tinggal.service`.

Pasang ketiga template sebagai nama yang sama tanpa akhiran `.example`, lalu aktifkan seluruh timer:

```sh
systemctl daemon-reload
systemctl enable --now rumah-tinggal-rental-crawl.timer rumah-tinggal-rental-crawl-siang.timer rumah-tinggal-rental-crawl-sore.timer
systemctl list-timers 'rumah-tinggal-rental-crawl*.timer'
```

Periksa `latest.json` dan `lastRun.status` untuk membedakan run selesai dengan batas, berhenti karena sumber, dan terinterupsi. Status selesai tidak berarti seluruh detail atau halaman semua kawasan telah habis ditelusuri. Salinan worker perlu disinkronkan ulang setelah script, konfigurasi, inventori masjid, katalog, atau dataset transit berubah; jangan menyinkronkan direktori proyek secara keseluruhan.

Worker menghasilkan **kandidat privat untuk kurasi**, bukan penerbitan otomatis. Setelah peninjauan, perubahan katalog tetap melalui `research/rentals.json`, sidecar `research/rental-locations.json`, builder, validasi, dan proses rilis biasa. Hasil pencarian yang hilang tidak menghapus listing kurasi secara otomatis.

Rujukan sumber: [robots Pinhome](https://www.pinhome.id/robots.txt), [kategori rumah Kranji](https://www.pinhome.id/sewa/rumah/jawa-barat/bekasi/bekasi-barat/kranji), dan [kategori apartemen Cempaka Putih](https://www.pinhome.id/sewa/apartemen/dki-jakarta/jakarta-pusat/cempaka-putih). Pemetaan awal kawasan juga dibantu pemeriksaan satu kali titik masjid pada OpenStreetMap/Nominatim dengan cache dan satu thread, mengikuti [kebijakan Nominatim](https://operations.osmfoundation.org/policies/nominatim/). Worker harian tidak melakukan geocoding ulang.
