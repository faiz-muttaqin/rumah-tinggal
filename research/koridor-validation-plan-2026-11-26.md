# Corridor validation checkpoint — 26 November 2026

Stacked on PR #3 (64f54898dd8674aee307cdf4486c2d78c5f9c5b5). No deployment.

## Integration gate

At inspection main was d46615925160ae22c35ef2a0091c1772e44f8580, three commits ahead of the common ancestor; PR #3 was four ahead. Both changed research/rentals.json, research/rental-locations.json and public/data/properties.geojson. Do not resolve with blanket ours/theirs. Reconcile source records by stable ID and canonical URL, retain main's corrected values and all nonduplicate PR additions, review conflicting IDs/URLs individually, then regenerate properties with the existing builder. Review rental-review.json from main too. Re-run counts, price ceiling, location provenance and application tests. Retarget the stacked PR after parent merge.

## Coverage audit

Recomputed directly from the seed JSON: 28 unique station names and IDs, 28 matching transit targets, 65 unique search paths. These are not polygon-verified. 25 stations have zero existing pinned listings within 500 m. Eleven have zero within 1.5 km: Cikarang, Tambun, Cakung, Sudirman, Haji Nawi, Blok A, Istora, Bendungan Hilir, Setiabudi, Dukuh Atas, Bundaran HI. Counts refer to the seed snapshot, not current main or actual inventory.

## Discovery leads (hold for review)

Public detail pages rechecked on 26 November; not added to master pending deduplication against both branches and location confirmation. No claim of walking distance or current stock.

| Lead | Advertised rent | Building | Evidence/status |
|---|---:|---|---|
| [Margahayu, Bekasi](https://www.rumah123.com/properti/bekasi-margahayu/rumah-kontrak-tahunan-strategis-dekat-rs-primaya-bekasi-timur-hor42585321/) | Rp29m/year | 60 m², 2 bedrooms, 1 bath, 1 floor | Updated 12 Oct; claims Bekasi Timur station nearby, approximate map only |
| [Perum Mangunjaya, Bekasi Timur](https://www.rumah123.com/properti/bekasi-bekasi-timur/rumah-kontrak-tahunan-siap-huni-di-perum-mangunjaya-bekasi-timur-hor42805326/) | Rp25m/year | 60 m², 2 bedrooms, 1 bath, 1 floor | Updated 9 Nov; named locality ambiguous, address not shown; similar specs/text to preceding lead, hold for possible duplication |
| [Bekasi Jaya](https://www.rumah123.com/properti/bekasi-bekasi-timur/sewakan-rumah-luas-siap-huni-lingkungan-asri-dekat-stasiun-bekasi-hor10436160/) | Unknown | — | Detail returned 404; exclude from import |

Discovery sources: [Duren Jaya](https://www.rumah123.com/sewa/bekasi/duren-jaya/rumah/), [Tambun station](https://www.rumah123.com/sewa/bekasi/poi/stasiun-tambun/rumah/), [Cikarang kontrakan](https://www.rumah123.com/sewa/cikarang/rumah/?quickLabel=Kontrakan). Area/POI pages are only discovery, never distance proof. Cipete listing hor42311798 exceeds budget (Rp130m/year), exclude.

## Pemeriksaan integrasi — 26 November 2026 WIB

- PR #4 digabung ke cabang PR #3. Konflik pada `research/rentals.json`, `research/rental-locations.json`, dan GeoJSON diselesaikan dari katalog main terbaru dan bukti iklan yang lolos. ID, URL dan data lokasi 688 entri main diperiksa; GeoJSON dibuat ulang oleh builder.
- BIG merespons 13 stasiun yang dipilih dan 52 kueri bersarang pada 500 m, 1 km, 1,5 km, dan 2 km. Cikarang mencakup 4, 5, 7 dan 13 poligon pada masing-masing radius. Hasil ini membantu memilih kelurahan. Validasi slug portal dilakukan terpisah pada pilot, dan titik unit tetap memerlukan bukti iklan.
- Rencana offline terdiri dari 28 stasiun, dengan 130 halaman Pinhome, 9 titik pencarian Jendela360 dan 28 Mamikos. Pilot satu stasiun Cikarang terisolasi, dengan tiga request pencarian dan dua request detail. Ada 4 detail dalam laporan, termasuk cache. Tiga petunjuk baru memakai tanggal sumber 2025, salah satunya hampir pada titik stasiun. Mereka ditahan untuk cek stok dan letak unit.
- Pilot terpisah pada 10 stasiun dari backlog awal membaca 18 detail (8 Pinhome, 8 Mamikos, 2 Jendela360), dengan 6 kandidat awal. Harga, tanggal iklan, ketentuan pasutri, dan bukti lokasi diperiksa sebelum kurasi. Kos Bintara berlabel apartemen di URL, tetapi laman tidak membuktikan unit mandiri atau izin pasutri.
- Empat iklan lolos kurasi. Rumah Trias Cibitung Rp11 juta/tahun minimum 12 bulan berjarak sekitar 1,17 km dari KRL Cibitung. Rumah Klender Rp1,3 juta/bulan berjarak sekitar 0,40 km; deskripsi menyebut Rp1,4 juta, sehingga angka akhir perlu konfirmasi. Kontrakan Cipinang Muara Rp850 ribu/bulan sekitar 1,22 km dari Klender, di luar filter tabel 1,2 km. Rumah Duren Jaya Rp22 juta/tahun tetap tanpa pin dan klaim akses Bekasi Timur dicantumkan sebagai klaim iklan.
- Di antara 31 calon PR #3, satu URL sudah ada di katalog. Pinhome menandai Perumnas Klender dan rumah dekat Fatmawati nonaktif/tersewa. Pisangan Baru ditahan untuk dugaan iklan ganda karena titiknya sekitar 11 m dari entri main yang serupa. Unit Sentra Timur STRA003 dibaca aktif dengan paket Rp25 juta/tahun, tetapi sekitar 1,76 km dari Cakung. ASPEN ADMA003 dari cache tambahan gagal plafon saat kartu pembayaran penuh menunjukkan Rp66,66 juta/tahun. Dua kandidat Rumah123 dari PR #4 tetap petunjuk karena pembacaan ulang langsung belum berhasil dan titik atau potensi duplikat belum jelas.
- Stasiun di wilayah pusat dan Cakung yang masih minim hasil bisa dicari kembali melalui sumber resmi dan seed terverifikasi. Stok aktual, rute pejalan kaki dan letak unit masih perlu dikonfirmasi. Tabel tetap memakai 1,2 km, sedangkan audit memakai 1,5 km dan menyimpan hasil pembanding hingga 2 km.

Perintah pilot yang dapat diulang adalah `python3 -I scripts/station_kelurahan.py --run --station Cikarang` dan `python3 -I scripts/rental_multi_crawler.py --corridor-only --station Cikarang --providers pinhome --run --max-search 3 --max-detail 5`. Cache pilot terpisah dari pekerjaan terjadwal.
