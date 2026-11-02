# Pantauan sewa sekitar masjid Ihrish

Worker [rental_crawler.py](../scripts/rental_crawler.py) menemukan iklan rumah dan apartemen dari halaman kategori publik Pinhome. [Konfigurasi](../research/rental-crawl-sources.json) mencakup semua 78 masjid dalam snapshot Ihrish 31 Oktober 2026. Beberapa masjid berbagi kawasan sehingga halaman cukup diambil sekali.

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

Keluaran lokal berada di `.runtime/research/rental-crawl/`: `plan.json`, `state.json`, `latest.json`, dan laporan `latest.md`. Direktori privat bermode 700 dan file 600. Lock mencegah dua proses memakai state yang sama. Hasil tidak masuk Git, document root, atau SQLite aplikasi. Pembatalan dan batas waktu menyimpan progres serta laporan sebagian.

## Penemuan dan mutu bukti

1. Ambil `robots.txt` setiap run. Gunakan User-Agent yang menjelaskan aplikasi, satu request pada satu waktu, dan jeda minimal 1,5 detik atau `Crawl-delay` yang lebih besar.
2. Baca halaman kategori sewa per kawasan untuk dua jenis hunian. Simpan tautan iklan dan ringkasan kartu; jangan mengeksekusi JavaScript sumber. Satu putaran mengambil halaman pertama setiap kawasan sebelum memutar halaman lanjutan. Cursor bergilir mencegah pagination kawasan besar menghabiskan seluruh jatah.
3. Baca detail bergiliran antarkawasan, mengikuti prioritas masjid. URL yang belum pernah dibaca didahulukan agar pengambilan harian terus menemukan pilihan baru. Dalam kelompok tersebut harga kartu yang lebih rendah didahulukan. Harga kartu hanya petunjuk pengurutan; kandidat memerlukan harga dan periode dari detail.
4. Terima hubungan masjid hanya bila koordinat halaman iklan berada dalam radius mentah 1,5 km. Tolak koordinat administratif bawaan. Tanpa koordinat yang terbukti, iklan tetap ditahan. Pin portal tetap titik perkiraan, bukan pintu unit.
5. Tahan status tidak aktif/tersewa, periode tidak dikenal, harga tidak wajar, indikasi penggunaan komersial/harian, titik bersama, dan foto yang dipakai lebih dari satu iklan. Kemiripan foto adalah sinyal pemeriksaan, bukan kepastian duplikasi. Kandidat lain juga masih memerlukan kurasi lokasi, isi iklan, dan ketersediaan.
6. Pertahankan tanggal pembaruan sumber terpisah dari waktu pengambilan. Pembagian harga tahunan dengan 12 hanya pembanding; bukan janji pembayaran bulanan. Nama/kontak pengiklan, alamat unit lengkap, cookies, gambar, deskripsi penuh, dan HTML mentah tidak disimpan oleh worker.

Batas default tiap putaran: 150 halaman pencarian dan 240 halaman detail; maksimal 20 halaman per kawasan yang dikunjungi bertahap. Cache pencarian 24 jam dan detail 72 jam mengurangi pengambilan ulang. Cache kedaluwarsa ditandai dan tidak menjadi kandidat siap diperiksa. Pengambilan dengan batas tersebut adalah sampel, bukan inventaris seluruh unit. Nol kandidat tidak membuktikan tidak ada sewa di sekitar masjid. Laporan menyertakan jumlah detail dibaca, jumlah tautan ditemukan, tanggal pengambilan, dan kegagalan per sumber.

HTTP 401/403/429 atau halaman tantangan menghentikan sumber untuk putaran tersebut tanpa retry. Redirect harus tetap pada domain dan path publik yang diizinkan. Perubahan struktur halaman dicatat sebagai kegagalan parser, bukan dianggap nol listing. Adapter yang tersedia saat ini **Pinhome**; Rumah123/OLX belum menjadi crawler otomatis dalam implementasi ini.

## Jadwal dan pemisahan produksi

Template [service](../deploy/rumah-tinggal-rental-crawl.service.example) menjalankan salinan worker di `/opt/rumah-tinggal/research-worker` sebagai `DynamicUser`, dengan state sendiri di `/var/lib/rumah-tinggal-rental-crawl`. Salin hanya script, konfigurasi, inventori masjid, `research/rentals.json` publik untuk deduplikasi, dan dua dataset transit. Worker tidak membutuhkan `.env`, kredensial, server aplikasi, atau database produksi. `ProtectHome` menutup akses `/root`; konfigurasi dan state aplikasi juga diblokir eksplisit.

Template [timer](../deploy/rumah-tinggal-rental-crawl.timer.example) berjalan pukul **06.20–06.30 WIB setiap hari**, termasuk sesudah reboot bila jadwal terlewat. Worker tidak membuka port dan tidak me-restart `rumah-tinggal.service`.

```sh
systemctl status rumah-tinggal-rental-crawl.timer
systemctl list-timers rumah-tinggal-rental-crawl.timer
systemctl start rumah-tinggal-rental-crawl.service
```

Periksa `latest.json` dan `lastRun.status` untuk membedakan run selesai dengan batas, berhenti karena sumber, dan terinterupsi. Status selesai tidak berarti seluruh detail atau halaman semua kawasan telah habis ditelusuri. Salinan worker perlu disinkronkan ulang setelah script, konfigurasi, inventori masjid, katalog, atau dataset transit berubah; jangan menyinkronkan direktori proyek secara keseluruhan.

Worker menghasilkan **kandidat privat untuk kurasi**, bukan penerbitan otomatis. Setelah peninjauan, perubahan katalog tetap melalui `research/rentals.json`, sidecar `research/rental-locations.json`, builder, validasi, dan proses rilis biasa. Hasil pencarian yang hilang tidak menghapus listing kurasi secara otomatis.

Rujukan sumber: [robots Pinhome](https://www.pinhome.id/robots.txt), [kategori rumah Kranji](https://www.pinhome.id/sewa/rumah/jawa-barat/bekasi/bekasi-barat/kranji), dan [kategori apartemen Cempaka Putih](https://www.pinhome.id/sewa/apartemen/dki-jakarta/jakarta-pusat/cempaka-putih). Pemetaan awal kawasan juga dibantu pemeriksaan satu kali titik masjid pada OpenStreetMap/Nominatim dengan cache dan satu thread, mengikuti [kebijakan Nominatim](https://operations.osmfoundation.org/policies/nominatim/). Worker harian tidak melakukan geocoding ulang.
