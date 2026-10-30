# Ruang riset hunian

Ruang kerja untuk memperkaya katalog properti dan menghubungkan listing dengan konteks wilayah. Bedakan data yang sudah diterbitkan, kandidat yang masih diperiksa, dan gagasan pengembangan.

| Bagian                                              | Isi                                                                                                                           | Status                                                           |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [Kurasi properti](properties.json)                  | Kandidat, harga, sumber, tanggal cek, dan alasan belum masuk peta                                                             | Data riset yang sudah dikurasi                                   |
| [Metode riset](../docs/property-research.md)        | Penemuan, verifikasi, koordinat, dan pembangunan dataset publik                                                               | Alur yang sudah digunakan                                        |
| [Riset hunian Jakarta](jakarta/README.md)           | Perluasan listing, berita, banjir, kriminalitas, Google Maps, populasi, dan arus komuter                                      | Rencana; menunggu pembagian tugas pengguna                       |
| [Template temuan](jakarta/template-temuan.md)       | Format catatan sumber, bukti, hubungan, dan hal yang belum pasti                                                              | Siap dipakai ketika riset berikutnya dimulai                     |
| [Sumber konteks wilayah](jakarta/sumber-konteks.md) | Sumber banjir, penduduk, komuter, dan keramaian yang sudah dicek beserta akses dan lisensinya                                 | Dicek 2026-10-30; penduduk WorldPop sudah tampil                 |
| [Estimasi penduduk](context/population.json)        | Penduduk dalam 500 m dan 1 km dari titik proyek, dari WorldPop 2025 (CC BY 4.0)                                               | Dibangun `scripts/build-population-context.py`                   |
| [Stasiun rencana](planned-stations.json)            | Rencana perluasan LRT dan KRL: status, kutipan, target, sumber bertanggal, dan stasiun bertitik                               | Dicek 2026-10-30, diperiksa ulang pemeriksa terpisah             |
| [Masjid dan pendidikan Islam](context/islamic.json) | Masjid dengan pengajian rutin, pendidikan Islam anak (dengan biaya bila dipublikasikan), dan klaim proyek terverifikasi       | Dicek 2026-10-30; dibangun dari workflow islami                  |
| [Petunjuk belum diverifikasi](leads.json)           | Akun Instagram dan proyek dari daftar pengguna atau hasil pencarian yang belum bisa dibuka otomatis, dengan tautan dan status | Dicek 2026-10-30; tampil berlabel di `/riset#belum-diverifikasi` |
| [Sewa ramah keluarga muslim](rentals.json)          | Kontrakan, rumah sewa, dan apartemen sewa dengan harga sewa dan kutipan lingkungan dari iklan yang dibuka                     | Dicek 2026-10-30; tampil di `/riset#sewa`, tanpa data pemilik    |

Dataset yang dipakai aplikasi dibangun ke [properties.geojson](../public/data/properties.geojson). Menambah catatan di ruang riset tidak otomatis menambah listing atau lapisan pada aplikasi.

Simpan bahan publik yang sudah diringkas dan ditautkan ke sumbernya. Koleksi Listingku, pin pribadi, kredensial, dan data mentah privat tetap di penyimpanan masing-masing, di luar dokumen riset dalam Git.
