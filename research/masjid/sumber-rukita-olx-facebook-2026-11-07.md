# Rukita, OLX dan Facebook — pemeriksaan 7 November 2026

Rukita ditambahkan sebagai sumber otomatis ketujuh untuk menemukan kos. OLX dan Facebook Marketplace tetap menjadi jalur kurasi manual karena hasil uji akses di bawah. Target tetap 78 masjid Ihrish yang sudah digunakan, dengan radius detail 1,5 km; penambahan sumber tidak memperluas daftar masjid.

| Sumber                                                                                            | Hasil uji saat ini                                                                                                                  | Penggunaan                                                                                  |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [Rukita](https://www.rukita.co/place/sitemap.xml)                                                 | Robots, sitemap dan halaman detail HTTP200. Pilot 20 detail: 18 terbaca, 8 kandidat dalam radius; dua struktur kartu belum dikenali | Aktif untuk penemuan kandidat, tetap memerlukan kurasi sebelum publikasi                    |
| [OLX](https://www.olx.co.id/kebayoran-baru_g5000484/disewakan-rumah-apartemen_c5160/q-sewa-rumah) | Robots HTTP200 mengizinkan kategori yang diuji, tetapi kategori kembali timeout 20 detik dari server                                | Belum menjadi provider otomatis; tidak memakai proxy untuk melewati pembatasan              |
| [Facebook Marketplace](https://www.facebook.com/marketplace/jakarta/propertyrentals/)             | Robots HTTP200 menolak jalur Marketplace untuk user-agent pengujian. Jalur listing tidak diambil setelah penolakan                  | Belum menjadi provider otomatis; tidak login, mengambil profil, atau mengumpulkan data akun |

## Cara pengambilan Rukita

1. Periksa [robots.txt](https://www.rukita.co/robots.txt). Jalur `/search` dan query filter tertentu dilarang, sehingga tidak digunakan.
2. Baca sitemap `/place/sitemap.xml` untuk menemukan URL publik. Hanya URL Indonesia `/place/...` yang diterima; versi Inggris, apartemen, gambar, akun, query dan host lain ditolak.
3. Cocokkan slug dengan lokalitas fokus setiap masjid sebelum meminta detail. Sitemap nasional bukan izin untuk mengambil seluruh detail kota. Jatah tetap maksimal dua detail per masjid dalam satu putaran.
4. Ambil koordinat dari `LodgingBusiness.geo` hanya bila `LodgingBusiness.url` cocok dengan properti yang sedang dibaca. Koordinat organisasi, pusat wilayah dan viewport peta tidak dipakai.
5. Baca harga dari kartu tipe kamar yang sama: satu judul tipe, status `Tersedia`, label `Harga untuk 1 orang`, dan harga rupiah per bulan. Kartu penuh, harga coret, angka pemasaran global serta harga/periode yang ambigu tidak digunakan untuk memilih tarif.
6. Catat jenis penghuni, aturan properti dan kapasitas tipe secara terpisah. Izin pasutri/anak pada properti tidak menambah kapasitas kamar. Minimum kontrak dan tanggal pembaruan tetap tidak diketahui bila tidak dipublikasikan.
7. Uji radius dengan titik detail. Halaman yang berubah strukturnya atau gagal diperiksa ditahan; tidak ditebak dan tidak menghentikan provider lainnya.

Sumber baru dibatasi satu permintaan sitemap dan 20 permintaan detail per putaran, dengan jeda 2–5 detik dan maksimal dua provider berjalan bersamaan. Jadwal tiga kali sehari tidak berubah. Batas gabungan menjadi 289 pencarian dan 560 detail per putaran; batas tersebut bukan jumlah listing baru atau jaminan seluruh inventaris terbaca.

Delapan kandidat pilot diambil ulang, lalu harga/status tipe kamarnya dicocokkan pada tampilan browser. Delapan kos tersebut masuk sebagai penawaran umum, dengan kapasitas satu atau dua orang sesuai tipe. Mereka tidak dilabeli sebagai bukti izin tinggal dua dewasa dan satu anak. Nama masjid terdekat, harga, tipe dan batas bukti tercantum dalam [hasil sore](hasil-scraping-sore-2026-11-07.md).

Data yang disimpan hanya ringkasan properti, harga/periode, titik, tipe kamar, aturan yang relevan, waktu pemeriksaan dan hash bukti. HTML mentah, alamat lengkap pengiklan, kontak, cookie dan kredensial tidak disimpan. Tidak ada publikasi otomatis dari laporan crawler ke aplikasi.

## Cara memakai OLX dan Facebook sekarang

Untuk OLX, pencarian kawasan dan kata kunci dapat membantu menemukan tautan iklan. Harga/periode serta titik setiap iklan tetap perlu diperiksa tersendiri; nama kawasan tidak membuktikan radius 1,5 km dari masjid. Pengujian server dapat dilakukan lagi bila akses berubah, dengan satu percobaan terbatas dan penghentian pada penolakan akses.

Untuk Facebook, gunakan kurasi manual tautan yang dibagikan pengguna atau akses resmi yang memang diizinkan Meta. [Penjelasan Meta tentang scraping](https://about.fb.com/news/2021/04/how-we-combat-scraping/) menyatakan bahwa pengambilan otomatis tanpa izin bertentangan dengan ketentuan mereka. Tidak ada integrasi Marketplace atau klaim dukungan API listing yang dibuat dalam perubahan ini.

Hasil uji akses satu server bukan bukti bahwa semua pengguna tidak dapat membuka OLX atau Marketplace. Keduanya juga tidak dianggap mempunyai hasil sewa nol hanya karena belum dapat dipantau otomatis.
