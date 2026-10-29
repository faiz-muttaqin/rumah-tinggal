# Login Google dan akses pribadi

Frontend memakai Firebase Authentication dengan popup Google. Konfigurasi web dibaca backend dari `.env` lokal, kemudian diberikan ke browser melalui `GET /api/config`. Konfigurasi web dari project referensi telah disiapkan secara lokal; `.env`, token API, database, OAuth client secret, dan private key referensi tidak disalin ke repository.

Integrasi sudah diimplementasikan, tetapi alur Google nyata belum diuji melalui browser. Authorized domain dan konfigurasi OAuth perlu diperiksa pada hostname final sebelum peluncuran. Tes backend memakai token bertanda tangan dari key offline, tanpa menghubungi akun Google pengguna.

## Konfigurasi lokal

Isi `.env` yang diabaikan Git menggunakan nama berikut:

- `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`: konfigurasi web Firebase.
- `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_STORAGE_BUCKET`: konfigurasi web tambahan bila diperlukan.
- `ALLOWED_EMAILS`: daftar email dipisahkan koma, opsional. Nilai kosong mengizinkan semua pengguna Google yang lolos verifikasi; setiap pengguna tetap hanya mengakses koleksinya sendiri.
- `APP_ORIGIN`: origin persis antarmuka, misalnya `http://127.0.0.1:3100` untuk hasil build lokal, `http://127.0.0.1:3101` untuk Vite, atau origin HTTPS domain produksi.

Jika `APP_ORIGIN` kosong, backend hanya menurunkan origin HTTP dari header Host loopback `localhost` atau `127.0.0.1` yang valid. Gunakan nilai eksplisit untuk pengembangan Vite dan domain produksi.

Konfigurasi Firebase web terlihat oleh browser dan harus dibatasi untuk API Firebase yang sesuai. Jangan memasukkan OAuth client secret, service-account JSON, private key, atau token server ke konfigurasi tersebut. `/.env.example` harus tetap kosong untuk seluruh isian Firebase dan `ALLOWED_EMAILS`; hook menolak nilai nonlokal pada contoh staged maupun riwayat.

Rujukan: [Firebase API keys dan konfigurasi publik](https://firebase.google.com/docs/projects/api-keys).

## Verifikasi dan otorisasi

Request `/api/listings` memerlukan `Authorization: Bearer <Firebase-ID-token>`. Backend memverifikasi tanda tangan RS256 memakai public JWK Google, project ID sebagai audience, issuer Firebase, sub/UID, dan klaim waktu `exp`, `iat`, `auth_time`. Email harus terverifikasi dan `firebase.sign_in_provider` harus `google.com`.

Backend mengambil pemilik dari token terverifikasi dan menyimpan listing per UID di SQLite privat. ID/waktu yang dikirim klien diganti dengan nilai server; identitas pemilik dari payload diabaikan. Pengguna lain tidak dapat membaca atau menghapus listing tersebut. Request tulis juga harus membawa `Origin` yang cocok dengan `APP_ORIGIN`; tidak ada CORS lintas origin atau bypass login berbasis environment.

Firebase project yang sama berarti kumpulan identitas pengguna juga sama. Kebijakan akses rumah-tinggal serta database tetap terpisah dari proyek referensi. Backend ini tidak membutuhkan Admin SDK atau private key service account. Verifikasi token tidak melakukan pemeriksaan pencabutan sesi setiap request; token yang masih valid diverifikasi sampai masa berlakunya habis.

Rujukan: [verifikasi Firebase ID token](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

## Domain sebelum peluncuran

Usulan hostname: `rumah.faizmuttaqin.com`; template deployment memakai `rumah.example.com` sebagai placeholder.

1. Tambahkan hostname aplikasi ke **Firebase Authentication → Settings → Authorized domains**. Periksa `localhost` bila diperlukan untuk pengembangan.
2. Pastikan provider Google aktif serta origin dan redirect URI OAuth cocok dengan auth domain/helper yang benar-benar digunakan. Popup sekarang memakai helper pada `FIREBASE_AUTH_DOMAIN` yang dikonfigurasi.
3. Atur `APP_ORIGIN` ke origin HTTPS final dan uji popup login, logout, penolakan akun yang tidak diizinkan, serta pemisahan data antarakun di domain tersebut.

Jika kelak mengganti alur menjadi redirect atau memakai auth domain aplikasi sendiri, ikuti panduan browser Firebase. Pada nginx, proxy transparan GET/POST `/__/auth/` dapat dipakai menuju host Firebase project, bersama perubahan `authDomain`, Authorized Domains, dan OAuth redirect URI `https://<hostname-aplikasi>/__/auth/handler`. Handler harus diproxy; HTTP 302 tidak menggantikannya. Blok opsional pada template nginx masih dikomentari dan memerlukan penggantian placeholder host.

DNS Cloudflare belum menyediakan HTTPS, konfigurasi Firebase/Google, atau helper auth pada domain baru.

Rujukan: [Google sign-in di web](https://firebase.google.com/docs/auth/web/google-signin), [redirect dan pembatasan penyimpanan browser](https://firebase.google.com/docs/auth/web/redirect-best-practices), [FAQ authorized domains dan OAuth](https://firebase.google.com/docs/auth/faq-and-troubleshooting).
