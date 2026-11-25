import type { IncidentKind } from "./incidents.ts";

export const reportScopes = {
  titik: "Titik acuan publik",
  tempat: "Tempat umum",
  ruas: "Bagian jalan",
  jalan: "Jalan",
  lingkungan: "RT/RW atau kompleks",
  kelurahan: "Kelurahan atau desa",
  kecamatan: "Kecamatan",
  kota: "Kota atau kabupaten",
} as const;

export interface LocationReport {
  id: string;
  kind: IncidentKind;
  title: string;
  date: string;
  basis?: "Rilis" | "Rekap" | "Penanganan" | "Pencegahan";
  region: string;
  scope: keyof typeof reportScopes;
  place: string;
  summary: string;
  sources: { label: string; url: string }[];
}

export const areaReports: LocationReport[] = [
  {
    id: "banjir-ciledug-cipulir-2024-11",
    kind: "banjir",
    title: "Genangan di Jalan Ciledug Raya, Cipulir",
    date: "2024-11-22",
    region: "Jakarta Selatan",
    scope: "jalan",
    place: "Jalan Ciledug Raya, Cipulir, Kebayoran Lama, Jakarta Selatan",
    summary:
      "BPBD DKI melaporkan jalan di Cipulir kembali bisa dilalui setelah genangan surut.",
    sources: [
      {
        label: "ANTARA · BPBD DKI",
        url: "https://www.antaranews.com/berita/4486325/bpbd-dki-pastikan-banjir-di-jalan-ciledug-raya-sudah-surut",
      },
    ],
  },
  {
    id: "banjir-itc-cipulir-2025-09",
    kind: "banjir",
    title: "Genangan di depan ITC Cipulir",
    date: "2025-09-16",
    region: "Jakarta Selatan",
    scope: "ruas",
    place:
      "Jalan Ciledug Raya depan ITC Cipulir, Kebayoran Lama, Jakarta Selatan",
    summary:
      "Keterangan BPBD DKI menyebut bagian jalan di depan ITC Cipulir. Genangan di bagian itu tercatat surut dalam pembaruan pukul 16.00 WIB.",
    sources: [
      {
        label: "detikNews · BPBD DKI",
        url: "https://news.detik.com/berita/d-8115104/viral-jalan-ciledug-raya-cipulir-banjir-bpbd-pastikan-sudah-surut/amp",
      },
    ],
  },
  {
    id: "banjir-jalan-suwardi-2026-01",
    kind: "banjir",
    title: "Genangan di Jalan Suwardi, Cipulir",
    date: "2026-01-29",
    region: "Jakarta Selatan",
    scope: "ruas",
    place:
      "Jalan Suwardi RT 08/RW 10, Cipulir, Kebayoran Lama, Jakarta Selatan",
    summary:
      "BPBD Jakarta Selatan mencatat muka air setinggi 45 cm di bagian Jalan Suwardi yang dilaporkan.",
    sources: [
      {
        label: "ANTARA · BPBD Jakarta Selatan",
        url: "https://www.antaranews.com/berita/5383054/ketinggian-banjir-di-cipulir-capai-45-cm",
      },
    ],
  },
  {
    id: "banjir-jalan-suwardi-2026-02",
    kind: "banjir",
    title: "Banjir kembali tercatat di Jalan Suwardi",
    date: "2026-02-20",
    region: "Jakarta Selatan",
    scope: "ruas",
    place:
      "Jalan Suwardi RT 08/RW 10, Cipulir, Kebayoran Lama, Jakarta Selatan",
    summary:
      "BPBD Jakarta Selatan mencatat muka air 140 cm pada pengukuran pukul 06.00 WIB di bagian jalan tersebut.",
    sources: [
      {
        label: "ANTARA · BPBD Jakarta Selatan",
        url: "https://www.antaranews.com/berita/5426302/bpbd-jaksel-catat-ketinggian-banjir-di-cipulir-capai-140-cm?page=1",
      },
    ],
  },
  {
    id: "banjir-gang-koba-2026-02",
    kind: "banjir",
    title: "Banjir di Gang Koba, Cipete Utara",
    date: "2026-02-20",
    region: "Jakarta Selatan",
    scope: "ruas",
    place:
      "Gang Koba RT 02, 03 dan 04/RW 06, Cipete Utara, Kebayoran Baru, Jakarta Selatan",
    summary:
      "BPBD mencatat muka air 110 cm pada pukul 06.00 WIB di lingkungan Gang Koba yang disebutkan.",
    sources: [
      {
        label: "ANTARA · BPBD Jakarta Selatan",
        url: "https://www.antaranews.com/berita/5426302/bpbd-jaksel-catat-ketinggian-banjir-di-cipulir-capai-140-cm?page=1",
      },
    ],
  },
  {
    id: "penanganan-pasar-cipulir-2026-02",
    kind: "banjir",
    title: "Peninjauan penanganan pascabanjir di Pasar Cipulir",
    date: "2026-02-09",
    basis: "Penanganan",
    region: "Jakarta Selatan",
    scope: "tempat",
    place: "Pasar Cipulir, Kebayoran Lama, Jakarta Selatan",
    summary:
      "Pemprov DKI menyebut pasar kerap terdampak, dengan posisi rendah di dekat Kali Pesanggrahan. Siaran pers mendokumentasikan peninjauan dan rencana penanganan saat itu.",
    sources: [
      {
        label: "Siaran pers Pemprov DKI",
        url: "https://m.beritajakarta.id/siaran-pers/provinsi/read/6456-SP-HMS-02-2026",
      },
    ],
  },
  {
    id: "pencegahan-kali-sunter-rw09-2026-10",
    kind: "banjir",
    title: "Pengerukan Kali Sunter untuk antisipasi genangan",
    date: "2026-10-02",
    basis: "Pencegahan",
    region: "Jakarta Timur",
    scope: "lingkungan",
    place:
      "Kali Sunter, RW 09 Radar Utara, Cipinang Melayu, Makasar, Jakarta Timur",
    summary:
      "Pemkot mendokumentasikan pengerukan di aliran Kali Sunter pada bagian yang disebut dalam siaran pers.",
    sources: [
      {
        label: "Siaran pers Pemkot Jakarta Timur",
        url: "https://m.beritajakarta.id/siaran-pers/wilayah/jakarta-timur/read/4633-SP-JAKTIM-10-2026",
      },
    ],
  },
  {
    id: "banjir-jatibening-permai-2024",
    kind: "banjir",
    title: "Genangan di Jatibening Permai dalam catatan BPBD",
    date: "2024",
    basis: "Rekap",
    region: "Kota Bekasi",
    scope: "lingkungan",
    place: "Perumahan Jatibening Permai, Pondok Gede, Kota Bekasi",
    summary:
      "Buku catatan triwulan pertama 2024 mencantumkan lokasi genangan di perumahan ini dengan tinggi sekitar 30–40 cm.",
    sources: [
      {
        label: "BPBD Kota Bekasi · Catatan triwulan I 2024",
        url: "https://bpbd.bekasikota.go.id/file_upload/20240925082252_LOG_BOOK_TRIWULAN_1_TAHUN_2024.pdf",
      },
    ],
  },
  {
    id: "banjir-komplek-jatibening-2-2025-03",
    kind: "banjir",
    title: "Genangan di Kompleks Jatibening 2",
    date: "2025-03-04",
    region: "Kota Bekasi",
    scope: "lingkungan",
    place:
      "Kompleks Jatibening 2 RW 08, Jatibening Baru, Pondok Gede, Kota Bekasi",
    summary:
      "Kecamatan Pondok Gede menyebut RW 08 sebagai salah satu lokasi yang dipantau langsung setelah hujan sejak malam sebelumnya.",
    sources: [
      {
        label: "PPID Kecamatan Pondok Gede",
        url: "https://kec-pondokgede.bekasikota.go.id/User/berita_damkar_detail/hujan-deras-dan-banjir-di-pondokgede-camat-pondokgede-pantau-langsung-kondisi-banjir",
      },
    ],
  },
  {
    id: "banjir-jatibening-permai-2026-03",
    kind: "banjir",
    title: "Banjir di Perumahan Jatibening Permai",
    date: "2026-03-08",
    region: "Kota Bekasi",
    scope: "lingkungan",
    place: "Perumahan Jatibening Permai, Pondok Gede, Kota Bekasi",
    summary:
      "Liputan yang mengutip BPBD menyebut genangan sekitar satu meter di lokasi yang dilaporkan.",
    sources: [
      {
        label: "Radar Bekasi · BPBD Kota Bekasi",
        url: "https://radarbekasi.id/2026/03/09/bpbd-catat-10-titik-banjir-di-kota-bekasi/",
      },
    ],
  },
  {
    id: "banjir-bintara-spbu-2026-03",
    kind: "banjir",
    title: "Genangan di bagian Jalan Raya Bintara",
    date: "2026-03-08",
    region: "Kota Bekasi",
    scope: "ruas",
    place: "Jalan Raya Bintara depan SPBU, Bintara, Bekasi Barat, Kota Bekasi",
    summary:
      "Luapan Kali Cakung sempat membuat ruas di depan SPBU yang disebut dalam liputan tidak bisa dilalui kendaraan.",
    sources: [
      {
        label: "Radar Bekasi · BPBD Kota Bekasi",
        url: "https://radarbekasi.id/2026/03/09/bpbd-catat-10-titik-banjir-di-kota-bekasi/",
      },
    ],
  },
  {
    id: "banjir-dosen-ikip-2026-03",
    kind: "banjir",
    title: "Banjir di Kompleks Dosen IKIP",
    date: "2026-03-08",
    region: "Kota Bekasi",
    scope: "lingkungan",
    place: "Kompleks Dosen IKIP, Jatikramat, Jatiasih, Kota Bekasi",
    summary:
      "BPBD Kota Bekasi dilaporkan mencatat ketinggian hingga sekitar 190 cm di lokasi dalam kompleks.",
    sources: [
      {
        label: "Radar Bekasi · BPBD Kota Bekasi",
        url: "https://radarbekasi.id/2026/03/09/bpbd-catat-10-titik-banjir-di-kota-bekasi/",
      },
    ],
  },
  {
    id: "banjir-duta-kranji-2026-01",
    kind: "banjir",
    title: "Luapan Kali Cakung di sekitar Duta Kranji",
    date: "2026-01-23",
    region: "Kota Bekasi",
    scope: "lingkungan",
    place:
      "Perumahan Duta Kranji, Kranji dan Bintara, Bekasi Barat, Kota Bekasi",
    summary:
      "BPBD menyebut beberapa RW di Duta Kranji terdampak. Wilayah perumahan ini mencakup bagian Kranji dan Bintara.",
    sources: [
      {
        label: "detikNews · BPBD Kota Bekasi",
        url: "https://news.detik.com/berita/d-8320890/banjir-bekasi-imbas-kali-cakung-meluap-warga-kranji-dievakuasi/amp",
      },
    ],
  },
  {
    id: "banjir-pondok-gede-permai-2020",
    kind: "banjir",
    title: "Catatan banjir di Pondok Gede Permai pada 2020",
    date: "2020-01-02",
    region: "Kota Bekasi",
    scope: "lingkungan",
    place: "Perumahan Pondok Gede Permai, Jatiasih, Kota Bekasi",
    summary:
      "Tim lapangan BNPB mencatat air memasuki sebagian perumahan dekat gudang logistik. BNPB membuka pos lapangan untuk penanganan.",
    sources: [
      {
        label: "BNPB · Laporan tim lapangan",
        url: "https://www.bnpb.go.id/berita/bnpb-bentuk-pos-lapangan-di-pos-pengungsian-gudang-logistik-bnpb-kota-bekasi",
      },
    ],
  },
  {
    id: "peninjauan-pondok-gede-permai-2025",
    kind: "banjir",
    title: "Peninjauan banjir di Pondok Gede Permai",
    date: "2025-03-05",
    basis: "Penanganan",
    region: "Kota Bekasi",
    scope: "lingkungan",
    place: "Perumahan Pondok Gede Permai, Jatiasih, Kota Bekasi",
    summary:
      "BNPB mendokumentasikan peninjauan lokasi terdampak di perumahan setelah banjir awal Maret 2025.",
    sources: [
      {
        label: "BNPB · Foto peninjauan",
        url: "https://www.bnpb.go.id/index.php/berita-foto/kepala-bnpb-dampingi-wapres-gibran-tinjau-lokasi-banjir-di-jati-asih",
      },
      {
        label: "BNPB Indonesia · Video YouTube",
        url: "https://www.youtube.com/watch?v=sW9_HxQmllw",
      },
    ],
  },
  {
    id: "rekap-bps-jatiasih-2024",
    kind: "banjir",
    title: "Rekap kelurahan yang mengalami banjir di Jatiasih",
    date: "2024",
    basis: "Rekap",
    region: "Kota Bekasi",
    scope: "kecamatan",
    place: "Kecamatan Jatiasih, Kota Bekasi",
    summary:
      "Tabel 4.3.3 Kota Bekasi Dalam Angka 2025 mencatat satu kelurahan di Jatiasih pada kolom banjir tahun 2024. Ukurannya adalah jumlah kelurahan yang mengalami banjir.",
    sources: [
      {
        label: "BPS Kota Bekasi · Tabel 4.3.3",
        url: "https://dprd.bekasikota.go.id/public/files/uploads/kota-bekasi-dalam-angka-2025.pdf",
      },
    ],
  },
  {
    id: "banjir-cibitung-2025-03",
    kind: "banjir",
    title: "Cibitung tercatat dalam laporan banjir Kabupaten Bekasi",
    date: "2025-03-04",
    region: "Kabupaten Bekasi",
    scope: "kecamatan",
    place: "Kecamatan Cibitung, Kabupaten Bekasi",
    summary:
      "BNPB menyebut Cibitung sebagai salah satu dari enam kecamatan terdampak. Ringkasan BNPB mencatat wilayah sampai kecamatan ini.",
    sources: [
      {
        label: "BNPB · Laporan situasi banjir",
        url: "https://www.bnpb.go.id/berita/banjir-melanda-wilayah-kota-dan-kabupaten-bekasi",
      },
    ],
  },
  {
    id: "banjir-karang-tengah-duren-villa-2025-07",
    kind: "banjir",
    title: "Banjir di Ciledug Indah dan Duren Villa Park",
    date: "2025-07-08",
    region: "Kota Tangerang",
    scope: "lingkungan",
    place: "Ciledug Indah dan Duren Villa Park, Karang Tengah, Kota Tangerang",
    summary:
      "BPBD memprioritaskan penanganan di dua lingkungan ini. Laporan menyebut ketinggian hingga 150 cm di lokasi terparah.",
    sources: [
      {
        label: "BPBD Kota Tangerang",
        url: "https://bpbd.tangerangkota.go.id/berita/petugas-gabungan-pemkot-tangerang-gerak-cepat-atasi-banjir",
      },
    ],
  },
  {
    id: "banjir-batuceper-poris-2026-01",
    kind: "banjir",
    title: "Genangan di beberapa lokasi Batuceper",
    date: "2026-01-23",
    region: "Kota Tangerang",
    scope: "kecamatan",
    place: "Kecamatan Batuceper, Kota Tangerang",
    summary:
      "Diskominfo menyebut Jalan Sempati, Jalan HPK, Taman Poris Gaga, dan area Poris Jaya. Pengamatan gabungan pada 23 Januari mencatat 10–40 cm.",
    sources: [
      {
        label: "Diskominfo Kota Tangerang",
        url: "https://diskominfo.tangerangkota.go.id/berita/diskominfo-kota-tangerang-monitoring-banjir-dan-salurkan-bantuan-di-kecamatan-batuceper",
      },
    ],
  },
  {
    id: "banjir-kreo-selatan-2025-11",
    kind: "banjir",
    title: "Genangan yang dilaporkan di Kreo Selatan",
    date: "2025-11-18",
    region: "Kota Tangerang",
    scope: "kelurahan",
    place: "Kelurahan Kreo Selatan, Larangan, Kota Tangerang",
    summary:
      "BPBD mencantumkan Kreo Selatan di antara sejumlah kelurahan Larangan dengan genangan. Angka 10–30 cm merangkum lokasi yang dipantau di beberapa kecamatan.",
    sources: [
      {
        label: "Pemkot Tangerang · Keterangan BPBD",
        url: "https://www.tangerangkota.go.id/berita/detail/58579/petugas-gabungan-pemkot-tangerang-tangani-pohon-tumbang-dan-genangan-di-sejumlah-wilayah",
      },
    ],
  },
  {
    id: "banjir-nuansa-mekarsari-2026-01",
    kind: "banjir",
    title: "Peninjauan banjir di Nuansa Mekarsari 1",
    date: "2026-01-03",
    basis: "Penanganan",
    region: "Kabupaten Tangerang",
    scope: "lingkungan",
    place:
      "Perumahan Nuansa Mekarsari 1 RW 06, Desa Mekarsari, Rajeg, Kabupaten Tangerang",
    summary:
      "Pemkab meninjau perumahan terdampak. Ketua RW 06 dalam laporan menyebut banjir di wilayahnya terjadi hampir setiap tahun.",
    sources: [
      {
        label: "HaluanNews · Peninjauan Pemkab Tangerang",
        url: "https://haluannews.co.id/bupati-tangerang-tinjau-banjir-di-perumahan-nuansa-mekarsari-rajeg/kabupaten-tangerang/03/16458/",
      },
    ],
  },
  {
    id: "banjir-pondok-kacang-permai-2025-10",
    kind: "banjir",
    title: "Banjir di Perumahan Pondok Kacang Permai",
    date: "2025-10-31",
    region: "Tangerang Selatan",
    scope: "lingkungan",
    place: "Perumahan Pondok Kacang Permai, Pondok Aren, Tangerang Selatan",
    summary:
      "Liputan mengutip BPBD Tangsel terkait kerusakan tanggul di sekitar kawasan dan banjir yang kemudian masuk ke lingkungan perumahan.",
    sources: [
      {
        label: "TangerangNews · BPBD Tangsel",
        url: "https://www.tangerangnews.com/amp/tangsel/read/56025/Tanggul-Jebol-Ratusan-Rumah-di-Pondok-Kacang-Permai-Tangsel-Terendam-Banjir",
      },
    ],
  },
  {
    id: "banjir-pisangan-pondok-hijau-2026-05",
    kind: "banjir",
    title: "Genangan di Perumahan Pondok Hijau, Pisangan",
    date: "2026-05-04",
    region: "Tangerang Selatan",
    scope: "lingkungan",
    place:
      "Perumahan Pondok Hijau RW 09, Pisangan, Ciputat Timur, Tangerang Selatan",
    summary:
      "BPBD mencatat genangan 30–80 cm pada RW 09. Liputan pembaruan mencatat air telah surut.",
    sources: [
      {
        label: "Liputan6 · BPBD Tangsel",
        url: "https://www.liputan6.com/regional/read/6328802/kondisi-terkini-usai-banjir-terjang-16-wilayah-di-tangerang-selatan",
      },
    ],
  },
  {
    id: "banjir-pondok-maharta-2026-05",
    kind: "banjir",
    title: "Banjir di Perumahan Pondok Maharta",
    date: "2026-05-04",
    region: "Tangerang Selatan",
    scope: "lingkungan",
    place:
      "Perumahan Pondok Maharta RW 09 dan 10, Pondok Kacang Timur, Pondok Aren, Tangerang Selatan",
    summary:
      "Pembaruan BPBD mencantumkan ketinggian sekitar 25–50 cm di lingkungan yang dilaporkan.",
    sources: [
      {
        label: "Liputan6 · BPBD Tangsel",
        url: "https://www.liputan6.com/regional/read/6328802/kondisi-terkini-usai-banjir-terjang-16-wilayah-di-tangerang-selatan",
      },
    ],
  },
  {
    id: "banjir-tembok-bolong-rempoa-2026-05",
    kind: "banjir",
    title: "Banjir di Kampung Tembok Bolong, Rempoa",
    date: "2026-05-04",
    region: "Tangerang Selatan",
    scope: "lingkungan",
    place:
      "Kampung Tembok Bolong RT 06/RW 12, Rempoa, Ciputat Timur, Tangerang Selatan",
    summary:
      "Pembaruan BPBD mencantumkan tinggi air sekitar 40–100 cm di kampung tersebut.",
    sources: [
      {
        label: "Liputan6 · BPBD Tangsel",
        url: "https://www.liputan6.com/regional/read/6328802/kondisi-terkini-usai-banjir-terjang-16-wilayah-di-tangerang-selatan",
      },
    ],
  },
  {
    id: "banjir-harjamukti-2025-07",
    kind: "banjir",
    title: "Delapan lokasi banjir yang dilaporkan di Harjamukti",
    date: "2025-07-06",
    region: "Kota Depok",
    scope: "kelurahan",
    place: "Kelurahan Harjamukti, Cimanggis, Kota Depok",
    summary:
      "Damkar Depok menyebut lokasi tersebar, antara lain Jalan Sarinembah RT 05/RW 03, Perumahan Sriwedari RW 12, dan terowongan Tol Jagorawi di Jalan Karnos.",
    sources: [
      {
        label: "Poskota · Damkar Depok",
        url: "https://www.poskota.co.id/2025/07/07/banjir-sempat-rendam-8-titik-di-harjamukti-depok-50-kk-terdampak",
      },
    ],
  },
  {
    id: "banjir-sawangan-asri-2025-03",
    kind: "banjir",
    title: "Banjir di Perumahan Sawangan Asri",
    date: "2025-03-04",
    region: "Kota Depok",
    scope: "lingkungan",
    place: "Perumahan Sawangan Asri, Sawangan Baru, Sawangan, Kota Depok",
    summary:
      "Keterangan Kapolsek Bojongsari menyebut perumahan yang terdampak luapan Kali Pesanggrahan pada pagi hari.",
    sources: [
      {
        label: "iNews Depok · Keterangan Polsek",
        url: "https://depok.inews.id/read/564570/banjir-rendam-sawangan-depok-kapolsek-kompol-fauzan-turun-langsung-evakuasi-warga",
      },
    ],
  },
  {
    id: "banjir-jalan-panggulan-2026-04",
    kind: "banjir",
    title: "Genangan di Jalan Panggulan dekat Kali Banyu Mudal",
    date: "2026-04-19",
    region: "Kota Depok",
    scope: "ruas",
    place:
      "Jalan Panggulan dekat Kali Banyu Mudal RT 01/RW 04, Pengasinan, Sawangan, Kota Depok",
    summary:
      "Polsek Bojongsari menyebut luapan sekitar 5 cm di bagian jalan ini. Liputan juga menyebut lokasi lain di Pengasinan dengan ketinggian berbeda.",
    sources: [
      {
        label: "Poskota · Keterangan Polsek",
        url: "https://www.poskota.co.id/2026/04/20/hujan-deras-picu-banjir-di-pengasinan-sawangan-depok-air-sempat-capai-40-cm",
      },
    ],
  },
  {
    id: "banjir-kampung-balong-2025-01",
    kind: "banjir",
    title: "Banjir di Kampung Balong, Bojonggede",
    date: "2025-01-29",
    region: "Kabupaten Bogor",
    scope: "lingkungan",
    place: "Kampung Balong, Desa Rawapanjang, Bojonggede, Kabupaten Bogor",
    summary:
      "BPBD menyebut permukiman di Kampung Balong terdampak setelah luapan aliran kali. Rincian lokasi ditulis sampai kampung.",
    sources: [
      {
        label: "Radar Bogor · BPBD Kabupaten Bogor",
        url: "https://radarbogor.jawapos.com/kabupaten-bogor/2501290059/puluhan-rumah-warga-bogor-terendam-banjir-akibat-cuaca-ekstrem-bpbd-beberkan-datanya",
      },
    ],
  },
  {
    id: "banjir-kampung-klered-2025-01",
    kind: "banjir",
    title: "Banjir di Kampung Klered, Pabuaran",
    date: "2025-01-29",
    region: "Kabupaten Bogor",
    scope: "lingkungan",
    place: "Kampung Klered, Desa Pabuaran, Bojonggede, Kabupaten Bogor",
    summary:
      "Laporan BPBD merinci Kampung Klered di Desa Pabuaran sebagai salah satu lingkungan terdampak.",
    sources: [
      {
        label: "Radar Bogor · BPBD Kabupaten Bogor",
        url: "https://radarbogor.jawapos.com/kabupaten-bogor/2501290059/puluhan-rumah-warga-bogor-terendam-banjir-akibat-cuaca-ekstrem-bpbd-beberkan-datanya",
      },
    ],
  },
  {
    id: "curanmor-cipulir-masud-2026-08",
    kind: "kriminalitas",
    title: "Laporan curanmor di Jalan K.H. Mas’ud I",
    date: "2026-08-17",
    region: "Jakarta Selatan",
    scope: "jalan",
    place: "Jalan K.H. Mas’ud I, Cipulir, Kebayoran Lama, Jakarta Selatan",
    summary:
      "Kapolsek Kebayoran Lama menyampaikan hasil penyidikan terkait pencurian motor warga di jalan tersebut. Tanggal kejadian disebut dalam keterangan polisi.",
    sources: [
      {
        label: "Okezone · Keterangan Kapolsek",
        url: "https://news.okezone.com/read/2026/09/16/338/3242483/kerap-eksploitasi-rasa-iba-pasutri-ini-diciduk-usai-gasak-motor-di-cipulir",
      },
    ],
  },
  {
    id: "pencurian-cipulir-2026-04",
    kind: "kriminalitas",
    title: "Laporan pencurian ponsel di Cipulir",
    date: "2026-04-13",
    region: "Jakarta Selatan",
    scope: "kelurahan",
    place: "Kelurahan Cipulir, Kebayoran Lama, Jakarta Selatan",
    summary:
      "Liputan mengutip Polsek Kebayoran Lama mengenai satu kasus pencurian ponsel di hunian warga.",
    sources: [
      {
        label: "HaiJakarta · Keterangan Polsek",
        url: "https://haijakarta.id/masuk-rumah-saat-korban-tidur-pencuri-hp-di-cipulir-jaksel-ditangkap-polisi",
      },
    ],
  },
  {
    id: "curas-klender-2023-03",
    kind: "kriminalitas",
    title: "Laporan pencurian dengan kekerasan di Klender",
    date: "2023-03-02",
    region: "Jakarta Timur",
    scope: "kelurahan",
    place: "Kelurahan Klender, Duren Sawit, Jakarta Timur",
    summary:
      "Polres Metro Jakarta Timur menyebut Klender sebagai lokasi kejadian yang dialami seorang nasabah bank.",
    sources: [
      {
        label: "ANTARA · Keterangan Polres",
        url: "https://www.antaranews.com/berita/3455694/polisi-tangkap-pencuri-nasabah-bank-di-duren-sawit",
      },
    ],
  },
  {
    id: "curas-perkantoran-duren-sawit-2023",
    kind: "kriminalitas",
    title: "Rilis kasus pencurian dengan kekerasan di Duren Sawit",
    date: "2023-10-17",
    basis: "Rilis",
    region: "Jakarta Timur",
    scope: "kecamatan",
    place: "Kecamatan Duren Sawit, Jakarta Timur",
    summary:
      "Polisi melaporkan para terduga pelaku diamankan ketika beraksi di kawasan perkantoran di Duren Sawit.",
    sources: [
      {
        label: "Tribratanews Polri",
        url: "https://tribratanews.polri.go.id/article/polrestro-jaksel-bekuk-komplotan-perampok-bersenpi-saat-beraksi-di-jaktim",
      },
    ],
  },
  {
    id: "pencurian-buaran-satu-2025-11",
    kind: "kriminalitas",
    title: "Laporan pencurian kotak amal di Jalan Buaran Satu",
    date: "2025-11-16",
    region: "Jakarta Timur",
    scope: "tempat",
    place:
      "Musala Nurul Bashor, Jalan Buaran Satu, Klender, Duren Sawit, Jakarta Timur",
    summary:
      "Liputan pengungkapan Polsek Duren Sawit menempatkan kejadian di musala yang disebutkan dan mencantumkan tanggal rekaman.",
    sources: [
      {
        label: "Ipol · Konferensi pers Polsek",
        url: "https://ipol.id/2025/11/polsek-duren-sawit-bekuk-pencuri-uang-kotak-amal-rp-8-juta-di-musala-nurul-bashor/3/",
      },
    ],
  },
  {
    id: "pencegahan-tawuran-pondok-bambu-2026-10",
    kind: "kriminalitas",
    title: "Polisi melaporkan pencegahan dugaan tawuran di Pondok Bambu",
    date: "2026-10-11",
    basis: "Pencegahan",
    region: "Jakarta Timur",
    scope: "kelurahan",
    place: "Kelurahan Pondok Bambu, Duren Sawit, Jakarta Timur",
    summary:
      "Brimob dan Polres Jakarta Timur melaporkan intervensi terhadap kelompok yang diduga hendak tawuran di Pondok Bambu.",
    sources: [
      {
        label: "WahanaNews · Keterangan Polda Metro Jaya",
        url: "https://wahananews.co/kriminal/polisi-bergerak-usai-laporan-warga-jam-2-pagi-5-terduga-pelaku-tawuran-diciduk-awBYgvYnRB",
      },
    ],
  },
  {
    id: "kekerasan-jalan-benda-2025-11",
    kind: "kriminalitas",
    title: "Laporan kekerasan di Jalan Benda, Jatiasih",
    date: "2025-11-16",
    region: "Kota Bekasi",
    scope: "jalan",
    place: "Jalan Benda, Jatiasih, Kota Bekasi",
    summary:
      "Polda Metro Jaya menyebut lokasi penyerangan terhadap pengguna jalan saat melintas di Jalan Benda.",
    sources: [
      {
        label: "Tribratanews Polri · Keterangan Polda",
        url: "https://tribratanews.polri.go.id/blog/nasional-3/polri-ungkap-kasus-kekerasan-di-bekasi-5-pelaku-diamankan-95464",
      },
    ],
  },
  {
    id: "pengancaman-kampung-baru-2025-04",
    kind: "kriminalitas",
    title: "Rilis dugaan pengancaman di Kampung Baru, Harjamukti",
    date: "2025-04-21",
    basis: "Rilis",
    region: "Kota Depok",
    scope: "lingkungan",
    place: "Kampung Baru, Harjamukti, Cimanggis, Kota Depok",
    summary:
      "Polres Depok menyampaikan dugaan pengancaman terhadap pekerja saat kegiatan pemagaran di Kampung Baru.",
    sources: [
      {
        label: "Tribratanews Polri · Keterangan Polres",
        url: "https://tribratanews.polri.go.id/article/polres-depok-ungkap-dasar-penangkapan-ts-ketua-ormas-di-harjamukti",
      },
    ],
  },
  {
    id: "curas-cibubur-point-2026-11",
    kind: "kriminalitas",
    title: "Laporan perampasan motor di depan Cibubur Point",
    date: "2026-11-07",
    region: "Kota Depok",
    scope: "ruas",
    place:
      "Jalan Alternatif Cibubur depan Cibubur Point, Harjamukti, Cimanggis, Kota Depok",
    summary:
      "Polisi menyebut kejadian pada bagian Jalan Alternatif Cibubur di depan Cibubur Point. Tanggal kejadian dirinci dalam liputan terpisah.",
    sources: [
      {
        label: "Jabaran · Keterangan lokasi Polsek",
        url: "https://jabaran.id/polsek-cimanggis-ringkus-begal-pakai-pikap-sewaan-di-harjamukti-depok/",
      },
      {
        label: "tvOneNews · Tanggal kejadian",
        url: "https://www.tvonenews.com/amp/berita/478067-komplotan-begal-sadis-dibekuk-polres-metro-depok-todong-mahasiswa-pakai-sajam-saat-istirahat-di-pinggir-jalan?page=1",
      },
    ],
  },
  {
    id: "curas-spbu-bintaro-2025-01",
    kind: "kriminalitas",
    title: "Laporan pencurian dengan kekerasan di SPBU Bintaro",
    date: "2025-01-01",
    region: "Tangerang Selatan",
    scope: "tempat",
    place:
      "SPBU Shell Bintaro, Jalan Moh. Husni Thamrin, Pondok Jaya, Pondok Aren, Tangerang Selatan",
    summary:
      "Polda Metro Jaya menempatkan kejadian di SPBU yang disebut pada laporan Januari 2025.",
    sources: [
      {
        label: "ANTARA · Keterangan Polda",
        url: "https://www.antaranews.com/berita/4560738/polisi-usut-kasus-pencurian-dengan-kekerasan-di-spbu-tangerang-selatan",
      },
    ],
  },
  {
    id: "curanmor-fresh-market-bintaro-2026-10",
    kind: "kriminalitas",
    title: "Pengungkapan kasus curanmor di sekitar Fresh Market Bintaro",
    date: "2026-10-22",
    basis: "Rilis",
    region: "Tangerang Selatan",
    scope: "lingkungan",
    place: "Kawasan Fresh Market Bintaro, Pondok Aren, Tangerang Selatan",
    summary:
      "Keterangan Polsek mengaitkan terduga pelaku dengan sejumlah kejadian di kawasan pasar. Lokasi dicatat sampai kawasan yang disebut.",
    sources: [
      {
        label: "Tangsel Pos · Keterangan Polsek",
        url: "https://tangselpos.id/detail/56284/polisi-ringkus-3-maling-motor-yang-beroperasi-di-minimarket-bintaro",
      },
    ],
  },
  {
    id: "rekap-curanmor-pamulang-2026-11",
    kind: "kriminalitas",
    title: "Dua lokasi di Pamulang dalam rekap pengungkapan curanmor",
    date: "2026-11-20",
    basis: "Rekap",
    region: "Tangerang Selatan",
    scope: "kecamatan",
    place: "Kecamatan Pamulang, Tangerang Selatan",
    summary:
      "Rekap pengungkapan Polres Tangsel periode Oktober–November 2026 mencantumkan dua tempat kejadian di Pamulang dari sebelas yang dilaporkan lintas kecamatan.",
    sources: [
      {
        label: "detikNews · Rekap Polres Tangsel",
        url: "https://news.detik.com/berita/d-8762564/polres-tangsel-ungkap-11-kasus-curanmor-13-orang-dijerat-dan-15-motor-disita/amp",
      },
    ],
  },
  {
    id: "ganjal-atm-ciledug-2026-05",
    kind: "kriminalitas",
    title: "Pengungkapan kasus ganjal ATM di Ciledug",
    date: "2026-05-14",
    basis: "Rilis",
    region: "Kota Tangerang",
    scope: "kecamatan",
    place: "Kecamatan Ciledug, Kota Tangerang",
    summary:
      "Polres Metro Tangerang Kota mencantumkan kasus ganjal ATM di Ciledug dalam rilis pengungkapan perkara bulan Mei.",
    sources: [
      {
        label: "Tribratanews Polri · Rilis Polres",
        url: "https://tribratanews.polri.go.id/article/polisi-ungkap-52-kasus-kejahatan-di-tangerang-dalam-sebulan",
      },
    ],
  },
  {
    id: "curas-karang-tengah-2026-05",
    kind: "kriminalitas",
    title: "Pengungkapan kasus pencurian dengan kekerasan di Karang Tengah",
    date: "2026-05-14",
    basis: "Rilis",
    region: "Kota Tangerang",
    scope: "kecamatan",
    place: "Kecamatan Karang Tengah, Kota Tangerang",
    summary:
      "Polisi mencantumkan perkara di Karang Tengah dalam pengungkapan Mei 2026. Rilis menyebut wilayahnya sampai kecamatan.",
    sources: [
      {
        label: "Tribratanews Polri · Rilis Polres",
        url: "https://tribratanews.polri.go.id/article/polisi-ungkap-52-kasus-kejahatan-di-tangerang-dalam-sebulan",
      },
    ],
  },
  {
    id: "percobaan-curanmor-rawapanjang-2024",
    kind: "kriminalitas",
    title: "Laporan percobaan curanmor di Kampung Kelapa",
    date: "2024-04-15",
    region: "Kabupaten Bogor",
    scope: "lingkungan",
    place: "Kampung Kelapa, Desa Rawapanjang, Bojonggede, Kabupaten Bogor",
    summary:
      "Polsek Bojonggede menyebut percobaan pencurian motor di lingkungan Kampung Kelapa pada malam 14–15 April.",
    sources: [
      {
        label: "detikNews · Keterangan Polsek",
        url: "https://news.detik.com/pemilu/d-7302768/gagal-beraksi-residivis-curanmor-ditangkap-warga-bojonggede-bogor",
      },
    ],
  },
  {
    id: "dugaan-pencurian-bojonggede-2026-11",
    kind: "kriminalitas",
    title: "Dugaan percobaan pencurian di Bojonggede",
    date: "2026-11-17",
    region: "Kabupaten Bogor",
    scope: "kecamatan",
    place: "Kecamatan Bojonggede, Kabupaten Bogor",
    summary:
      "Media melaporkan dugaan percobaan berdasarkan keterangan warga. Kapolsek menyatakan perkara masih dalam penyelidikan saat liputan terbit.",
    sources: [
      {
        label: "Radar Bogor · Konfirmasi Polsek",
        url: "https://radarbogor.jawapos.com/kabupaten-bogor/2611170090/terduga-pelaku-pencurian-kepergok-warga-di-bojonggede-bogor",
      },
    ],
  },
  {
    id: "banjir-kebon-pala-2026-05",
    kind: "banjir",
    title: "Banjir di lingkungan Kebon Pala",
    date: "2026-05-19",
    region: "Jakarta Timur",
    scope: "lingkungan",
    place: "Kebon Pala, Kampung Melayu, Jatinegara, Jakarta Timur",
    summary:
      "Liputan mengutip laporan Ketua RT 13/RW 04 tentang tinggi air sekitar 140 cm pada pagi hari di bagian permukiman yang dilaporkan.",
    sources: [
      {
        label: "detikNews · Keterangan setempat",
        url: "https://news.detik.com/berita/d-8494681/kebon-pala-jaktim-dapat-banjir-kiriman-140-cm-ketua-rt-bilang-masih-aman",
      },
    ],
  },
  {
    id: "rekap-banjir-kota-bekasi-2025-03",
    kind: "banjir",
    title: "Tujuh kecamatan dalam laporan situasi banjir Kota Bekasi",
    date: "2025-03-04",
    basis: "Rekap",
    region: "Kota Bekasi",
    scope: "kota",
    place: "Kota Bekasi, Jawa Barat",
    summary:
      "BNPB merangkum laporan BPBD di Bekasi Timur, Bekasi Utara, Bekasi Selatan, Medan Satria, Jatiasih, Pondok Gede, dan Rawalumbu.",
    sources: [
      {
        label: "BNPB · Laporan situasi banjir",
        url: "https://www.bnpb.go.id/berita/banjir-melanda-wilayah-kota-dan-kabupaten-bekasi",
      },
    ],
  },
];
