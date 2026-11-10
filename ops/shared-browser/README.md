# Shared browser sementara

Sesi desktop Chromium ini dipakai untuk login manual ke situs properti, lalu penelusuran dapat dilanjutkan pada sesi yang sama. Ia terpisah dari aplikasi dan crawler. Pengguna memasukkan kredensial situs sendiri; beri tahu agen setelah login selesai agar penelusuran dilanjutkan. Pesan kepada pengiklan memerlukan instruksi tersendiri.

## Instalasi

Pada Ubuntu 24.04, pasang `xvfb xauth x11vnc novnc websockify openbox`. Gunakan direktori Chromium lengkap dari instalasi Playwright, bukan `chromium_headless_shell`.

```sh
sudo python3 -I ops/shared-browser/setup.py /path/to/chrome-linux64
sudo systemctl start rumah-shared-browser.service
```

Installer menyalin browser ke `/opt/rumah-shared-browser`, membuat akun sistem `rumah-browser`, dan memasang profil AppArmor khusus executable tersebut agar namespace sandbox Chromium tetap berfungsi. Pengaturan user namespace global tidak diubah dan browser berjalan tanpa `--no-sandbox`.

Service aktif sementara, tidak di-enable saat boot, dan berhenti setelah paling lama 12 jam. Profil login tetap tersimpan secara privat di `/var/lib/rumah-shared-browser/profile`. Direktori profil dan cache tidak ikut Git, bundel aplikasi, log atau sinkronisasi crawler. Password manager dan sinkronisasi browser dimatikan. Installer menolak memperbarui instalasi saat sesi masih aktif.

## Akses

Backend noVNC mendengarkan `127.0.0.1:6080`. Akses lokal:

```text
http://127.0.0.1:6080/vnc.html?autoconnect=1&resize=scale&shared=1&path=websockify
```

Untuk akses dari komputer lain sebelum memasang proxy, gunakan SSH port forwarding:

```sh
ssh -L 6080:127.0.0.1:6080 USER@SERVER
```

Buka URL lokal di atas pada komputer yang menjalankan SSH. Kata sandi VNC dimasukkan melalui dialog noVNC. Nilai akses disimpan hanya pada file root berikut; jangan menyalinnya ke chat, URL, log, atau Git:

```sh
sudo cat /etc/rumah-shared-browser/access.txt
```

Untuk Nginx pada server yang sama, salin blok `nginx-location.conf.example` ke server HTTPS yang dipilih, jalankan `nginx -t`, kemudian reload Nginx. Blok ini memakai HTTP Basic Auth tambahan. URL akses melalui path contoh:

```text
https://DOMAIN/shared-browser/vnc.html?autoconnect=1&resize=scale&shared=1&path=shared-browser/websockify
```

Untuk subdomain khusus, gunakan `nginx-subdomain-location.conf.example` dalam server HTTPS, misalnya `browser.faizmuttaqin.com`. Upstream tetap `http://127.0.0.1:6080`, dengan WebSocket aktif. URL noVNC berada langsung di `/vnc.html?autoconnect=1&resize=scale&shared=1&path=websockify`.

Nama domain/path aktual ditentukan operator. Jika Nginx berada di server berbeda, gunakan koneksi privat atau SSH forwarding untuk upstream loopback. Port VNC `5900` dan CDP `9222` tetap lokal dan tidak diteruskan ke publik. CDP dapat dipakai agen lokal untuk melanjutkan browser yang sama setelah pengguna menyelesaikan login.

## Operasi

```sh
sudo systemctl status rumah-shared-browser.service
sudo systemctl stop rumah-shared-browser.service
sudo systemctl start rumah-shared-browser.service
```

Menutup browser desktop juga mengakhiri sesi. Menutup tab noVNC saja tidak menghapus login. Stop/start mempertahankan profil; penghapusan profil atau logout dilakukan atas permintaan pengguna. Jangan mengambil screenshot atau memeriksa form selama pengguna memasukkan kredensial.

Konfigurasi aplikasi produksi, SQLite, env privat dan jadwal crawler tidak diubah oleh installer ini.
