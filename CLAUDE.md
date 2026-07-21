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
- `index.html` — frontend publik (landing + 9 form dinamis + cek status). Config 9 kategori
  (`KATEGORI`) dan master wilayah (`WILAYAH`) ada di dalamnya sebagai **satu sumber**.
- `admin.html` — dashboard admin (di-serve di `?page=admin`). Login berkode, queue tabel+kanban,
  approve/reject/assign, detail+riwayat, analitik, ekspor CSV. Preview lokal: kode demo
  `super` / `admin`.
- `Code.js` — backend: `doGet` (routing publik vs admin), `getStats`, `submitPermohonan`,
  `cekStatus`, API admin (`adminLogin`/`adminData`/`adminAksi`, `cekAdmin_` = trust boundary),
  helper `*_`.
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
- **GOTCHA FATAL — stripper komentar GAS:** HtmlService menstrip komentar dari JS inline
  secara **per-baris dan naif (tanpa sadar string)**. Akibat wajib ditaati di `index.html`
  dan `admin.html`: (1) di dalam `<script>` HANYA boleh komentar `//`, JANGAN PERNAH
  komentar blok — banner multiline meninggalkan `*/` yatim / pembuka menggantung yang
  memutilasi kode tersaji (sudah terjadi: `Tema is not defined` di produksi); (2) string
  tak boleh mengandung sekuens slash-asterisk — `'image/(asterisk)'` dirakit runtime lewat
  `const IMG`; (3) stripper `//` mengenali string `'...'`/`"..."` tapi TIDAK backtick —
  JANGAN menaruh URL `https://...` (atau `//` apa pun) di dalam template literal; pakai
  konkatenasi string biasa (kasus nyata: `drivePreview` membuat login admin blank).
  Preview `file://` TIDAK memunculkan bug ini; hanya muncul saat disajikan GAS.
- **Storage di iframe GAS bisa melempar SecurityError** (cookie pihak ketiga diblokir) —
  semua akses localStorage/sessionStorage lewat wrapper `LS`/`SS` (try-catch), jangan akses
  langsung.
- **Animasi mesh dimatikan saat `isGas`** (class `di-gas`) — blur besar beranimasi bisa
  membekukan renderer di iframe sandbox/software compositing.
- `KATEGORI` (index.html) & `KATEGORI_VALID` (Code.js) adalah kontrak — kalau tambah/ubah
  kategori, samakan keduanya.
- Skema kolom `Submissions` (`HEADERS` di Code.js) dipakai lintas fungsi — ubah serempak.
- Upload berkas lewat base64/`google.script.run` (batas payload ~50MB). Berkas besar/banyak
  perlu upgrade ke Drive Picker/resumable (ditandai `ponytail:` di `simpanBerkas_`).
- `WILAYAH` di index.html baru subset kabupaten (provinsi aktif + kota besar) — lengkapi dari
  sheet `MasterWilayah` saat modul admin dibangun.

## Akses admin
- URL dashboard: `<webapp>/exec?page=admin`. Tidak ditautkan dari UI publik (bookmark).
- Auth = kode akses di sheet `Admins` (seed 1 super admin dari `CONFIG.ADMIN_SUPER_CODE`).
  **Ganti kode seed sebelum go-live.** Eksekutor yang bisa di-assign = daftar nama di `Admins`.

## Belum dibangun (backlog — lihat docs/PROGRESS.md)
Notifikasi Telegram/WA, sheet `MasterWilayah`/`Config`, upload berkas besar (resumable).
