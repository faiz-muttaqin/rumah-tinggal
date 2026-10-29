# Deployment server

Aplikasi sudah dapat dibuild dan dijalankan lokal. Template nginx dan systemd tetap tidak aktif; belum ada perubahan layanan publik dari penyiapan ini. Usulan hostname adalah `rumah.faizmuttaqin.com`, sedangkan template memakai `rumah.example.com` sebagai placeholder.

## Build dan proses aplikasi

Gunakan Node.js 26.13.0 LTS dan dependency yang dipin pada lockfile. Dari checkout yang telah dibootstrap:

```sh
./dev install --frozen-lockfile
./dev check
./dev test
./dev test:e2e
./dev build
./dev start
```

Backend berjalan pada `127.0.0.1:3100`, melayani hasil build `dist/` dan API. `GET /api/health` memberi status proses; endpoint tersebut tidak membuktikan bahwa login Google dan domain OAuth sudah siap. Jangan menjalankan Vite dev server sebagai proses produksi.

Untuk pengembangan, `./dev dev:api` memakai port 3100 dan `./dev dev` memakai port 3101. Atur `.env` secara eksplisit menjadi `APP_ORIGIN=http://127.0.0.1:3101` lalu buka origin tersebut. Saat menjalankan hasil build lokal, gunakan `APP_ORIGIN=http://127.0.0.1:3100`. Domain produksi memakai origin HTTPS final. Jangan membuka pengecualian origin untuk mengatasi perbedaan port.

## Direktori rilis dan data

Checkout saat ini berada di `/root/projects/rumah-tinggal`; akun service khusus tidak dapat mengaksesnya dengan pembatasan `ProtectHome`. Untuk deployment, siapkan salinan rilis terpisah di **`/opt/rumah-tinggal`** yang dapat dibaca/dieksekusi akun `rumah-tinggal`. Rilis membutuhkan hasil build `dist/`, kode backend, `src/types.ts`, runtime Node lokal di `.tools/`, dan dependency runtime dengan symlink paket yang tetap utuh. Build dilakukan sebelum menjalankan service.

Source/rilis dimiliki administrator dan tidak perlu dapat ditulis akun aplikasi. Jangan membawa `.git`, `.env`, database, cache pengembangan, atau hasil analisis sementara ke document root. HTTP aplikasi hanya melayani ekstensi publik yang diizinkan di `dist/`, menolak dotfiles/path privat/traversal, dan tidak mengikuti symlink keluar direktori build.

Konfigurasi produksi disediakan melalui **`/etc/rumah-tinggal.env`**, dimiliki administrator dengan izin `0600`. File tersebut berisi konfigurasi Firebase web, origin HTTPS final, dan allowlist bila digunakan; jangan menaruh service-account key atau OAuth client secret di sana. Untuk template systemd, pastikan nilainya mencakup:

```dotenv
HOST=127.0.0.1
PORT=3100
APP_ORIGIN=https://rumah.example.com
DATA_DIR=/var/lib/rumah-tinggal
```

Ganti hostname placeholder dengan domain final. `DATA_DIR` pada file environment harus tetap menunjuk ke direktori state absolut di atas; jangan menyalin nilai relatif dari `.env.example` tanpa penyesuaian. `EnvironmentFile` systemd dapat menimpa default `Environment` pada unit.

SQLite privat berada di `/var/lib/rumah-tinggal/rumah-tinggal.sqlite`, beserta sidecar WAL/SHM saat digunakan. Aplikasi memakai direktori `0700` dan database `0600`. Data ini tidak masuk repository atau `dist/`; dua file geografis publik di `public/data/` tetap terpisah. Siapkan backup SQLite yang konsisten dengan mekanisme backup SQLite atau saat service berhenti, bukan hanya menyalin file utama ketika WAL masih aktif.

## Template systemd dan nginx

[rumah-tinggal.service.example](../deploy/rumah-tinggal.service.example) memakai akun khusus `rumah-tinggal`, working directory `/opt/rumah-tinggal`, dan Node lokal secara langsung. systemd memberikan environment sehingga argumen `--env-file-if-exists` tidak diperlukan. `StateDirectory=rumah-tinggal` menyediakan direktori data di `/var/lib`; aplikasi tidak menulis ke rilis. Akun, rilis/runtime, environment file, dan seluruh jalur harus diprovision serta ditinjau sebelum unit dapat dijalankan. Template belum dipasang atau diaktifkan.

[nginx.conf.example](../deploy/nginx.conf.example) meneruskan HTTPS ke loopback port 3100 serta menolak dotfiles dan sejumlah path/ekstensi sensitif. Root ACME contoh adalah `/var/www/rumah-tinggal/public`, terpisah dari `/opt` dan database. Ganti `server_name` serta jalur sertifikat; sertifikat dan private key harus tersedia di luar repository sebelum konfigurasi HTTPS bisa lolos `nginx -t`.

## Peluncuran pada domain final

1. Siapkan rilis, akun service, konfigurasi produksi, dan direktori state; uji proses melalui loopback. Pastikan hanya hasil frontend yang tersedia lewat HTTP.
2. Buat record DNS Cloudflare menuju server. Jika diproxy Cloudflare, gunakan **Full (strict)** dengan sertifikat origin valid untuk hostname tersebut. Mode DNS only memerlukan sertifikat publik tepercaya oleh browser pada nginx. DNS saja belum menjalankan aplikasi atau menyiapkan TLS.
3. Selesaikan Authorized Domains dan pengaturan Google/Firebase, lalu uji login nyata pada domain HTTPS final. Lihat [login Google](auth-google.md). Proxy helper nginx hanya diaktifkan bila rancangan auth domain membutuhkannya dan placeholder telah diganti.
4. Saat peluncuran diminta, tinjau dan pasang template yang telah disesuaikan. Validasi nginx dengan `nginx -t` sebelum reload; periksa HTTPS, health, login/logout, penolakan akses tanpa izin, dan pemisahan listing dua akun.

Template mentah tidak dapat langsung dipakai: domain, jalur sertifikat, rilis, akun service, dan environment masih memerlukan provisioning.

Rujukan: [Firebase pada nginx](https://firebase.google.com/docs/auth/web/redirect-best-practices), [Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).
