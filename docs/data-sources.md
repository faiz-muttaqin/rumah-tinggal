# Sumber data geografi

`public/data/regions.geojson` adalah turunan geografi administratif untuk 14 kabupaten/kota Jabodetabek. File ini hanya berisi batas wilayah, kode, nama, dan kelompok area. Data upah, biaya hidup, gambar, konfigurasi, serta kode aplikasi Nafkah tidak disalin.

## Provenans yang dipin

- Repositori sumber: [Nafkah oleh Ade Naufal](https://gitlab.com/adenaufal/nafkah).
- Commit sumber: `9f538ffdf791fda4a74b2e677e8d6b913f94a68d`.
- Geometri: [public/data/regions.topojson](https://gitlab.com/adenaufal/nafkah/-/blob/9f538ffdf791fda4a74b2e677e8d6b913f94a68d/public/data/regions.topojson), objek `idn_admin2`.
- Nama dan pemeriksaan centroid: [public/data/v2026.1/regions.json](https://gitlab.com/adenaufal/nafkah/-/blob/9f538ffdf791fda4a74b2e677e8d6b913f94a68d/public/data/v2026.1/regions.json).
- Menurut [LICENSE-DATA.md sumber](https://gitlab.com/adenaufal/nafkah/-/blob/9f538ffdf791fda4a74b2e677e8d6b913f94a68d/LICENSE-DATA.md), geometri berasal dari HDX COD-AB Indonesia adm2 (Humanitarian Data Exchange). Versi/rilis upstream HDX tidak dicantumkan pada berkas yang diperiksa; provenans di sini dipin pada snapshot Nafkah tersebut.
- Lisensi dataset dan turunannya: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Salinan utuh berkas lisensi data sumber ada di [nafkah-data-license.md](../third-party/nafkah-data-license.md).
- Kode sumber Nafkah berlisensi MIT secara terpisah. Konversi di sini menggunakan decoder Python yang ditulis mandiri; tidak ada kode sumber atau decoder Nafkah yang disalin.

## Atribusi yang harus ditampilkan

> Data: Nafkah (nafkah.adenaufal.com), CC-BY-4.0. Geometri: HDX COD-AB Indonesia adm2. Diubah: dipilih 14 wilayah Jabodetabek, dikonversi dari TopoJSON ke GeoJSON, dan nama/kode dinormalisasi.

Tampilkan atribusi tersebut pada informasi sumber peta atau panel sumber data. Atribusi peta dasar dari penyedia tile, bila dipakai, ditambahkan tersendiri.

## Peta dasar dan tautan rute

Peta dasar memakai [OpenFreeMap](https://openfreemap.org/quick_start/), metadata tile `https://tiles.openfreemap.org/planet`, dan skema [OpenMapTiles](https://openmaptiles.org/docs/schema/) dari data OpenStreetMap. Style `src/basemap.ts` ditulis untuk aplikasi: jalan, air, nama tempat, dan bangunan sebagai lapisan terpisah. Tidak menyalin style Positron/Liberty. Glyph Noto Sans disediakan oleh OpenFreeMap. Atribusi OpenFreeMap, © OpenMapTiles, dan © OpenStreetMap contributors ditampilkan pada peta dan dialog sumber.

Bangunan disembunyikan secara default dan baru memiliki lapisan tampilan mulai zoom 12; cakupan bergantung pada pemetaan OSM. Toggle bangunan tidak mengubah jalan. Toggle hunian menyembunyikan marker harga/kartu detail tanpa menghapus daftar atau data; memilih kartu akan mengaktifkannya kembali. Lapisan jalan selalu aktif. Saat penyedia peta dasar tidak tersedia, wilayah, KRL, dan daftar lokal tetap dapat digunakan.

Tautan lokasi/rute mengikuti [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started), tanpa API key. Koordinat hanya diteruskan ketika pengguna membuka tautan. Rute ke hunian tidak menetapkan asal; pengguna memilihnya di Maps. Rute berjalan ke KRL memakai titik hunian sebagai asal dan titik stasiun terdekat sebagai tujuan. Aplikasi tidak menghitung atau menyimpan jarak/waktu rute Google; jarak pada kartu tetap garis lurus. Lokasi contoh tetap ilustratif dan titik stasiun bukan pintu masuk terverifikasi.

## Transformasi dan batas ketelitian

1. Pilih kode `adm2_pcode` yang cocok dengan 14 kode pada tabel di bawah, lalu hilangkan prefiks `ID`.
2. Decode delta pada arc TopoJSON, terapkan `transform.scale` dan `transform.translate`, balik urutan arc untuk indeks negatif, lalu gabungkan arc menjadi ring tertutup. Semua geometri yang dipilih bertipe `Polygon`; ring bagian dalam tetap dipertahankan.
3. Gunakan koordinat GeoJSON `[longitude, latitude]` dalam derajat geografis. Transform sumber sudah menghasilkan longitude/latitude; tidak dilakukan konversi proyeksi tambahan. Koordinat hasil dibulatkan ke enam angka desimal. Winding dinormalisasi mengikuti GeoJSON: ring luar berlawanan arah jarum jam, ring dalam searah jarum jam.
4. Nama dicocokkan dengan metadata wilayah. Wilayah dengan `tier: kabupaten` diberi prefiks `Kabupaten` agar dapat dibedakan dari kota. Kode properti berupa string empat digit tanpa titik; `area` bernilai Jakarta, Bogor, Depok, Tangerang, atau Bekasi.
5. Setiap feature memiliki `id` yang sama dengan `properties.code`. Properties hanya `code`, `name`, dan `area`; tidak memuat centroid maupun indikator sosial/ekonomi.

Batas wilayah sumber telah disederhanakan dan dikuantisasi. Skala kuantisasi sumber sekitar 0,0046013 derajat longitude dan 0,0016915 derajat latitude, sehingga enam angka desimal hasil bukan ukuran ketelitian survei. Gunakan untuk navigasi wilayah umum, bukan batas persil, alamat tepat, atau penilaian properti. Pada snapshot sumber ini, Kepulauan Seribu hanya direpresentasikan satu ring segitiga (empat koordinat termasuk penutup); bentuk tersebut bukan cakupan lengkap seluruh kepulauan. Geometri tidak diperluas atau diperbaiki dengan sumber lain.

## Validasi hasil

- 14 feature, 845 koordinat termasuk titik penutup ring, 15 ring.
- Semua arc tersambung; ring tertutup memiliki sedikitnya tiga titik berbeda.
- Semua kode/nama cocok dengan metadata sumber, tanpa kode ganda; seluruh centroid metadata berada dalam bounding box wilayah masing-masing.
- Bounding box gabungan `[west, south, east, north]`: `[106.339532, -6.788658, 107.296599, -5.795751]`. Kepulauan Seribu termasuk sehingga cakupan meluas ke utara Jakarta.
- Ukuran GeoJSON: 21,417 byte.
- SHA-256 TopoJSON sumber: `eaa9ae45ce8d0a2196e1f8aaa200f89a18709bc4c926ebf571298d72f52fff44`.
- SHA-256 metadata sumber: `883ec1cc05bd1ddb929f5880cebc0123f43a5e2ffaf1b8b03c940cd6cfa129de`.
- SHA-256 GeoJSON hasil: `1c3d1537c71a076c77d521e8f7722d5293e3a8f64995a9d098b9e0f837160956`.

| Kode | Nama                       | Area      |
| ---- | -------------------------- | --------- |
| 3101 | Kabupaten Kepulauan Seribu | Jakarta   |
| 3171 | Kota Jakarta Selatan       | Jakarta   |
| 3172 | Kota Jakarta Timur         | Jakarta   |
| 3173 | Kota Jakarta Pusat         | Jakarta   |
| 3174 | Kota Jakarta Barat         | Jakarta   |
| 3175 | Kota Jakarta Utara         | Jakarta   |
| 3201 | Kabupaten Bogor            | Bogor     |
| 3271 | Kota Bogor                 | Bogor     |
| 3276 | Kota Depok                 | Depok     |
| 3603 | Kabupaten Tangerang        | Tangerang |
| 3671 | Kota Tangerang             | Tangerang |
| 3674 | Kota Tangerang Selatan     | Tangerang |
| 3216 | Kabupaten Bekasi           | Bekasi    |
| 3275 | Kota Bekasi                | Bekasi    |
