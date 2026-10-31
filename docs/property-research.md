# Riset properti dekat KRL, MRT, dan LRT

Halaman `/riset` dan tab **Riset** di peta menampilkan kurasi kandidat proyek hunian di sekitar stasiun KRL, MRT, dan LRT Jabodetabek. Status yang belum pasti diberi label sebagian terverifikasi. Setiap entri memiliki harga dari halaman sumber yang dibuka pada tanggal cek, tautan ke sumber asli, daftar bukti, dan tanggal pengecekan. Jarak ke stasiun dihitung aplikasi, bukan diambil dari klaim pemasaran.

Dokumen ini mencatat cara data ditemukan agar dapat dipakai ulang. Metode di sini **tidak wajib**: cara baru boleh dipakai selama mengikuti batas di bagian [Etika dan batas](#etika-dan-batas), lalu dicatat di katalog metode.

Perluasan berikutnya dicatat di [ruang riset hunian Jakarta](../research/jakarta/README.md): penambahan listing dan pengayaan banjir, kriminalitas, berita, Google Maps, populasi, serta arus komuter. Per 30 Oktober 2026 estimasi penduduk sekitar sudah tampil; sumber banjir, penduduk resmi, dan komuter sudah ditinjau tetapi belum ditampilkan, sedangkan kriminalitas, berita, dan Google Maps masih rencana.

## Cakupan

Filter **Daerah** di bagian atas `/riset` berlaku bersama untuk proyek, sewa, iklan dijual, petunjuk, masjid, dan hubungan properti pada kartu masjid. Pilihan wilayah pada bagian sewa dan masjid tersinkron dengan filter tersebut. **Tipe penawaran** menyediakan semua penawaran, **Kontrakan / rumah sewa**, dan **Properti developer**. Kontrakan / rumah sewa hanya memakai kategori tersebut, tanpa kos keluarga atau apartemen sewa; properti developer memakai katalog proyek baru, tanpa menganggap iklan rumah sekunder atau petunjuk sebagai proyek developer. Saat memilih kontrakan, daftar sewa tampil sebelum direktori masjid. Budget dan pencarian di masing-masing bagian tetap dapat digunakan.

- **Masuk:** proyek baru (rumah tapak atau apartemen/rusunami, termasuk subsidi dan TOD) yang sedang dipasarkan untuk dibeli, dengan titik proyek paling jauh **3 km garis lurus** dari salah satu stasiun dalam dataset aplikasi (80 KRL, 13 MRT, 29 LRT; lihat [data transportasi](transit-data.md)).
- **Belum dicakup oleh riset awal:** sewa, kos, ruko/komersial, kavling, dan iklan resale perorangan. Tautan web atau Instagram dari pemilik/agen tetap bisa disimpan sendiri lewat **Tambah listing**, dengan koordinat yang dipilih di peta. Proyek habis terjual dan proyek tanpa harga tidak masuk kurasi peta.
- Stasiun di luar dataset (misalnya Maja dan Rangkasbitung) belum tercakup.
- **Pengecualian radius untuk proyek islami (sejak 30 Oktober 2026, atas arahan pengguna):** proyek dengan klaim terverifikasi berupa masjid atau musholla di kawasan, kajian rutin, TPQ, rumah tahfidz, atau sekolah Islam di kawasan, atau konsep islami, tetap dicantumkan walau lebih dari 3 km dari stasiun atau titiknya belum terverifikasi. Kartunya menyebut alasan pencantuman dan jarak ke stasiun terdekat; proyek tanpa titik tidak tampil di peta. Klaim dikutip verbatim dari halaman yang dibuka ulang; skema pembayaran syariah dan legalitasnya tidak diverifikasi.
- Harga dalam IDR. Basis harga dicatat apa adanya: "harga mulai", "rentang price list", "harga unit tertentu", "harga subsidi", atau "harga promo". Harga bukan penawaran dan dapat berubah; pengguna diminta mengonfirmasi ke developer.

## Tingkat bukti

| Nilai `verdict` | Arti                                                                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `confirmed`     | Harga ditemukan pada halaman yang dibuka saat cek, status pemasaran terbukti (price list, "dijual/tersedia", promo atau pembaruan portal dalam sekitar 12 bulan), lokasi konsisten. |
| `partial`       | Harga ditemukan saat cek, tetapi status atau lokasi baru sebagian terbukti.                                                                                                         |

Kandidat tanpa harga yang dapat dibaca saat cek tidak dimasukkan. Setiap sumber mencatat `fetched`: `true` berarti isinya dibuka saat cek; `false` berarti tautan hanya ditemukan dari hasil mesin pencari (dipakai untuk Instagram).

## Alur data

1. **Temukan kandidat** per koridor stasiun dengan beberapa cara (katalog di bawah).
2. **Verifikasi**: buka ulang sumber harga, status, dan lokasi, lalu beri `verdict`. Batch sebelumnya memakai pemeriksa terpisah; lanjutan pada 30 Oktober dilakukan proses utama. Ikuti batas delegasi proyek saat menjalankan metode ini.
3. **Gabungkan** hasil ke berkas kurasi: `python3 scripts/merge-research.py HASIL.json ... --checked-at YYYY-MM-DD --labels LABEL.json`. Proyek yang muncul di beberapa koridor digabung; skrip mencetak hal yang perlu dilihat manusia dan tidak mengisi nilai yang hilang.
4. **Koordinat**: pakai titik eksplisit dari halaman sumber (tautan Google Maps dengan koordinat, `locationPin` portal, data proyek Pinhome/cariproperti). Tolak pin yang ternyata dipakai ulang oleh proyek tak terkait atau bertentangan dengan alamat. Untuk sisanya, `python3 scripts/geocode-properties.py [--write]` mencari nama proyek di OpenStreetMap Nominatim satu per satu (jeda 1,1 detik, cache di `.runtime/research/`), hanya menerima kawasan/gedung yang namanya cocok, dan menolak titik desa/kelurahan. Tanpa titik terverifikasi, proyek tercatat di daftar "belum masuk".
5. **Bangun dataset publik**: `python3 scripts/build-properties.py` memvalidasi `research/properties.json` lalu menulis `public/data/properties.geojson`. Skrip menolak URL non-http(s), nomor telepon/WhatsApp/email, sumber media sosial yang ditandai dibuka otomatis, harga tanpa sumber yang dibuka, kutipan lebih dari 150 karakter, dan harga di luar rentang wajar. `excludeReason` dapat mencatat bukti yang membatalkan penerbitan, misalnya sumber harga sudah tidak tersedia. Wilayah dan stasiun terdekat dihitung dari `regions.geojson`, `transit.geojson`, dan `mobility.geojson`. Entri di luar radius atau tanpa koordinat masuk `metadata.excluded` beserta alasannya.
6. **Uji**: `./dev test` menjalankan `scripts/properties.test.ts` (dataset sinkron dengan sumber kurasi, bukti harga, jarak, tanpa kontak pribadi) dan tes skrip; `./dev test:e2e` memakai data fiktif `tests/research-fixture.ts`.

Satu cara menjalankan langkah 1 dan 2 sekaligus adalah [research/property-research.workflow.js](../research/property-research.workflow.js) dengan Workflow Claude Code. Argumennya berisi daftar koridor dan stasiun; keluarannya langsung bisa diproses `merge-research.py`.

Bila penemuan sudah ada tetapi verifikasi terhenti, [research/verify-backlog.workflow.js](../research/verify-backlog.workflow.js) memeriksa ulang kandidat tertunda dari berkas batch (5 sampai 6 kandidat per agen). Agen mencari pin eksplisit secara aktif (Pinhome `__PROJECT_DETAIL__`, `locationPin` rumah123, cariproperti, embed Google Maps developer) karena proyek tanpa titik terverifikasi tidak bisa tampil di peta. Hasilnya dikelompokkan per koridor asal, lalu diproses `merge-research.py`. Kutipan yang ditulis agen sebagai potongan JSON atau rangkuman diganti dengan potongan verbatim yang lebih pendek sebelum diterbitkan.

## Skema `research/properties.json`

Berkas kurasi berisi `checkedAt`, `maxDistanceKm`, `methods`, `coverage`, `gaps`, dan `properties`. Setiap entri `properties`:

| Field                                           | Isi                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                            | `prj-<slug>` unik                                                                                                              |
| `name`, `developer`, `kind`                     | Nama proyek, developer, `Rumah` atau `Apartemen`                                                                               |
| `subsidized`                                    | `true`, `false`, atau `null` bila tidak dinyatakan                                                                             |
| `locationText`                                  | Kelurahan/kecamatan dan kota/kabupaten menurut sumber                                                                          |
| `status`, `statusQuote`, `statusUrl`            | `dipasarkan`, `pre-launch`, `inden`, `siap-huni`, atau `tidak-jelas`, beserta kutipan dan tautannya                            |
| `price`                                         | `min`, `max`, `basis`, `quote` (≤150 karakter), `url`, `pageDate`                                                              |
| `units`                                         | Hingga empat tipe unit dari sumber: label, kamar, luas tanah/bangunan, harga                                                   |
| `transitClaim`                                  | Kutipan klaim akses stasiun dari sumber; tidak dipakai menghitung jarak                                                        |
| `officialUrl`                                   | Halaman resmi developer/proyek bila ada                                                                                        |
| `coordinate`                                    | `lat`, `lng`, `method`, `url`, `precision`, `note`; `null` bila belum terverifikasi                                            |
| `sources`                                       | `url`, `kind` (developer, portal, news, instagram, government, osm, other), `title`, `fetched`, `pageDate`, `supports`, `note` |
| `verdict`, `lastChecked`, `corridor`, `methods` | Tingkat bukti, tanggal cek (WIB), koridor pencarian, metode yang menghasilkan bukti                                            |

Dataset publik menambahkan `region`, `area`, dan `nearest` (hingga empat stasiun dalam radius, dengan moda, nama, jarak km, dan koordinat stasiun).

## Katalog metode

Katalog lengkap beserta hasil penggunaannya tampil di `/riset#metode` dan disimpan di `research/properties.json`. Ringkasan per 30 Oktober 2026:

- **Portal proyek baru (rumah123).** Sitemap area proyek baru dan halaman `/perumahan-baru/properti/...` dapat dibaca dengan permintaan biasa. Data yang andal: rentang harga (termasuk JSON-LD `AggregateOffer`), tipe unit, `updatedAt`, stasiun terdekat dengan menit tempuh menurut portal. Koordinat `district` adalah pusat kecamatan, bukan titik proyek. Halaman POI stasiun kadang menampilkan tantangan Cloudflare; jangan diakali.
- **Portal proyek baru lain.** Pinhome (`__PROJECT_DETAIL__`: harga minimum/maksimum dan koordinat proyek), cariproperti (`__NEXT_DATA__`: harga per tipe), dan halaman proyek baru Brighton. Tanggal pembaruan sering tidak tersedia, sehingga status bisa hanya `partial`.
- **Situs developer.** Paling kuat untuk status dan nama resmi, tetapi banyak developer kecil tidak memajang harga dan mengandalkan portal atau media sosial.
- **Berita 2025 sampai 2026.** Berguna untuk peluncuran, program pemerintah/BUMN, dan tanggal; harga dari berita diberi jenis `news` beserta tanggalnya.
- **Pencarian web.** Kueri per stasiun ("perumahan dekat stasiun X harga", "apartemen dekat stasiun X price list") lebih banyak memberi petunjuk daripada harga; mengecualikan portal resale membantu menemukan portal proyek baru.
- **Instagram.** Lihat bagian berikut.
- **Diblokir saat cek, jangan diakali:** 99.co dan lamudi.co.id (HTTP 403 untuk klien biasa), registri SiKumbang/Tapera (WAF), sebagian halaman POI rumah123.

## Instagram

Pada riset awal, Instagram hanya dicatat sebagai tautan untuk dibuka manual, dengan `fetched: false` dalam katalog publik. Sejak 31 Oktober 2026, atas permintaan pengguna, akuisisi terbatas melalui **Bright Data Scraper API** sudah diuji pada akun organisasi; hasil tersaring tetap kandidat privat dan tidak langsung menjadi bukti harga katalog. [Catatan pilot](instagram-free-pilot.md) mencatat cakupan, hasil, dan batasnya. Tidak ada pengambilan feed akun pribadi atau halaman login.

Tautan yang ditemukan dapat dibuka manual dari bagian **Bukti & sumber**. Pada data awal, tautan Instagram tersedia untuk Metland Cibitung, Samesta Mahata Margonda, dan Samesta Mahata Serpong. Tautan belum membuktikan bahwa akun tersebut dimiliki developer; isi unggahan tidak dipakai sebagai bukti harga yang telah dibuka.

Otomasi opsional disiapkan pada `scripts/instagram-discovery.ts`, menggunakan [Business Discovery resmi Meta](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery). Ini membutuhkan akun profesional sendiri yang terhubung ke Facebook Page, aplikasi Meta, izin yang sesuai, dan token pengguna; belum dihubungkan ke akun atau dijalankan dengan akun nyata. Dokumentasi Meta mengembalikan HTTP 429 pada pengecekan ulang; pembatasan itu tidak diakali. [Panduan koneksi](instagram-research.md) mencatat sumber resmi Meta di Postman, persiapan, dan batas yang belum terverifikasi.

Jalankan jalur Meta lewat lingkungan privat yang memiliki `IG_USER_ID`, `IG_ACCESS_TOKEN`, dan `IG_GRAPH_VERSION` sesuai versi pada dasbor aplikasi. Mode `--focus muslim-family` menerima petunjuk kajian dan pendidikan walau tanpa harga/stasiun; `--watchlist research/instagram-watchlist.json` memakai 9 akun organisasi di Bogor/Depok/Bekasi, dan `--dry-run` memeriksa rencana tanpa jaringan. Hasil kandidat disimpan di `.runtime/instagram/` yang diabaikan Git. Skrip menghapus kontak sebelum ekstraksi, mengirim token lewat header, memantau penggunaan, dan berhenti pada batas laju/token/izin atau kegagalan koneksi. Importer Bright Data/Apify tersedia terpisah. Jalur Meta belum terhubung; jalur penyedia sudah diuji. Belum ada pencarian seluruh Instagram atau pembaruan berkala terjadwal.

## Etika dan batas

- Satu permintaan per host pada satu waktu, User-Agent yang jelas (`rumah-tinggal-research/0.1`), dan hanya halaman yang diperlukan. Nominatim maksimal satu permintaan per detik dengan cache.
- Jangan mengakali 403, 429, captcha, dinding login, atau larangan `robots.txt`: hentikan untuk host tersebut dan catat.
- Jangan menyimpan nama, nomor telepon, WhatsApp, atau email agen/marketing/penjual, dan jangan memasukkan iklan resale perorangan.
- Kutipan maksimal 150 karakter; jangan menyalin deskripsi atau gambar.
- Unduhan diperlakukan sebagai data tidak tepercaya: simpan di direktori kosong tersendiri dan jangan dieksekusi.

## Memperbarui data

Jalankan ulang langkah 1 sampai 6 secara berkala atau untuk koridor tertentu. Entri lama dengan `id` sama diganti hasil cek terbaru; entri yang tidak dicek ulang tetap memakai `lastChecked` lamanya, sehingga pengguna dapat melihat umur buktinya. Hapus entri yang sudah habis terjual atau tidak lagi memiliki harga yang dapat dibuka.

## Integrasi koleksi dan pin

- **Lihat di peta** membuka titik beserta sumber harga dan stasiun terdekat.
- **Simpan ke Listingku** menyimpan judul, harga awal, titik, sumber harga, tanggal cek, tautan bukti, serta tautan Instagram bila ada. Sumber utama tetap harga yang dikutip, walaupun proyek mempunyai situs resmi berbeda.
- **Simpan sebagai pin** menyimpan lokasi dalam kategori Lainnya, dengan sumber dan tanggal di catatan. Dari detail peta, nama/kategori/catatan dapat disesuaikan sebelum disimpan.
- Keduanya memerlukan login dan memakai API per UID yang sama dengan koleksi pribadi. Memilih atau menyimpan proyek tidak mempublikasikan koleksi pengguna.
- Verifikasi sumber dan developer bukan verifikasi identitas pemilik, hak atas tanah, atau kepemilikan unit.

## Ekspor Excel

Tombol **Export Excel** pada `/riset` mengunduh workbook `.xlsx` sesuai filter daerah, tipe penawaran, dan filter tambahan tiap daftar. Daftar yang memiliki hasil mendapat sheet sendiri: **Proyek Developer**, **Sewa**, **Iklan Dijual**, **Masjid**, dan **Petunjuk**. Sheet **Catatan** merekam filter, jumlah hasil, tanggal cek dataset, dan batas bukti. Filter proyek berlaku pada proyek; pencarian sewa dan masjid tetap berlaku pada daftar masing-masing.

Ekspor menyertakan harga numerik dalam rupiah, periode sewa, sumber harga, tanggal cek, status verifikasi, dan bukti hubungan fasilitas. Koordinat proyek yang belum terverifikasi tetap kosong. Jarak stasiun beroperasi dipisahkan dari stasiun rencana; jarak selalu garis lurus. Petunjuk mempertahankan label belum diverifikasi.

Tab **Riset** di peta mengekspor proyek yang tampil dalam daftar peta. **Listingku** menyediakan tombol yang sama setelah login, mengikuti filter dan urutan koleksi pribadi. Jika akun berubah atau keluar saat file sedang dibuat, unduhan Listingku dibatalkan. File dibuat di browser tanpa endpoint ekspor atau penyalinan state SQLite; teks catatan disimpan sebagai teks Excel, termasuk bila diawali tanda `=`.

## Konteks penduduk sekitar

Setiap proyek yang terbit menampilkan estimasi penduduk dalam radius 500 m dan 1 km beserta kepadatannya, dari raster [WorldPop Indonesia 2025](https://hub.worldpop.org/geodata/summary?id=73823) (rilis R2025A, CC BY 4.0). Raster tidak disimpan di Git; `python3 scripts/build-population-context.py RASTER.tif --checked-at YYYY-MM-DD` hanya memakai pustaka standar Python, membaca tile di sekitar titik proyek, dan menulis `research/context/population.json` beserta sha256 raster dan titik yang dipakai. `build-properties.py` membuang estimasi bila titik proyek berubah sesudahnya.

Angka ini estimasi model penduduk tempat tinggal: bukan sensus, bukan registrasi Dukcapil, dan bukan keramaian siang hari atau arus komuter. Sumber banjir, penduduk resmi, komuter, dan keramaian yang sudah dicek tetapi belum ditampilkan dicatat di [sumber konteks wilayah](../research/jakarta/sumber-konteks.md).

## Stasiun rencana LRT dan KRL

`research/planned-stations.json` mencatat rencana perluasan per jalur: status (beroperasi, dalam pembangunan, persiapan atau lelang, rencana resmi, usulan atau kajian, tertunda, belum jelas), tanggal bukti terakhir, kutipan verbatim, target yang dikutip beserta siapa dan kapan menyatakannya, serta sumber bertanggal. Status diperiksa ulang oleh pemeriksa terpisah; target operasi bukan kepastian.

Hanya stasiun dengan titik yang dapat ditelusuri yang dipetakan: node OpenStreetMap (stasiun rencana atau stasiun KAI yang sudah ada) atau titik pada dokumen resmi. Stasiun yang hanya bernama, misalnya enam stasiun LRT Jakarta fase 2A, tidak diberi titik tebakan. Proyek boleh terbit karena dekat stasiun rencana bila segmennya dalam pembangunan, persiapan, atau rencana resmi; stasiun rencana selalu ditandai terpisah dari stasiun beroperasi dan tidak dipakai untuk usulan atau kajian.

## Masjid berkajian dan pendidikan Islam anak

Sejak IHRISH-01 (31 Oktober 2026), sesuai arahan pengguna, **adanya kajian cukup untuk pencantuman; tidak harus rutin**. Direktori `/riset#masjid` memakai [ekstrak peta Ihrish](../research/masjid/ihrish.md): 78 lokasi beserta pin, 267 jadwal snapshot, dan agregat tujuh profil terpilih. Hitungan dapat mencakup pembatalan dan bukan frekuensi. Jadwal tunggal tetap masuk; penanda rutin hanya informasi tambahan. Seluruh lokasi dipertahankan di direktori, sedangkan fasilitas sekitar proyek hanya ditautkan dalam cakupan Jabodetabek dan radius 1,5 km.

`scripts/build-properties.py` membaca `research/masjid/ihrish-mosques.json` dan menghitung hubungan ke proyek berkoordinat, lalu menambahkannya ke `metadata.mosques` dan bukti kajian sekitar proyek. Hubungan iklan tanpa koordinat dari `ihrish-property-links.json` diberi label satu kawasan atau klaim sumber. Builder menolak hubungan ke iklan yang hilang. Lima iklan baru berasal dari halaman Pinhome/Brighton yang terbuka; iklan tidak tersedia ditolak, dan sumber HTTP403 tetap petunjuk. Tidak menambahkan titik rumah perorangan, tidak memecah proyek lama, dan tidak mengubah harga proyek yang tidak dicek ulang.

Pencarian teks di `/riset` juga mencakup nama masjid/sekolah di fasilitas sekitar serta kutipan klaim proyek. Misalnya `Az-Zumar` menampilkan proyek yang terhubung dengan bukti masjid itu. Hasil mengikuti radius/klaim yang tercatat, bukan pencarian semua lokasi atau pengukuran rute. Catatan [riset dari masjid](../research/masjid/README.md) memisahkan jadwal rutin, acara sekali jalan, dan titik yang belum terbukti.

Poin plus tiap proyek berasal dari `research/context/islamic.json`. Inventaris awal diambil dari OpenStreetMap (Overpass, dengan jeda dan backoff): masjid bernama dan sekolah yang namanya atau tag-nya menunjukkan pendidikan Islam, dalam 1,5 km dari titik proyek. Peneliti lalu mencari bukti di halaman yang dibuka langsung:

- Kajian: bukti kegiatan di situs masjid, profil SIMAS Kemenag, direktori kajian, situs yayasan, atau berita. Riset awal mensyaratkan kegiatan berulang; sejak IHRISH-01 kegiatan sekali jalan juga cukup, dengan tanggal dan batas bukti dijelaskan.
- Pendidikan anak: TPQ/TPA, RA/TK Islam, MI/SD Islam, madrasah diniyah, rumah tahfidz, pesantren anak, dan MTs/SMP Islam; biaya hanya bila dipublikasikan resmi, dikutip apa adanya beserta tahun ajarannya.
- Klaim proyek: fasilitas atau konsep islami yang disebut halaman proyek, ditandai sebagai klaim pemasaran. Skema pembayaran syariah dan legalitasnya tidak diverifikasi.

Batch awal menggunakan pemeriksa terpisah; IHRISH-01 diperiksa proses utama dari atribut peta dan profil terpilih. Bukti salah lembaga atau memuat data pribadi ditolak; kegiatan lampau dan pembatalan tidak disebut jadwal aktif. Nama penceramah, imam, pengurus, guru, nomor telepon, WhatsApp, dan rekening donasi tidak disimpan. Jarak adalah garis lurus.

## Media sosial resmi

Tautan Instagram, Facebook, TikTok, YouTube, X, atau Threads milik proyek, developer, masjid, atau sekolah dicatat dari tautan di situs resmi atau dari hasil mesin pencari, lalu diperiksa ulang tanpa membuka halaman media sosial. Akun pribadi agen, marketing, atau perantara tidak dicatat. `build-properties.py` menolak tautan yang host-nya tidak sesuai platform. Halaman menampilkan tautan dengan keterangan bahwa isinya belum dibuka otomatis.

## Petunjuk belum diverifikasi

`research/leads.json` menampung petunjuk yang belum bisa dibuktikan dari halaman yang dibuka otomatis, misalnya akun Instagram dari daftar Meta AI yang ditempel pengguna atau akun sewa yang hanya muncul di hasil pencarian. Setiap petunjuk wajib punya tautan dan status `unverified` (ada sumber tetapi belum cukup) atau `unreached` (hanya bisa dicek lewat media sosial). Halaman `/riset#belum-diverifikasi` menampilkannya terpisah dari katalog dengan label status, sehingga pengguna yang masuk ke Instagram bisa memeriksa sendiri. Petunjuk tidak pernah dihitung sebagai listing, harga, atau poin plus. Akun penasihat atau marketing perorangan tidak dicatat.

## Kontak dan tautan bio

Nomor telepon dan WhatsApp tidak disimpan. Bila halaman resmi, halaman pemasaran, atau tautan bio memuat kontak, kartu menampilkan tombol "☎ Kontak (belum diverifikasi)" yang membuka halaman tersebut (`contactUrl`). `build-properties.py` menolak tautan wa.me, WhatsApp, wa.link, dan URL yang berisi nomor. Tautan bio (Linktree, lynk.id, ini.bio, berbagi.link, DAV DIGI, dan sejenisnya) dicatat sebagai platform `linkbio` dengan daftar host tetap.

## Sewa ramah keluarga muslim

`research/rentals.json` berisi iklan kontrakan, rumah sewa, apartemen sewa, dan kos keluarga di Jabodetabek yang halaman iklannya dibuka langsung. Setiap iklan wajib punya harga sewa dari halaman itu (bulanan atau tahunan), maksimal tiga kutipan verbatim tentang lingkungan ramah keluarga muslim (misalnya dekat masjid, TPQ, atau sekolah Islam), portal, dan tanggal cek. Pemeriksa terpisah membuka ulang iklan dan menolak yang kedaluwarsa, kutipannya tidak ada, atau memuat data pribadi.

Iklan dicantumkan hanya bila kutipannya menyebut lingkungan muslim (masjid, musholla, syariah, muslim, TPQ, atau sejenisnya). Iklan yang hanya ramah keluarga atau sudah tersewa tidak dicantumkan. Kutipan yang berasal dari data JSON halaman dipangkas menjadi substring verbatim yang terbaca, lalu semua kutipan harga dan bukti dibuka ulang dan dicocokkan. Kartu diurutkan menurut setara sewa bulanan.

Privasi: nama dan kontak pemilik, agen, atau pengelola tidak disimpan. Iklan pemilik perorangan hanya dicatat sampai tingkat kelurahan atau kecamatan, dan `build-properties.py` menolak koordinat untuk iklan perorangan. Sewa tidak ditampilkan di peta. Akun Instagram sewa yang hanya ditemukan lewat mesin pencari masuk ke petunjuk belum diverifikasi dengan jenis `rental`.

## Iklan dijual dekat masjid kajian

`research/sale-ads.json` menampung iklan rumah dan kavling (bukan proyek developer) di sekitar masjid berkajian, saat ini Masjid Jami' Al-Barkah Cileungsi. Syaratnya sama dengan sewa: halaman iklan dibuka langsung, harga dari halaman itu, kutipan verbatim yang menyebut masjid atau lingkungan islami, status masih ditawarkan, dan pemeriksa terpisah. Nama dan kontak penjual tidak disimpan, lokasi hanya sampai kawasan, dan builder menolak koordinat. Jarak ke masjid ditampilkan sebagai klaim iklan; perkiraan jarak tanpa titik diberi label asumsi.

Pinhome memberi banyak proyek di Cileungsi titik bawaan yang sama (-6.3993925, 106.9624239). Titik itu tidak dipakai sebagai titik proyek; proyek tanpa titik lain tetap tercantum lewat basis islami tanpa jarak.

## TAAT (agensi properti syariah)

taat.co.id tidak memiliki robots.txt yang membatasi dan menyediakan sitemap per kategori (perumahan syariah, rumah baru, rumah bekas, kavling). Halaman dirender di peramban; data lengkap ada di JSON halaman (`__NEXT_DATA__`): status, rentang harga, tipe dengan stok, fasilitas, FAQ, developer, dan tanggal pembaruan. Kutipan harga diambil dari teks yang terlihat setelah halaman dirender peramban lokal, sedangkan klaim fasilitas dan FAQ dari data halaman. TAAT menyamarkan nama proyek, jadi proyek dicocokkan lewat developer, kelurahan, dan nama tipe. Koordinat yang dicantumkan TAAT adalah titik tengah kelurahan, bukan titik proyek, sehingga tidak dipakai. Nomor WhatsApp pada halaman tidak disimpan; tombol kontak menaut ke halaman TAAT.

## Hasil kurasi 30 Oktober 2026

171 kandidat ditemukan pada 13 koridor pencarian (termasuk duplikat lintas koridor; 152 nama unik). Batch awal mencatat 64 proyek kurasi dan menerbitkan 28.

Tahap verifikasi workflow awal terhenti pada 7 koridor. Lanjutan 30 Oktober memeriksa ulang 48 kandidat Jakarta yang tertunda: 47 lolos dengan harga dari halaman yang dibuka hari itu (23 confirmed, 24 partial) dan 1 ditolak karena pemasaran terkini tidak terbukti (proyek 10 unit yang selesai Desember 2021). Empat lagi dicatat tetapi tidak diterbitkan karena belum tahap penjualan atau hanya bersumber dari halaman Referensi Proyek untuk gedung yang sudah lama selesai.

Pembaruan akhir 30 Oktober: 176 entri kurasi; 98 terbit (Jakarta 48, Bogor 14, Bekasi 14, Tangerang 13, Depok 9; 37 confirmed). Dari jumlah itu 14 dicantumkan karena fasilitas atau konsep islami walau jauh dari stasiun, 6 di antaranya tanpa titik. 78 belum masuk; 64 di antaranya tetap menampilkan harga bersumber. Lokasi 18 proyek ditemukan lewat pencari titik dan pemeriksa terpisah; 11 usulan titik ditolak. Stasiun KRL/MRT/LRT di wilayah Jakarta tanpa proyek terbit dalam 3 km kini 9 dari 81 (Angke, Buaran, Duri, Grogol, Pesing, Pondok Jati, Tanjung Priok, Halim, Pramuka). Daftar perumahan islami dari pengguna (hasil Meta AI) diperlakukan sebagai petunjuk: sebagian benar, sebagian keliru (platform yang menyamarkan nama proyek, agen, proyek resale, proyek tidak ditemukan), dan hanya yang terverifikasi yang dicatat.

Sewa dan petunjuk (30 Oktober malam): 26 iklan sewa ramah keluarga muslim tercatat (Jakarta 11, Depok 5, Bekasi 4, Tangerang 4, Bogor 2; 6 confirmed, 20 partial; kos keluarga 7, rumah sewa 7, kontrakan 6, apartemen 6). Pemeriksa menolak 13 (kebanyakan sudah tersewa atau tanpa bukti), dan 3 lagi tidak dicantumkan karena hanya ramah keluarga. Semua 76 kutipan harga dan bukti cocok saat dibuka ulang. Pencarian tidak menemukan akun Instagram sewa yang layak dicatat. Petunjuk belum diverifikasi: 21. Empat daftar Meta AI dari pengguna menambah Bumi Sakinah Cileungsi ke katalog (99 terbit), fasilitas Masjid Jami' Al-Barkah Cileungsi, dan tombol kontak untuk 6 proyek; beberapa situs yang disebut daftar tersebut tidak terdaftar di DNS.

Pemeriksaan kajian lanjutan (S14) untuk Bekasi dan proyek basis islami menambah 35 fasilitas (total 303) dan 25 klaim proyek (total 125); proyek Bekasi dengan masjid berkajian atau klaim kajian naik dari 1 menjadi 5. Filter harga di `/riset` kini berupa rentang budget (dari dan sampai): proyek tampil bila rentang harganya beririsan dengan budget, bukan hanya harga mulai. Sewa memakai rentang budget per bulan (sewa tahunan dibagi 12).

Sekitar Masjid Al-Barkah Cileungsi (BARKAH-01): pencarian proyek baru, iklan rumah/kavling, dan sewa yang masih buka. Ditambahkan Cotton Premiere Syariah (Cileungsi Hijau, 1,27 km dari masjid lewat pin kawasan) dan Adreena House Cileungsi ke katalog, harga dan lokasi Bumi Sakinah diperbarui, 9 iklan dijual, dan 2 sewa. Titik Teras Madina Cibubur dihapus karena ternyata titik bawaan Pinhome; jarak 0,61 km yang sempat dilaporkan tidak berlaku. Semua kutipan baru cocok saat dibuka ulang (26 iklan, 80 sewa).

TAAT (30 Oktober malam): 8 perumahan syariah aktif di taat.co.id kini semuanya ada di katalog. Tiga baru (Perumahan Islami Mustika Jaya dengan TPQ di dalam perumahan, Kukusan Depok, Exclusive Cluster Pejaten) dan empat diperbarui harganya dengan data bertanggal TAAT (Grand Al Ihsan, Selasar Madina, Teras Madina, Raudhatul Jannah). Grand Al Ihsan kini punya klaim kajian rutin di masjid kawasan. Kartu menampilkan hingga 4 klaim, satu per jenis lebih dulu. 15 rumah baru KPR syariah dari developer umum belum dikurasi.
