# Deployment server

Aplikasi produksi tersedia di `https://rumah.faizmuttaqin.com`, melalui nginx dan service systemd `rumah-tinggal.service` pada loopback port 3100. Template pada repository tetap berupa contoh; konfigurasi aktif berada di `/etc`. Catatan rilis aktual, tracker, dan operasi server tersimpan lokal di `.context/` yang diabaikan Git.

## Build dan proses aplikasi

Gunakan Node.js 26.13.0 LTS dan dependency yang dipin pada lockfile. Dari checkout yang telah dibootstrap:

```sh
./dev install --frozen-lockfile
./dev check
./dev test
./dev build
./dev test:e2e
./dev start
```

Backend berjalan pada `127.0.0.1:3100`, melayani hasil build `dist/` dan API. `GET /api/health` memberi status proses; endpoint tersebut tidak membuktikan bahwa login Google dan domain OAuth sudah siap. Jangan menjalankan Vite dev server sebagai proses produksi.

Playwright memakai server QA sendiri pada `127.0.0.1:13100`, `APP_ORIGIN` yang sesuai, dan database `.runtime/e2e`. Suite menolak memakai server yang sudah ada pada port QA dan tidak memakai state produksi. Tes peta memakai tile sintetis; jalankan build sebelum suite agar kode terbaru yang diuji.

Untuk pengembangan, `./dev dev:api` memakai port 3100 dan `./dev dev` memakai port 3101. Atur `.env` secara eksplisit menjadi `APP_ORIGIN=http://127.0.0.1:3101` lalu buka origin tersebut. Saat menjalankan hasil build lokal, gunakan `APP_ORIGIN=http://127.0.0.1:3100`. Domain produksi memakai origin HTTPS final. Jangan membuka pengecualian origin untuk mengatasi perbedaan port.

## Direktori rilis dan data

Checkout berada di `/root/projects/rumah-tinggal`; service memakai akun khusus `rumah-tinggal` dan tidak mengakses `/root`. Rilis disimpan di **`/opt/rumah-tinggal/releases/<release-id>`**, dipilih melalui symlink **`/opt/rumah-tinggal/current`**. Build dilakukan sebelum aktivasi rilis.

Rilis hanya membutuhkan `dist/`, kode produksi `server/` tanpa tes, `src/types.ts`, `package.json`, dan paket runtime `jose` pada `node_modules/jose` yang disalin tanpa symlink ke checkout. Runtime Node 26 ditempatkan di **`/opt/rumah-tinggal/runtime/node`**. Toolchain pnpm, dependency pengembangan, dan cache tidak disalin ke produksi.

Source/rilis dimiliki administrator dan tidak perlu dapat ditulis akun aplikasi. Jangan membawa `.git`, `.env`, database, cache pengembangan, atau hasil analisis sementara ke document root. HTTP aplikasi hanya melayani ekstensi publik yang diizinkan di `dist/`, menolak dotfiles/path privat/traversal, dan tidak mengikuti symlink keluar direktori build.

Konfigurasi produksi disediakan melalui **`/etc/rumah-tinggal.env`**, dimiliki administrator dengan izin `0600`. File tersebut berisi konfigurasi Firebase web, origin HTTPS final, dan allowlist bila digunakan; jangan menaruh service-account key atau OAuth client secret di sana. Untuk template systemd, pastikan nilainya mencakup:

```dotenv
HOST=127.0.0.1
PORT=3100
APP_ORIGIN=https://rumah.example.com
DATA_DIR=/var/lib/rumah-tinggal
```

Ganti hostname placeholder dengan domain final. `DATA_DIR` pada file environment harus tetap menunjuk ke direktori state absolut di atas; jangan menyalin nilai relatif dari `.env.example` tanpa penyesuaian. `EnvironmentFile` systemd dapat menimpa default `Environment` pada unit.

SQLite privat berada di `/var/lib/rumah-tinggal/rumah-tinggal.sqlite`, beserta sidecar WAL/SHM saat digunakan. Aplikasi memakai direktori `0700` dan database `0600`. Data ini tidak masuk repository atau `dist/`; tiga file geografis publik di `public/data/` tetap terpisah. Siapkan backup SQLite yang konsisten dengan mekanisme backup SQLite atau saat service berhenti, bukan hanya menyalin file utama ketika WAL masih aktif.

## Template systemd dan nginx

[rumah-tinggal.service.example](../deploy/rumah-tinggal.service.example) memakai akun khusus `rumah-tinggal`, working directory `/opt/rumah-tinggal/current`, dan runtime Node secara langsung dengan entrypoint relatif `server/index.ts`. Entrypoint relatif penting karena Node menyelesaikan symlink ke direktori rilis fisik. systemd memberikan environment sehingga argumen `--env-file-if-exists` tidak diperlukan. `StateDirectory=rumah-tinggal` menyediakan direktori data di `/var/lib`; aplikasi tidak menulis ke rilis.

Unit aktif adalah `/etc/systemd/system/rumah-tinggal.service`, berstatus enabled agar berjalan saat boot. Pantau dengan `systemctl status rumah-tinggal` dan `journalctl -u rumah-tinggal`. Mengganti source checkout tidak memperbarui rilis aktif: build, siapkan rilis baru, pilih symlink `current`, kemudian restart service dan verifikasi health. Pertahankan direktori state dan konfigurasi saat memperbarui atau rollback.

[nginx.conf.example](../deploy/nginx.conf.example) meneruskan HTTPS ke loopback port 3100 serta menolak dotfiles dan sejumlah path/ekstensi sensitif. Root ACME contoh adalah `/var/www/rumah-tinggal/public`, terpisah dari `/opt` dan database. Ganti `server_name` serta jalur sertifikat; sertifikat dan private key harus tersedia di luar repository sebelum konfigurasi HTTPS bisa lolos `nginx -t`.

## Peluncuran pada domain final

1. Siapkan rilis, akun service, konfigurasi produksi, dan direktori state; uji proses melalui loopback. Pastikan hanya hasil frontend yang tersedia lewat HTTP.
2. Buat record DNS Cloudflare menuju server. Jika diproxy Cloudflare, gunakan **Full (strict)** dengan sertifikat origin valid untuk hostname tersebut. Mode DNS only memerlukan sertifikat publik tepercaya oleh browser pada nginx. DNS saja belum menjalankan aplikasi atau menyiapkan TLS.
3. Selesaikan Authorized Domains dan pengaturan Google/Firebase, lalu uji login nyata pada domain HTTPS final. Lihat [login Google](auth-google.md). Proxy helper nginx hanya diaktifkan bila rancangan auth domain membutuhkannya dan placeholder telah diganti.
4. Saat peluncuran diminta, tinjau dan pasang template yang telah disesuaikan. Validasi nginx dengan `nginx -t` sebelum reload; periksa HTTPS, health, login/logout, penolakan akses tanpa izin, dan pemisahan listing dua akun.

Template mentah tidak dapat langsung dipakai pada server lain: domain, jalur sertifikat, rilis, akun service, dan environment masih memerlukan provisioning. Jangan mematikan service produksi saat menutup sesi chat; QA harus memakai proses, port, dan direktori data terpisah.

Rujukan: [Firebase pada nginx](https://firebase.google.com/docs/auth/web/redirect-best-practices), [Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).
