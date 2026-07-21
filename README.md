# Portal Komunikasi Kehumasan — Ditjen Bimas Hindu

Web app Google Apps Script: satu portal untuk satker daerah mengirim bahan publikasi
(berita, naskah, konten) dan memantau statusnya. Backend GAS + Google Sheets + Google Drive,
frontend satu file `index.html` (vanilla, nol dependensi).

> **Status:** _spine_ (landing + 9 form + submit + tiket + cek status) selesai & terverifikasi.
> Dashboard admin, login, notifikasi Telegram = tahap berikutnya (lihat `docs/PROGRESS.md`).

## Preview lokal (tanpa deploy)
Buka `index.html` langsung di browser. Tanpa GAS, app jalan **mode demo** (data di
`localStorage`) — semua alur bisa dicoba. Di GAS ia otomatis pakai `google.script.run`.

## Setup & Deploy (sekali di awal)

### 1. Buat Google Sheet (database)
Buat spreadsheet baru → salin **ID**-nya (bagian di URL: `/d/<ID>/edit`). Sheet `Submissions`
akan dibuat + diberi header otomatis saat web app pertama diakses.

### 2. Buat folder Drive (berkas unggahan)
Buat folder di Google Drive → salin **ID**-nya (`/folders/<ID>`). Boileh dilewati (app akan
membuat folder "Portal Kehumasan - Unggahan" di My Drive bila kosong).

### 3. Isi konfigurasi
Dua cara (pilih satu):
- **Cepat:** edit `CONFIG_DEFAULT` di `Code.js` (`SPREADSHEET_ID`, `DRIVE_FOLDER_ID`).
- **Rapi (ID tak ikut ter-commit):** di editor Apps Script → Project Settings →
  Script Properties, tambah kunci `SPREADSHEET_ID` & `DRIVE_FOLDER_ID`. Nilai ini menang atas `CONFIG_DEFAULT`.

### 4. Buat Apps Script project & hubungkan clasp
```bash
npm install -g @google/clasp     # node/clasp belum terpasang di mesin ini — install dulu
clasp login
clasp create --type webapp --title "Portal Kehumasan"   # ATAU pakai scriptId yang sudah ada
# salin scriptId ke .clasp.json (ganti GANTI_DENGAN_SCRIPT_ID)
clasp push -f
```

### 5. Deploy sebagai Web App
`clasp open` → Deploy → New deployment → **Web app** → Execute as **Me**, Who has access
**Anyone**. Salin URL `/exec`. (Untuk auto-deploy: salin **deployment ID** ke
`.github/workflows/deploy.yml` dan aktifkan langkah `clasp deploy -i ...`.)

### 6. Uji dari editor
Jalankan fungsi `uji_()` di editor Apps Script → cek Log muncul nomor tiket & status.

### 7. (opsional) Auto-deploy via GitHub Actions
Repo Settings → Secrets → Actions → tambah `CLASPRC_JSON` = isi file `~/.clasprc.json`
(hasil `clasp login`). Tiap push ke `main` akan `clasp push -f` otomatis.

### 8. Sematkan ke Google Sites (portal)
Di Google Sites → Insert → Embed → **By URL** → tempel URL `/exec`. Manifest sudah memakai
`XFrameOptionsMode.ALLOWALL` agar bisa di-embed.

## Struktur file
| File | Isi |
|---|---|
| `index.html` | Frontend publik (config 9 kategori `KATEGORI` + master `WILAYAH` di dalamnya) |
| `admin.html` | Dashboard admin (di `?page=admin`): login berkode, queue, approve/reject/assign, analitik, ekspor CSV |
| `Code.js` | Backend: `doGet` (routing), `getStats`, `submitPermohonan`, `cekStatus`, API admin, helper |
| `appsscript.json` | Manifest (anonymous, executeAs deployer, scope Sheets+Drive) |
| `.github/workflows/deploy.yml` | Auto `clasp push` saat push ke `main` |
| `CLAUDE.md` / `docs/PROGRESS.md` | Dokumentasi & status pekerjaan |

## Dashboard admin
- Buka `<URL /exec>?page=admin`. Login pakai **kode akses** (baris di sheet `Admins`).
  Saat pertama, sheet `Admins` di-seed 1 super admin dengan kode dari `CONFIG.ADMIN_SUPER_CODE`
  — **ganti kode ini sebelum dipakai** (edit Script Property `ADMIN_SUPER_CODE` atau baris sheet).
- Tambah admin/eksekutor lain: lewat tombol **Kelola Admin** di dashboard (khusus super admin),
  atau manual tambah baris di sheet `Admins` (`Nama`, `Kode`, `Role`=`admin`/`super`).
- Preview lokal `admin.html`: kode demo `super` atau `admin` (data contoh dari `localStorage`).

## Catatan
- Ubah/ tambah kategori: samakan `KATEGORI` (index.html) dan `KATEGORI_VALID` (Code.js).
- Skema kolom sheet ada di `HEADERS` (Code.js) — ubah serempak bila menambah kolom.
- Upload berkas via base64 (batas payload ~50MB) — cukup untuk foto/dokumen umum.
