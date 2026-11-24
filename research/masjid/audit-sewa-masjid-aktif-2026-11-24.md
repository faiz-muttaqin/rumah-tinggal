# Audit sewa sekitar masjid aktif — 24 November 2026

Audit katalog publik GitHub per 23 November 2026, dengan fokus rumah/kontrakan Rp2 juta/bulan atau kurang, kedekatan masjid dan rel, serta target komuter Sudirman sekitar 60 menit. Ini **audit snapshot**, bukan scraping baru atau konfirmasi stok. Tidak ada perubahan jadwal, anggaran crawler reguler, radius, data master, atau artefak aplikasi.

## Snapshot dan metode

- `research/rentals.json`: blob `213e977bb7c675841385ddb6674daebd1904b40d`, 665 penawaran.
- `research/rental-locations.json`: blob `caaf4bd1f4f15cf701275907b4c4c2de6c6f016c`, 665 rekaman.
- `research/masjid/ihrish-mosques.json`: blob `75768be1f64915a2e24718214971be30a57a216f`, 78 pin snapshot 31 Oktober.
- Gabungkan penawaran dengan titik menurut `rentalId`, hitung Haversine (R=6371 km) dari titik penawaran ke tiap masjid dan 122 titik rel operasional dari `public/data/transit.geojson` dan `mobility.geojson` (80 KRL, 13 MRT, 29 LRT). Jangan gunakan centroid kelurahan atau stasiun rencana. Radius masjid <=1,5 km, dan indikator tambahan rel <=1,5 km dari titik penawaran (bukan dari masjid).
- Harga bulanan adalah tarif asli; tahunan dibagi 12 hanya untuk penyaringan. Rumah utuh di sini berarti `kind=Rumah` dan `rentalType=kontrakan/rumah-sewa` menurut katalog, bukan pemeriksaan fisik. Kos dan apartemen tetap terpisah. Hubungan masjid dapat tumpang tindih; jangan menjumlahkan baris sebagai unit unik.
- Jarak adalah garis lurus dari pin publik perkiraan/gedung/kompleks, bukan pintu rumah, rute atau waktu perjalanan. Stok, aturan pasutri/anak, biaya dan waktu komuter belum dikonfirmasi. Jangan memublikasikan titik rumah privat, kontak, atau profil.

## Temuan katalog

| Ukuran | Jumlah |
| --- | ---: |
| Seluruh penawaran | 665 |
| Memiliki acuan titik | 655 |
| Tarif <= Rp2 juta atau setara tahunan | 228 |
| Tarif bulanan asli <= Rp2 juta | 177 |
| Tarif tahunan <= Rp24 juta | 51 |
| Dalam anggaran dan memiliki titik | 222 |
| Dalam anggaran, jenis kontrakan/rumah-sewa | 175 |
| Dalam anggaran, kos/kos keluarga | 41 |
| Dalam anggaran, apartemen | 12 |

Dari 655 acuan, 570 adalah pin perkiraan, 80 titik gedung dan 5 titik kompleks. Pinhome menyumbang 524 dari 665 penawaran (gabungan kapitalisasi nama provider); ini bias sumber, bukan ukuran pasokan pasar. Facebook menyumbang lima penawaran.

## Ketersediaan katalog menurut prioritas masjid

Daftar sembilan target yang cocok dengan ranking aktivitas sebelumnya, plus dua alternatif komuter. Al Haamidiyah Ragunan adalah target ke-10 pada riset aktivitas sebelumnya, tetapi ID/pin belum ada pada inventori 78; tidak diberi angka nol dan tidak ditambah diam-diam. Ranking aktivitas sebelumnya bukan hitungan arsip 30/60 hari lengkap; `eventCount` crawler masih memakai snapshot lama.

| Masjid | Semua pin <=1,5 km | <=2 juta ekuivalen | Bulanan asli <=2 juta | Rumah/kontrakan <=2 juta ekuivalen | Rumah/kontrakan bulanan <=2 juta | <=2 juta dan rel <=1,5 km (semua tipe) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Nurul Iman Blok M | 2 | 0 | 0 | 0 | 0 | 0 |
| Al Ukhuwah | 5 | 1 | 1 | 0 | 0 | 0 |
| As Sunnah VCM | 20 | 2 | 2 | 0 | 0 | 0 |
| Al Ahdhar | 11 | 2 | 1 | 2 | 1 | 0 |
| Raya Rahmatan Lil'alamin | 9 | 2 | 1 | 1 | 0 | 2 |
| Jami Al Jihad | 8 | 5 | 5 | 1 | 1 | 0 |
| Ash Shaff | 34 | 3 | 3 | 1 | 1 | 0 |
| Al Ikhlas Dukuh Bima | 6 | 3 | 1 | 2 | 0 | 2 |
| Al Fattah | 30 | 5 | 4 | 3 | 2 | 5 |
| Al Haamidiyah | — | — | — | — | — | — |
| Nurul I'tishom (alternatif) | 8 | 5 | 4 | 4 | 3 | 3 |
| Al-Ihsan Cipinang (alternatif) | 23 | 13 | 12 | 12 | 11 | 12 |

Angka 0 hanya berarti tidak ada penawaran yang memenuhi kondisi dalam snapshot, bukan tidak ada kontrakan di pasar.

## Shortlist untuk verifikasi ulang

| Penawaran | Tarif asli | Masjid / jarak km | Rel / jarak km | Cek katalog |
| --- | --- | --- | --- | --- |
| [Pisangan Baru, 1 KT](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-jalan-pisangan-baru-timur) | Rp1,4 juta/bulan | Al Fattah 0,906 | KRL Jatinegara 0,317 | 3 Nov |
| [Bidara Cina, 1 KT](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-jl-otista-raya) | Rp1 juta/bulan | Al Fattah 1,276 | KRL Tebet 1,044 | 3 Nov |
| [Cipinang Muara, 1 KT](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-jalan-mulia-jaya-gang-z) | Rp870 ribu/bulan | Al-Ihsan 0,175 | KRL Klender 0,989 | 3 Nov |
| [Kranji, 2 KT](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-jalan-beringin-7-no-106-rt06-04-kranji) | Rp800 ribu/bulan | Nurul I'tishom 1,318 | KRL Kranji 0,602 | 3 Nov |
| [Buaran Indah, 2 KT](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-gang-jambu-kp-buaran-indah-rt-1-rw-5) | Rp17 juta/tahun, min. 12 bulan | Rahmatan Lil'alamin 0,702 | KRL Tanah Tinggi 1,138 | 4 Nov |
| [Jatimulya, 1 KT](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-di-jatimulya-regency-blok-d3-10-a-jl-semeru-2) | Rp7,2 juta/tahun, min. 12 bulan | Al Ikhlas Dukuh Bima 0,202 | LRT Jatimulya 1,469 | 3 Nov |

Empat baris pertama juga ditemukan pada halaman detail pembaca web saat audit 24 November; usia indeks berbeda-beda (hari ini hingga dua bulan lalu). Harga tampilan cocok, tetapi bukan verifikasi stok terkini. Empat baris pertama minimum satu bulan menurut katalog. Dua baris tahunan tidak boleh dianggap bisa dicicil bulanan. Semua titik shortlist adalah pin perkiraan.

## Penemuan tambahan sumber terbuka (belum diterbitkan)

- [Pinhome: Cipinang Muara 3](https://www.pinhome.id/disewa/rumah-sekunder/unit/disewakan-rumah-kontrakan-bangunan-baru-di-jl-cipinang-muara-3): indeks menampilkan Rp1,5 juta/bulan dan 20 m²; URL tidak ditemukan dalam katalog 665. Belum memeriksa pin, stok, izin keluarga, minimum atau duplikat fisik.
- [99.co: Kranji bulanan](https://www.99.co/id/sewa/rumah/area-bekasi/kranji/bulanan) dan [Rumah123: Kranji](https://www.rumah123.com/sewa/bekasi/kranji/rumah/): indeks memunculkan kontrakan sekitar Rp1,5 juta; kemungkinan sindikasi iklan antarportal. Ini halaman kategori, bukan penawaran terverifikasi.
- [Pinhome: Cipinang Rp1–2 juta](https://www.pinhome.id/sewa/rumah/area/cipinang-jakarta-timur/durasi/bulanan/harga/2-juta/properti) dan [Pisangan bulanan](https://www.pinhome.id/sewa/rumah/area/pisangan-jakarta-timur/durasi/bulanan/properti) untuk penemuan ulang; jangan menyamakan area pencarian dengan radius.

## Facebook Marketplace: status dan rencana penelusuran

Browser bersama tidak tersedia pada sesi audit ini; pengguna membuka Facebook tetapi alat sesi tidak memberikan akses tab. **Nol listing Facebook baru diperiksa atau diterbitkan**. Lima listing lama dicatat dalam [penelusuran 10 November](pencarian-facebook-2026-11-10.md) dan [lanjutan](pencarian-facebook-2026-11-10-lanjutan.md). Tiga tarif bulanan dalam batas Rp2 juta (Pisangan Rp1,3 juta, paviliun Pondok Cabe Ilir Rp1,15 juta, kos Gandul Rp1 juta); ketiganya belum memiliki pin. Rumah Legoso Rp54 juta/tahun dan Pinang Kalijati Rp2,5 juta/bulan di atas target. Tidak ada dasar mengklaim lima penawaran masih aktif.

Prioritas penelusuran manual saat browser yang diizinkan tersedia:

| Prioritas | Area/kata kunci yang dicoba | Alasan |
| --- | --- | --- |
| P1 | Cipinang Muara, Mulia Jaya, Klender; kontrakan 1/2 kamar, rumah petak | Katalog murah dan rel dekat Al-Ihsan |
| P1 | Pisangan Baru, Bali Mester, Rawa Bunga, Bidara Cina | Al Fattah, Jatinegara/Tebet |
| P1 | Duta Kranji, Bintara, Kranji, Jakasampurna | Nurul I'tishom, KRL Kranji |
| P2 | Pisangan, Cireundeu, Legoso, Gelagah, Pondok Cabe | As Sunnah VCM; minim rumah murah bertitik |
| P2 | Buaran Indah, Banjar Wijaya, Modernland | Rahmatan Lil'alamin, Tanah Tinggi |
| P2 | Parigi, Emerald Bintaro, Pondok Pucung; Cisauk, Pagedangan | Ash Shaff dan Al Ukhuwah |
| P3 | Jatimelati, Jatimurni; Paninggilan Utara; Lambangsari, Jatimulya; Melawai | Al Ahdhar, Jami Al Jihad, Dukuh Bima, Nurul Iman; kendala rel/anggaran berbeda |

Saat sesi manual tersedia, gunakan kontrol lokasi/radius yang benar-benar terlihat. Catat radius aktual (2 mil sebelumnya sekitar 3,2 km, bukan radius kurasi 1,5 km), tanggal periksa, URL item individual, harga asli/periode/minimum, tipe, kamar, aturan penghuni dan kawasan. Bandingkan URL dan dugaan sindikasi (luas, kamar, harga, foto secara manual); jangan menggabungkan tanpa bukti. Jika titik belum jelas, simpan sebagai petunjuk kawasan tanpa jarak buatan. Tidak ada login otomatis, pengambilan grup privat, pengiriman pesan, penyalinan kontak, cookie, atau pengelakan robots/pembatasan. Facebook tetap jalur manual yang diizinkan, bukan provider otomatis.

## Keputusan yang disarankan (belum diimplementasikan)

1. Pertahankan cakupan produksi 72 target dan jatah dua detail per masjid/provider. Mode audit anggaran Rp2 juta terpisah dari prioritas crawler reguler Rp4/6 juta; jangan mengganti konfigurasi global tanpa keputusan pengguna.
2. Tambahkan mode terfokus opsional untuk daftar prioritas masjid dan anggaran; pertahankan perputaran cursor dan batas rate. Prioritas sebaiknya memisahkan tarif bulanan dari tahunan, mengutamakan rumah utuh, dan memperhatikan jarak hunian ke rel, bukan jarak masjid saja.
3. Perbarui inventori Ihrish secara terpisah dengan ID/pin dan bukti aktivitas; Al Haamidiyah belum masuk crawler. Hindari menganggap hitungan jadwal snapshot sebagai frekuensi per bulan.
4. Uji rute transportasi pintu-ke-pintu ke Dukuh Atas/Sudirman pada jam kerja; tanpa data rute, jangan menyatakan <=60 menit. Survei stok, deposit, listrik, air dan aturan pasangan/anak.

Tidak ada akses ke cache privat `.runtime/research/rental-crawl/`, sehingga run terakhir dan kegagalan per provider tidak bisa diaudit langsung dari sesi ini. Laporan historis [17 November](hasil-scraping-pasutri-2026-11-17.md) mencatat 542 request, 272 upaya detail, 11 penerbitan dari 220 rekaman belum berkatalog; bukan angka run 24 November. Audit ini tidak menjalankan crawler produksi dan tidak mengubah katalog.
