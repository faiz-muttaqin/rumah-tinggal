# Cakupan Ihrish dan pemeriksaan OLX / Marketplace — 4 November 2026

Target pencarian tetap **78 masjid pada snapshot Ihrish yang sedang digunakan**, bukan seluruh masjid di peta. Pemeriksaan kode membuktikan bahwa ID pada `rental-crawl-sources.json.targets` dan `focusAreas` sama persis dengan `ihrish-mosques.json`. Lapisan masjid/sarana lain pada peta tidak menambah target crawler.

## OLX

[Pusat Bantuan OLX](https://www.olx.co.id/help/pasang-iklan/bagaimana-cara-membeli-di-olx/cara-mencari-produk-jasa-di-olx/pencarian-iklan-berbasis-lokasi) menjelaskan pemilihan lokasi secara manual. [Kategori sewa Kebayoran Baru](https://www.olx.co.id/kebayoran-baru_g5000484/disewakan-rumah-apartemen_c5160/q-sewa-rumah) menampilkan lokasi hingga kecamatan, kolom pencarian area/lokalitas, kata kunci, tipe rumah/apartemen dan harga. Pilihan kelurahan sebagai filter lokasi tersendiri **belum terverifikasi**. Memasukkan kata seperti Melawai pada kata kunci bukan bukti hasil dibatasi kelurahan Melawai.

Halaman kategori tersebut juga memuat hasil dari kawasan lain. Karena itu, label lokasi pencarian tidak dapat menggantikan verifikasi lokasi setiap iklan dalam radius 1,5 km dari masjid Ihrish yang dipilih. Nama kawasan pada iklan tetap petunjuk, bukan pin unit.

Uji server terbaru: robots HTTP200 dan jalur kategori berlokasi dinyatakan boleh oleh aturan robots yang terbaca, tetapi pengambilan kategori tidak selesai dalam timeout 20 detik. Tidak ada retry, HTML mentah, rincian penjual atau kontak yang disimpan. Halaman yang terbaca oleh pembaca web tidak membuktikan worker terjadwal dapat mengambilnya dengan baik. **OLX tetap sumber manual**, tidak menjadi provider otomatis ketujuh.

## Facebook Marketplace

[Halaman sewa Marketplace Jakarta](https://www.facebook.com/marketplace/jakarta/propertyrentals/) tidak membuka kontrol pencarian dalam akses pembaca web yang tersedia; yang dikembalikan berupa halaman login/pembatasan akses. [Pusat Bantuan Meta mengenai lokasi Marketplace](https://www.facebook.com/help/573221356179433) juga tidak berhasil dibaca karena pembatasan pengambilan oleh tool. Hasil tersebut tidak memverifikasi kontrol yang tersedia di akun pengguna.

Filter hingga kelurahan, pilihan radius minimum, dan dukungan titik masjid pada antarmuka akun **belum terverifikasi**. Tidak menyimpulkan bahwa fitur tersebut tidak ada, dan tidak menggunakan artikel pihak ketiga sebagai bukti kontrol yang tersedia saat ini. Tidak login, mengakses profil/penjual, atau menghubungi pihak lain. **Facebook Marketplace tetap sumber manual** dan belum dimasukkan ke worker otomatis.

## Penggunaan dalam lingkup sekarang

Pencarian tambahan tetap mengacu ke salah satu dari 78 masjid Ihrish. Untuk OLX, kecamatan dan kata kunci kelurahan dapat dipakai untuk menemukan petunjuk, lalu lokasi penawaran diperiksa terpisah. Untuk Marketplace, area/radius perlu dibuktikan melalui kontrol yang tersedia sebelum dianggap dapat mendukung pencarian terfokus. Sumber tambahan tidak memperluas daftar masjid atau menerbitkan penawaran otomatis.

Katalog yang telah dirilis tetap **344 penawaran**. [Laporan uji fokus](pencarian-terfokus-sewa-2026-11-04.md) mencatat 78 target, jatah per masjid, dan hasil tes worker enam sumber yang sudah terpasang.
