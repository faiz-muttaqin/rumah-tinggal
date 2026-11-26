# SCBD 8 km / road 10 km — research batch 1 (2026-11-26)

Independent of PR #3 and #4, based on main. Collection first, no public catalog overwrite or deployment.

## Scope

- Approximate SCBD anchor: -6.2262, 106.8098 ([reference](https://en.wikipedia.org/wiki/Sudirman_Central_Business_District)); replace with actual office entrance before final ranking.
- Keep a listing if confirmed unit coordinates are within 8 km straight line OR a measured road route is within 10 km. Preserve both values and route profile separately; do not imply a road result from geodesic distance.
- Rp5m/month equivalent maximum (annual Rp60m); cash due, minimum term, IPL, utilities, deposit and second-person fees tracked separately; no assumption that annual rent can be paid monthly.
- Houses/kontrakan, apartments and kos pasutri. For boarding, require actual room-level couple policy and total two-person rent; a mixed-gender building alone is insufficient.

## Locality inventory

172 manual, deliberately overinclusive seeds in 29 districts. Not a verified geographic result. Names checked against administrative directories where practical, but not every name/portal slug audited. Edge areas and areas outside DKI may be excluded later. Sources: [DKI directory](https://surveilans-dinkes.jakarta.go.id/sarsbaru/umum_kel.php), [South Jakarta](https://selatan.jakarta.go.id/pemerintahan/kelurahan), [Central Jakarta](https://pusat.jakarta.go.id/daftar-kelurahan), [official polygon layer](https://gis-dpmptsp.jakarta.go.id/arcgis/rest/services/Hosted/Batas_Administrasi_Kelurahan_DKI_Jakarta/FeatureServer/85), [JDIH administrative office points](https://jdih.jakarta.go.id/tarikDataLokasi) (not polygons).

| City / district                    | Search seeds                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Jakarta Selatan / Kebayoran Baru   | Senayan, Selong, Rawa Barat, Petogogan, Pulo, Melawai, Gunung, Kramat Pela, Gandaria Utara, Cipete Utara                              |
| Jakarta Selatan / Setiabudi        | Karet Semanggi, Karet Kuningan, Karet, Setiabudi, Guntur, Menteng Atas, Pasar Manggis, Kuningan Timur                                 |
| Jakarta Selatan / Mampang Prapatan | Kuningan Barat, Mampang Prapatan, Pela Mampang, Tegal Parang, Bangka                                                                  |
| Jakarta Selatan / Tebet            | Menteng Dalam, Tebet Barat, Tebet Timur, Kebon Baru, Bukit Duri, Manggarai, Manggarai Selatan                                         |
| Jakarta Selatan / Pancoran         | Pancoran, Duren Tiga, Kalibata, Rawajati, Pengadegan, Cikoko                                                                          |
| Jakarta Selatan / Kebayoran Lama   | Grogol Utara, Grogol Selatan, Cipulir, Kebayoran Lama Utara, Kebayoran Lama Selatan, Pondok Pinang                                    |
| Jakarta Selatan / Pasar Minggu     | Pejaten Barat, Pejaten Timur, Jati Padang, Pasar Minggu, Cilandak Timur, Ragunan                                                      |
| Jakarta Selatan / Cilandak         | Cipete Selatan, Gandaria Selatan, Cilandak Barat, Lebak Bulus, Pondok Labu                                                            |
| Jakarta Selatan / Pesanggrahan     | Ulujami, Pesanggrahan, Petukangan Utara, Petukangan Selatan, Bintaro                                                                  |
| Jakarta Pusat / Tanah Abang        | Bendungan Hilir, Karet Tengsin, Petamburan, Kebon Melati, Kebon Kacang, Kampung Bali, Gelora                                          |
| Jakarta Pusat / Menteng            | Menteng, Pegangsaan, Cikini, Gondangdia, Kebon Sirih                                                                                  |
| Jakarta Pusat / Gambir             | Gambir, Cideng, Petojo Selatan, Petojo Utara, Kebon Kelapa, Duri Pulo                                                                 |
| Jakarta Pusat / Senen              | Senen, Kenari, Paseban, Kramat, Kwitang, Bungur                                                                                       |
| Jakarta Pusat / Johar Baru         | Johar Baru, Kampung Rawa, Galur, Tanah Tinggi                                                                                         |
| Jakarta Pusat / Cempaka Putih      | Rawasari, Cempaka Putih Barat, Cempaka Putih Timur                                                                                    |
| Jakarta Pusat / Sawah Besar        | Pasar Baru, Karang Anyar, Gunung Sahari Utara, Mangga Dua Selatan, Kartini                                                            |
| Jakarta Pusat / Kemayoran          | Gunung Sahari Selatan, Serdang, Harapan Mulia, Cempaka Baru, Utan Panjang, Kebon Kosong, Kemayoran, Sumur Batu                        |
| Jakarta Barat / Palmerah           | Palmerah, Slipi, Kemanggisan, Jatipulo, Kota Bambu Utara, Kota Bambu Selatan                                                          |
| Jakarta Barat / Kebon Jeruk        | Kebon Jeruk, Kelapa Dua, Sukabumi Utara, Sukabumi Selatan, Kedoya Selatan, Kedoya Utara, Duri Kepa                                    |
| Jakarta Barat / Grogol Petamburan  | Grogol, Tomang, Tanjung Duren Utara, Tanjung Duren Selatan, Jelambar, Jelambar Baru, Wijaya Kusuma                                    |
| Jakarta Barat / Kembangan          | Meruya Utara, Meruya Selatan, Srengseng, Joglo, Kembangan Selatan                                                                     |
| Jakarta Barat / Tambora            | Duri Selatan, Duri Utara, Jembatan Besi, Tanah Sereal, Krendang, Angke, Jembatan Lima, Roa Malaka                                     |
| Jakarta Timur / Matraman           | Kebon Manggis, Pal Meriam, Kayu Manis, Pisangan Baru, Utan Kayu Selatan, Utan Kayu Utara                                              |
| Jakarta Timur / Jatinegara         | Bali Mester, Kampung Melayu, Bidara Cina, Rawa Bunga, Cipinang Cempedak, Cipinang Besar Utara, Cipinang Besar Selatan, Cipinang Muara |
| Jakarta Timur / Kramat Jati        | Cawang, Cililitan, Kramat Jati, Batu Ampar, Balekambang, Kampung Tengah, Dukuh                                                        |
| Jakarta Timur / Pulo Gadung        | Rawamangun, Kayu Putih, Pisangan Timur, Cipinang                                                                                      |
| Tangerang Selatan / Ciputat Timur  | Rempoa, Rengas, Cireundeu, Pisangan                                                                                                   |
| Tangerang Selatan / Pondok Aren    | Pondok Ranji, Pondok Karya, Pondok Betung                                                                                             |
| Tangerang / Larangan               | Larangan Utara, Larangan Selatan, Kreo, Kreo Selatan, Gaga                                                                            |

## Acquisition status

28 distinct listing URLs: 14 houses, 6 apartments, 8 boarding leads. 18 stock-unknown, 6 marked rented, 4 waitlisted. Not 28 active offers or 28 new master records. No pins or route results are fabricated. All held pending review. The boarding leads include unverified room rules; three examples with explicit couple policy are Bunda Mampang, Jati Anom and RJL Comfistay, all waitlisted in the checked room type. RJL has a published two-person base price; the others require surcharge checks.

Discovery pages checked: [Pinhome Pancoran](https://www.pinhome.id/sewa/rumah/dki-jakarta/jakarta-selatan/pancoran/durasi/bulanan/harga/2-juta/properti), [Menteng Dalam](https://www.pinhome.id/sewa/rumah/dki-jakarta/jakarta-selatan/tebet/menteng-dalam/bulanan/properti), [Ulujami](https://www.pinhome.id/sewa/rumah/dki-jakarta/jakarta-selatan/pesanggrahan/ulujami), [Palmerah](https://www.pinhome.id/sewa/rumah/dki-jakarta/jakarta-barat/pal-merah/palmerah), [Kebon Jeruk](https://www.pinhome.id/sewa/rumah/dki-jakarta/jakarta-barat/kebon-jeruk/durasi/bulanan/properti), [Kalibata apartments](https://www.rumah123.com/sewa/jakarta-selatan/kalibata/bulanan/apartemen/), [Cipulir apartments](https://www.rumah123.com/sewa/jakarta-selatan/cipulir/apartemen/), [Rukita South Jakarta couple search](https://www.rukita.co/kost/jakarta-selatan/pasutri), [Rukita West Jakarta couple search](https://www.rukita.co/kost/jakarta-barat/pasutri). Source detail URLs and price/stock notes in the leads JSON.

## Next batches

1. Run `python3 -I scripts/scbd_catchment.py` offline; then explicit `--run` for official DKI polygon intersection. The service metadata was accessible, but query failed in web reader and container DNS. Also query BIG for non-DKI municipalities. The 10km geodesic buffer is only a discovery superset for the road criterion, not a road isochrone.
2. For confirmed unit/entrance coordinates, run a routing engine (e.g. self-hosted OSRM/Valhalla with suitable local road data/profile). Store actual route length, profile, provider, retrieval time, snap offsets and both endpoints. Avoid using car routing as verified motorcycle access. Do not route unknown or approximate area centroids as unit pins.
3. Prioritize Setiabudi, Mampang, Tebet, Pancoran, Palmerah, Kebayoran Lama, Kebon Jeruk and Pesanggrahan; expand to remaining locality seeds. Search each locality for all three types, record portal coverage and negative results, keep unknown terms separate. Use portal-approved public sources with existing crawler rate limits and separate state; don't bypass access restrictions.
4. Recheck detail pages, capture actual rent/payment terms and family policy; compare canonical URL and stable ID against current master plus PR #3. Review similar unit photos/specs manually; never merge based on locality alone.
5. Integrate only nonduplicate, eligible records with provenance into research/rentals.json and rental-locations.json using existing schema, regenerate properties and run application checks. Do not overwrite main/PR #3 datasets. No automated import or crawler scheduling in this PR.

JSON seed and listing consistency checked through GitHub connector; Python execution/live routing not performed in this branch.
