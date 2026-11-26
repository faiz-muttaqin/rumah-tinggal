# Rencana riset sewa & banjir Jabodetabek — 26 November 2026

## Checkpoint batch ini

- Basis: snapshot titik OSM dalam `public/data/transit.geojson` dan `public/data/mobility.geojson`. 373 **titik peta**, terdiri atas 80 KRL, 13 MRT, 29 LRT, 251 halte/platform TransJakarta. Halte dua arah bisa menjadi dua titik; status operasional belum diverifikasi ulang.
- BIG: 1.354 poligon desa/kelurahan diperoleh melalui 14 batch poligon dan satu kueri ID. 373 titik memiliki satu poligon yang memuat titiknya dan 642 kode wilayah beririsan dengan lingkaran sejauh maksimal 3 km. Perbatasan BIG: 264 indikatif, 260 hasil kesepakatan, 118 definitif. Ini bukan penetapan batas hukum.
- `koridor-all-3km-2026-11-26.json` menyimpan kode, nama, kecamatan, kota/kabupaten, provinsi, status batas, jarak minimum titik–poligon, dan jumlah katalog berpin pada radius 500 m, 1 km, 1,5 km, 2 km, 3 km. Hitungan **bukan stok pasar**. Tidak ada pengubahan filter bawaan UI.
- Cakupan setelah impor: 744 iklan berpin dengan tarif dasar ekuivalen ≤ Rp5 juta/bulan; 25 titik tidak memiliki satu pun iklan semacam itu pada radius 3 km. Contoh: Bogor, Lenteng Agung, Parungpanjang, Rawa Buntu, Nambo, Tanjung Priok, sejumlah halte Sunter, Pluit dan Koja. Verifikasi status stasiun seperti JIS sebelum memprioritaskan pencarian.
- 117 seed dari pencarian indeks web dan dokumen penelitian sebelumnya; 19 URL duplikat atau tidak didukung adapter. Dua batch empat portal membaca 96 dari 98 detail unik, dua gagal. Hasil: 15 impor `partial` (3 rumah/kontrakan, 3 kos keluarga, 9 apartemen; tiga berasal dari dokumen riset lama); 83 detail tidak diimpor (termasuk dua gagal). Sumber, hash detail, tanggal, nilai harga/periode, status, masalah, dan resolusi tiap calon dicatat di `koridor-pilot-results-2026-11-26.json`. Tidak ada kontak pemilik, konfirmasi langsung kepada pemasang iklan, atau publikasi konten HTML.
- Katalog menjadi 860, di antaranya 847 memiliki titik acuan; 13 masih tidak berpin. Harga dan status portal tidak menjamin ketersediaan. Harga tahunan dibayar sesuai paket; biaya ekstra/penghuni kedua tidak otomatis termasuk plafon.
- Banjir: 12 titik acuan baru dengan peristiwa dari BPBD/BNPB/pemda/operator resmi dan sumber posisi terpisah. 33 laporan lokasi/wilayah tanpa pin baru. Peta menyimpan 2 pin banjir lama (total 14). Bukti baru dan daftar sumber resmi yang gagal/masih harus diakses: `flood-official-evidence-2026-11-26.json`.
- Screening seluruh 860 katalog: 844 dipetakan ke satu poligon BIG, 7 titik hunian dalam 1 km dan 88 dalam 3 km dari suatu acuan banjir resmi baru, 67 berada di kelurahan dengan setidaknya satu laporan resmi berasosiasi via kode BIG. Kelompok dapat tumpang tindih. 66 kartu yang sebelumnya tanpa referensi banjir mendapat konteks historis baru; referensi lama dipertahankan. Seluruh risiko spesifik unit belum diketahui. Jarak terhadap acuan tidak sama dengan jarak terhadap genangan, terlebih jika pin gedung/portal perkiraan.

## Antrean 1.926 tugas unik

`koridor-all-3km-queue-2026-11-26.json` berisi satu tugas per kode BIG × jenis hunian (rumah/kontrakan, kos, apartemen). Semua tugas masih pending untuk **cakupan sistematis**; pilot detail bukan bukti bahwa area sudah habis dicari. Cari wilayah sekali lalu kaitkan ke seluruh stop/line dari inventaris, hindari pengulangan antar koridor.

| Prioritas | Tugas | Kriteria |
|---|---:|---|
| P0 | 555 | Area menyentuh 3 km titik yang belum punya iklan berpin dalam budget |
| P1 | 620 | Ada titik tanpa kategori tersebut dalam 3 km |
| P2 | 633 | Ada titik tanpa kategori tersebut dalam 1 km |
| P3 | 118 | Sisanya, perlu pemutakhiran stok |

### Urutan batch

1. P0: KRL Rangkasbitung (Rawa Buntu hingga Tigaraksa), Bogor/Nambo, Tanjung Priok dan halte TJ utara. Periksa operasi aktual dan nama lokal yang dipakai portal. Dahulukan 500 m–1 km; perluas 1,5/2/3 km jika kurang hasil.
2. P1: semua KRL Cikarang, Bogor, Tangerang, Nambo, Rangkasbitung, Tanjung Priok; MRT; LRT Jabodebek/Jakarta; koridor TJ dalam repo. Bentuk pencarian `jenis + kelurahan + kecamatan + kota/kabupaten` dan alias portal yang **divalidasi**. Jangan membuat slug atau koordinat asumsi.
3. P2/P3: area sisanya dan refresh iklan lama. Kaji kontrakan bulanan dan tahunan, kos (campur/pasutri, biaya 2 penghuni, anak), apartemen (kode unit, harga bayar langsung, IPL, deposit). Dokumen `research/koridor-*.md/.json` dan SCBD merupakan backlog tambahan; deduplikasi dan cek detail lagi.
4. Setiap wilayah/jenis: catat kueri, URL discovery, tanggal, portal, hasil, hambatan robots/403/429 dan alasan penahanan. Gunakan portal publik yang diizinkan, pagination berbatas dan jeda; hentikan provider yang memblokir, jangan bypass. Rumah123 yang diblokir tetap lead, bukan stok terverifikasi.
5. Validasi detail, status, harga/periode, biaya wajib diketahui, lokasi acuan (bukan centroid), jarak Haversine ≤3 km sebelum pembulatan, URL kanonik & identitas properti/tipe kamar. Jika tidak terbukti, jangan menambah pin atau memaksa impor. Katalog harus menyimpan status `partial` bila stok atau rincian belum dikonfirmasi. Regenerasi GeoJSON dengan builder.
6. Banjir: setiap batch tambahkan bukti dari BPBD setempat, InaRISK BNPB, data.go.id, data terbuka pemda, peta riwayat kejadian dan operator transportasi. Pisahkan layer **kejadian historis**, wilayah administratif, bahaya, dan risiko. Pastikan tanggal, posisi, resolusi, jenis bahaya, dan cakupan; cocokkan kode BIG. Sumber resmi tanpa geometri bukan titik tepat. Verifikasi akses jalan, ketinggian lantai, drainase, riwayat lingkungan, dan basement pada survei. Tidak ada data bukan bukti aman.
7. Lanjutkan akses resmi indeks bahaya/risiko Jabodetabekpunjur BNPB; metadata teridentifikasi tetapi kelas per lokasi belum berhasil diambil, layanan risiko mengembalikan 521. Sumber titik DKI dan Kota Tangerang juga tidak tersedia saat pengujian. BIG adalah referensi batas administratif, bukan peta bahaya banjir. Jangan memberi skor aman/merah-hijau dari jarak historis.
8. Checkpoint setiap batch 10–30 wilayah, simpan resolusi per tugas dan perubahan katalog. Ukuran keberhasilan: jumlah tugas dicoba/selesai/tertahan, coverage per jenis/radius, tambahan nonduplikat, usia bukti, dan sumber resmi yang berhasil diverifikasi. Jangan menghapus data lama tanpa bukti.

## Menjalankan ulang

```sh
python3 -I scripts/all_station_catchments.py --run --output research/koridor-all-3km-2026-11-26.json --queue-output research/koridor-all-3km-queue-2026-11-26.json
python3 -I scripts/corridor_detail_pilot.py research/koridor-pilot-seeds-2026-11-26.json --run --max-details 50 --output .runtime/research/pilot-detail/recheck.json
python3 -I scripts/flood_rental_screening.py --run --output research/flood-rental-screening-2026-11-26.json
python3 -I scripts/build-properties.py
python3 -I scripts/test_station_flood_research.py
```

`--run` melakukan request publik; tanpa flag hanya plan lokal. Catchment memakai cache query BIG di `.runtime/research`; `--refresh` memulai pengambilan ulang. Arsip tanggal ini adalah checkpoint; untuk pengambilan lain gunakan nama snapshot tanggal baru dan jangan menimpa status tugas yang sudah dilakukan. Crawler detail tidak mengimpor otomatis. Katalog dikurasi manual dari hasil dan GeoJSON dibuat ulang.
