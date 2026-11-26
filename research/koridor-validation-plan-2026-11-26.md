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

## Reproducible next runs

- [ ] Offline boundary plan: `python3 -I scripts/station_kelurahan.py --station Cikarang`
- [ ] Explicit live BIG pilot: `python3 -I scripts/station_kelurahan.py --run --station Cikarang`; request via web reader on 26 November was inaccessible; do not mark polygons verified.
- [ ] Offline crawler pilot: `python3 -I scripts/rental_multi_crawler.py --corridor-only --station Cikarang --providers pinhome`
- [ ] Bounded live pilot: append `--run --max-search 3 --max-detail 5`; examine private report before repeating other stations/providers. Default pilot cache is isolated by the station set; custom directories should also be unique.
- [ ] Run `python3 -I scripts/test_rental_multi.py` (includes corridor inventory cases) and `python3 -I scripts/test_rental_crawler.py`.
- [ ] Expand acquisition across the eleven coverage gaps, using kelurahan names and alternate portal slugs; no extrapolation from area centroid to unit.
- [ ] Verify source URL, rent period/minimum payment, family occupancy, coordinates and accuracy, potential cross-source duplication. Retain unpinned leads as partial.
- [ ] Reconcile main/PR #3, run `python3 scripts/build-properties.py --check`, `./dev check`, `./dev test`, `./dev build`, `./dev test:e2e`. No merge or deploy until reviewed.

Runtime tests and live acquisition were not executed in this connector session.
