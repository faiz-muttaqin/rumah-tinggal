# Pantauan sewa sekitar masjid Ihrish

Worker [rental_multi_crawler.py](../scripts/rental_multi_crawler.py) menjalankan pencarian pada **Pinhome, Jendela360, Realoka, dan Brighton**, maksimal dua situs bersamaan. Setiap situs mempunyai adapter, state, robots, dan pembatasan request sendiri; kegagalan satu situs tidak menghentikan sumber lain. [Konfigurasi masjid](../research/rental-crawl-sources.json) mencakup semua 78 lokasi dalam snapshot Ihrish 31 Oktober 2026, sedangkan [konfigurasi sumber](../research/rental-crawl-providers.json) mengatur kawasan dan jatah tiap situs. Beberapa masjid berbagi kawasan sehingga halaman cukup diambil sekali.

| Sumber     | Hasil yang dapat digunakan                              | Batas utama                                                                                     |
| ---------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Pinhome    | Harga/periode dan pin perkiraan dari detail iklan       | Pusat administratif dan duplikat ditahan                                                        |
| Jendela360 | Opsi pembayaran 1/3/6/12 bulan dan titik gedung         | Harga tampilan dapat berbeda dari harga periode; tanggal pembaruan tidak selalu tersedia        |
| Realoka    | Harga bulanan/tahunan dan kawasan tertulis              | Tanpa titik terbukti, hanya menjadi penawaran kawasan                                           |
| Brighton   | Penawaran sewa, harga, tanggal dan kawasan dari JSON-LD | Periode harus eksplisit; koordinat iklan banner tidak dipakai; query pagination dilarang robots |

Rumah123 dan Properti1 mengembalikan HTTP403 pada pemeriksaan server, sedangkan kategori OLX timeout. Ketiganya belum dijadwalkan otomatis; pembatasan akses tidak diakali.

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

Batas pencarian/detail per putaran: Pinhome150/240, Jendela36030/60, Realoka30/80, dan Brighton20/60. Jeda dalam tiap situs minimal1,5detik. Pinhome dan Realoka memutar pagination; Brighton hanya memakai halaman tanpa query sesuai robots, sedangkan Jendela360 memakai unit sewa SSR yang tersedia pada halaman publik (data awal lain dapat memuat unit dijual). Cache pencarian24jam dan detail72jam mengurangi pengambilan ulang. Cache kedaluwarsa ditandai dan tidak menjadi kandidat siap diperiksa. Pengambilan dengan batas tersebut adalah sampel, bukan inventaris seluruh unit. Nol kandidat tidak membuktikan tidak ada sewa di sekitar masjid. Laporan menyertakan jumlah detail dibaca, jumlah tautan ditemukan, tanggal pengambilan, dan kegagalan per sumber.

Badge **Bulanan** dan **Tahunan** mengikuti periode harga sumber; ekuivalen tahunan/12 tidak mengubah badge menjadi Bulanan. Badge **Minimal N bulan** hanya muncul jika durasi minimum tersedia secara terstruktur. Untuk Jendela360, harga kontrak tahunan, harga bulanan langsung, dan opsi3/6bulan disimpan terpisah; `display_price` tidak dipakai sebagai janji pembayaran bulanan. Tanggal relatif Realoka dipertahankan tanpa diubah menjadi tanggal hari pengambilan. Penawaran kawasan tanpa titik berada di bagian terpisah dan tidak dihitung sebagai hasil radius masjid.

HTTP401/403/429 atau halaman tantangan menghentikan situs terkait untuk putaran tersebut tanpa retry, sementara situs lain melanjutkan. Redirect harus tetap pada domain dan path publik yang diizinkan. Perubahan struktur halaman dicatat sebagai kegagalan parser, bukan dianggap nol listing.

## Jadwal dan pemisahan produksi

Template [service](../deploy/rumah-tinggal-rental-crawl.service.example) menjalankan salinan worker di `/opt/rumah-tinggal/research-worker` sebagai `DynamicUser`, dengan state sendiri di `/var/lib/rumah-tinggal-rental-crawl`. Bundle memuat9file: ketiga script crawler/adapter, dua konfigurasi, inventori masjid, `research/rentals.json` publik untuk deduplikasi, dan dua dataset transit. Worker tidak membutuhkan `.env`, kredensial, server aplikasi, atau database produksi. `ProtectHome` menutup akses `/root`; konfigurasi dan state aplikasi juga diblokir eksplisit.

Template [timer](../deploy/rumah-tinggal-rental-crawl.timer.example) berjalan pukul **06.20–06.30 WIB setiap hari**, termasuk sesudah reboot bila jadwal terlewat. Worker tidak membuka port dan tidak me-restart `rumah-tinggal.service`.

```sh
systemctl status rumah-tinggal-rental-crawl.timer
systemctl list-timers rumah-tinggal-rental-crawl.timer
systemctl start rumah-tinggal-rental-crawl.service
```

Periksa `latest.json` dan `lastRun.status` untuk membedakan run selesai dengan batas, berhenti karena sumber, dan terinterupsi. Status selesai tidak berarti seluruh detail atau halaman semua kawasan telah habis ditelusuri. Salinan worker perlu disinkronkan ulang setelah script, konfigurasi, inventori masjid, katalog, atau dataset transit berubah; jangan menyinkronkan direktori proyek secara keseluruhan.

Worker menghasilkan **kandidat privat untuk kurasi**, bukan penerbitan otomatis. Setelah peninjauan, perubahan katalog tetap melalui `research/rentals.json`, sidecar `research/rental-locations.json`, builder, validasi, dan proses rilis biasa. Hasil pencarian yang hilang tidak menghapus listing kurasi secara otomatis.

Rujukan sumber: [robots Pinhome](https://www.pinhome.id/robots.txt), [kategori rumah Kranji](https://www.pinhome.id/sewa/rumah/jawa-barat/bekasi/bekasi-barat/kranji), dan [kategori apartemen Cempaka Putih](https://www.pinhome.id/sewa/apartemen/dki-jakarta/jakarta-pusat/cempaka-putih). Pemetaan awal kawasan juga dibantu pemeriksaan satu kali titik masjid pada OpenStreetMap/Nominatim dengan cache dan satu thread, mengikuti [kebijakan Nominatim](https://operations.osmfoundation.org/policies/nominatim/). Worker harian tidak melakukan geocoding ulang.
