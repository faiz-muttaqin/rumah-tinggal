# Audit radius stasiun dan workflow kelurahan

Hitungan entri katalog bertitik, bukan unit aktif atau jumlah unik lintas stasiun. Titik dari snapshot OSM aplikasi; radius garis lurus, bukan rute jalan kaki.

| Moda | Stasiun             | ≤500 m | ≤1 km | ≤1,5 km | ≤2 km |
| ---- | ------------------- | -----: | ----: | ------: | ----: |
| KRL  | Cikarang            |      0 |     0 |       0 |     0 |
| KRL  | Metland Telagamurni |      0 |     0 |       1 |     1 |
| KRL  | Cibitung            |      0 |     1 |       1 |     1 |
| KRL  | Tambun              |      0 |     0 |       0 |     0 |
| KRL  | Bekasi Timur        |      0 |     0 |       1 |     5 |
| KRL  | Bekasi              |      0 |     0 |       3 |     7 |
| KRL  | Kranji              |      0 |     4 |       6 |     7 |
| KRL  | Cakung              |      0 |     0 |       0 |     3 |
| KRL  | Klender Baru        |      1 |     1 |       3 |     8 |
| KRL  | Buaran              |      0 |     1 |       2 |     8 |
| KRL  | Klender             |      3 |     9 |      24 |    25 |
| KRL  | Jatinegara          |      2 |     4 |      29 |    38 |
| KRL  | Matraman            |      0 |     5 |       9 |    13 |
| KRL  | Manggarai           |      0 |     0 |       3 |     6 |
| KRL  | Sudirman            |      0 |     0 |       0 |     0 |
| MRT  | Lebak Bulus         |      0 |     1 |       1 |     2 |
| MRT  | Fatmawati           |      0 |     0 |       2 |     4 |
| MRT  | Cipete Raya         |      0 |     1 |       1 |     2 |
| MRT  | Haji Nawi           |      0 |     0 |       0 |     0 |
| MRT  | Blok A              |      0 |     0 |       0 |     2 |
| MRT  | Blok M              |      0 |     1 |       3 |     3 |
| MRT  | ASEAN               |      0 |     1 |       3 |     4 |
| MRT  | Senayan             |      0 |     0 |       1 |     1 |
| MRT  | Istora              |      0 |     0 |       0 |     1 |
| MRT  | Bendungan Hilir     |      0 |     0 |       0 |     0 |
| MRT  | Setiabudi           |      0 |     0 |       0 |     0 |
| MRT  | Dukuh Atas          |      0 |     0 |       0 |     0 |
| MRT  | Bundaran HI         |      0 |     0 |       0 |     1 |

## Batas administrasi dan crawler

[Layer BIG](https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_DESAKEL_AR/MapServer/0) mendukung query dengan jarak serta menyediakan nama, kode dan status batas. [Metadata Satu Data](https://data.go.id/dataset/dataset/batas_desakel_ar1) menjelaskan batas definitif dan indikatif. Endpoint query tidak dapat diakses dari sesi ini; irisan poligon belum dihitung. Seed 28 stasiun mencakup 65 jalur portal unik manual (slug belum seluruhnya diuji). Crawler opt-in memakai radius 1,5 km dan state terpisah; default jadwal tetap. Tidak ada bypass 403.

```sh
python3 -I scripts/station_kelurahan.py
python3 -I scripts/station_kelurahan.py --run --station Cikarang
python3 -I scripts/rental_multi_crawler.py --corridor-only
python3 -I scripts/rental_multi_crawler.py --corridor-only --run --providers pinhome,mamikos,jendela360 --max-search 12 --max-detail 8
```

112 query tersedia pada offline plan; --run eksplisit. Review hasil BIG dan cocokkan slug/ID portal sebelum memperluas crawl; irisan kelurahan bukan lokasi unit. Tidak merge/deploy. Validasi ID stasiun unik, format jalur dan jumlah dilakukan; tes Python/app dan live crawl belum dijalankan.
