# SCBD collection-only handoff — 26 November 2026

This supersedes integration/validation milestones in the earlier SCBD plan for the current agent. User explicitly wants collection only; another agent will handle integration.

- Anchor: Gedung Artha Graha, SCBD Lot 25, Jl. Jend. Sudirman Kav. 52–53, Senayan, Jakarta Selatan. [Official contact](https://arthagraha.net/contact), [building coordinates reference](https://id.near-place.com/building-artha-graha-kawasan-niaga-terpadu-sudirman-scbd-jl-jend-sudirman-kav-52-53-senayan-kebayoran-baru-rt5rw3-senayan). Approximate building point -6.2246, 106.8109; not surveyed entrance.
- Target search area approximately 8 km from this building. Prior 10 km road limit retained as future validation context only. Do not assign 8 km distance to individual listings or assert actual inclusion.
- Collect houses, apartments and kos pasutri within advertised Rp5m/month equivalent; retain source URL, price/payment period, locality, bedrooms, size, availability and occupancy restrictions as found. Keep unknowns explicit and prevent exact URL duplicates.
- Do not integrate mosque/transit data, calculate routes, geocode, deduplicate physical units against main, regenerate public catalog, merge or deploy. All deferred to another agent.

## Batch 3
Seven additional Pinhome detail URLs: two Grogol Selatan, one Utan Kayu Utara, one Utan Kayu Selatan, three Bidara Cina. Rp1.4–2.5m/month, 15–110 m² advertised LB. Stock unknown; some indexed details are cached. Otista pair has similar location and price with conflicting specs; one explicitly employee-only. Keep both as source evidence, not two verified family units. Full URLs and notes in scbd-rental-leads-2026-11-26.json.
Cumulative 51 unique URLs: 22 houses, 16 apartments, 13 boarding; 33 unknown stock, 9 rented, 9 waitlist. All held for later validation. 172 locality seeds, 516 planned search jobs unchanged. No claim of complete coverage.

## Next collection batches
Prioritize underrepresented districts and other portals; capture explicit period and occupancy restrictions. Queue entries are pending until actual per-locality/type coverage is documented. JS-only portals require supported browser access, without circumventing restrictions. No GIS, route or app testing in this phase.

## Hasil integrasi

- Filter tabel **≤ 8 km Artha Graha** menghitung jarak garis lurus dari pin hunian ke titik acuan gedung pada Lot 25. Bisa digabung dengan filter KRL Cikarang–Sudirman via Manggarai dan MRT Lebak Bulus–Bundaran HI. Tabel menyediakan jarak yang dapat diurutkan, tautan rute transit, dan ekspor untuk hasil yang sama. Tautan tabel `/?koleksi=sewa&tampilan=tabel&scbd=8km`; tambahkan `&koridor=cikarang-mrt` untuk irisan.
- Kueri DKI dari titik acuan mengembalikan 157 kelurahan yang beririsan dengan buffer 8 km dan 200 dengan buffer 10 km. Hasil meliputi wilayah DKI saja. Daftar 172 kelurahan dan 516 pekerjaan tetap acuan pencarian. Cakupan tiap portal serta kelurahan bersebelahan dengan DKI di luar kueri ini masih dapat diperiksa saat perluasan. [Layer DKI Jakarta](https://gis-dpmptsp.jakarta.go.id/arcgis/rest/services/Hosted/Batas_Administrasi_Kelurahan_DKI_Jakarta/FeatureServer/85)
- Empat dari 51 URL PR lolos. Rumah Sukabumi Selatan Rp2,6 juta/bulan dan tiga unit Pancoran Riverside dengan paket Rp25,3 juta, Rp36,26 juta dan Rp42,93 juta per tahun. Dua unit Pakubuwono Terrace dari laporan crawler melengkapi katalog. Salah satu menampilkan Rp38,28 juta dibayar 12 bulan, yang lain Rp2,8 juta/bulan dengan minimum 6 bulan. URL, kode unit, tanda ketersediaan pada laman, harga paket yang terlihat dan sumber pin diperiksa. Aturan pengelola untuk tinggal berdua, IPL dan stok aktual tetap perlu konfirmasi.
- Iklan dengan tanda tersewa atau daftar tunggu, titik yang belum terbukti, harga bertentangan, atau izin pasutri yang belum jelas tetap tercatat sebagai petunjuk. URL yang sama dengan katalog tidak dimasukkan ulang. Iklan Otista khusus karyawan diberi catatan sumber dan dikeluarkan dari filter hunian untuk pasutri. Satu URL Karet Tengsin juga beririsan dengan PR #3 dan berstatus tersewa di catatan sumber.
- Sampel Pancoran Riverside berjarak 6,415 km garis lurus dari Artha Graha. Rute mobil FOSSGIS OSRM pada 26 November 2026 menghasilkan 8,682 km dengan snap 1,0 dan 23,9 meter. Nilai sampel tersimpan bersama tiga unit pada gedung yang sama dan digunakan sebagai konteks survei. [Profil rute FOSSGIS](https://routing.openstreetmap.de/about.html)
