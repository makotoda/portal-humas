# Project: Portal Komunikasi Kehumasan — Ditjen Bimas Hindu

Web app Google Apps Script yang menggantikan 9 Google Form + 1 sheet tracking manual milik
Tim Humas Ditjen Bimas Hindu. Satker daerah mengirim bahan publikasi (berita, naskah, konten)
lewat satu portal; Tim Humas mereview (approve/reject); pengirim memantau status via nomor tiket.
Disinkron via clasp + GitHub Actions (pola sama seperti project Kodomo).

## Stack
- **Backend:** Google Apps Script (`Code.js` = `Code.gs`). Google Sheets = database, Google Drive = berkas.
- **Frontend:** satu file `index.html` — HTML/CSS/JS vanilla, **nol dependensi** (glassmorphism,
  3D tilt, gradient mesh, count-up semua CSS/JS murni). Jalan di GAS (`google.script.run`) dan
  di preview lokal (mode demo `localStorage`) dari file yang sama.
- Bahasa domain: **Indonesia** (nama field/UI). Tema gelap default + toggle tema terang.

## Struktur
- `index.html` — seluruh frontend (landing + 9 form dinamis + cek status). Config 9 kategori
  (`KATEGORI`) dan master wilayah (`WILAYAH`) ada di dalamnya sebagai **satu sumber**.
- `Code.js` — backend: `doGet`, `getStats`, `submitPermohonan`, `cekStatus`, helper `*_`.
- `appsscript.json` — manifest (public anonymous, executeAs deployer, scope Sheets+Drive).
- `docs/PROGRESS.md` — status pekerjaan. **Baca di awal sesi.**
- `README.md` — cara setup & deploy (Sheet ID, folder Drive, secret Actions, embed Sites).

## Aturan alur kerja — GIT SUMBER KEBENARAN (sama seperti Kodomo)
GitHub Actions auto `clasp push -f` tiap push ke `main`. Perubahan yang hanya di-`clasp push`
lokal tanpa commit+push akan **tertimpa** deploy Actions berikutnya.
1. Sebelum edit: `git fetch origin` lalu rekonsiliasi dengan `origin/main`.
2. Setelah edit: commit ke `main` + `git push origin main` (Actions auto-deploy).
3. `clasp push -f` manual hanya SETELAH langkah 2 bila mau instan.

## Perintah
Tak ada build/test/lint. Semua via clasp (node/clasp belum terpasang di mesin ini — install dulu).
```
clasp push -f     # deploy manual (setelah git push)
clasp pull        # diagnostik: lihat yang live di GAS
clasp open        # buka editor Apps Script
```

## QA manual (belum ada test otomatis)
Preview lokal: buka `index.html` di browser (mode demo jalan tanpa server).
1. Beranda tampil, 9 kartu kategori terisi, stats count-up jalan.
2. Klik kategori → form muncul; pilih Provinsi → dropdown Kabupaten terisi (cascade).
3. Submit dgn field wajib kosong → ditolak (highlight + toast). WA format salah → ditolak.
4. Submit valid → modal nomor tiket `PKH-YYYYMM-XXXX` muncul.
5. Cek Status: masukkan tiket/WA → kartu + timeline (Terkirim→Direview→Selesai) tampil.
6. Toggle tema gelap/terang → keduanya rapi.
Di GAS: jalankan `uji_()` dari editor untuk memverifikasi submit+status server tanpa UI.

## Catatan penting
- `KATEGORI` (index.html) & `KATEGORI_VALID` (Code.js) adalah kontrak — kalau tambah/ubah
  kategori, samakan keduanya.
- Skema kolom `Submissions` (`HEADERS` di Code.js) dipakai lintas fungsi — ubah serempak.
- Upload berkas lewat base64/`google.script.run` (batas payload ~50MB). Berkas besar/banyak
  perlu upgrade ke Drive Picker/resumable (ditandai `ponytail:` di `simpanBerkas_`).
- `WILAYAH` di index.html baru subset kabupaten (provinsi aktif + kota besar) — lengkapi dari
  sheet `MasterWilayah` saat modul admin dibangun.

## Belum dibangun (backlog — lihat docs/PROGRESS.md)
Dashboard admin (approve/reject/assign, filter, statistik), login admin, notifikasi Telegram/WA,
sheet `MasterWilayah`/`Admins`/`Config`.
