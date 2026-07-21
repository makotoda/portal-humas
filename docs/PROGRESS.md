# PROGRESS — Portal Komunikasi Kehumasan

## Sedang dikerjakan
- (kosong) — spine selesai; menunggu keputusan lanjut ke modul admin.

## Selesai
- **Spine (21 Jul 2026)** — terverifikasi di browser preview, nol error console:
  - Landing cinematic: hero gradient mesh + grain, glass, stats count-up, CTA.
  - Grid 9 kategori dengan 3D tilt (mouse), ikon line-art custom.
  - Form dinamis dari **satu config** `KATEGORI` (9 kategori, field & syarat per kategori).
  - Dropdown Provinsi→Kabupaten cascade dari `WILAYAH` (cegah data kotor).
  - Validasi field wajib + format nomor WA; dropzone upload + preview thumbnail.
  - Submit → nomor tiket `PKH-YYYYMM-XXXX` + modal konfirmasi (seal beranimasi).
  - Cek status publik (tiket/WA) + timeline visual Terkirim→Direview→Selesai.
  - Tema gelap default + toggle terang; `prefers-reduced-motion` dihormati.
  - Backend `Code.js`: `doGet`, `getStats`, `submitPermohonan` (Drive upload + LockService),
    `cekStatus`, self-heal sheet `Submissions`, fungsi `uji_()`.
  - Infra: `appsscript.json`, `.clasp.json` (placeholder), `.gitignore`,
    workflow auto-deploy Actions, `README.md`.

## Backlog (urut prioritas)
1. **Dashboard admin** — tabel/kanban bahan masuk; filter kategori/provinsi/status/eksekutor;
   aksi Approve / Reject+alasan / Assign (≤3 klik); preview berkas inline; riwayat komunikasi;
   statistik ringkas (approval rate per provinsi, waktu proses, tren alasan reject).
2. **Login admin** — whitelist email/kode akses (`Admins` sheet), role admin vs super admin.
3. **Notifikasi** — Telegram/WA saat status berubah (pola bot Telegram).
4. **Sheet `MasterWilayah`/`Config`** — pindahkan wilayah & teks ketentuan ke sheet agar
   editable tanpa ubah kode; lengkapi seluruh kabupaten/kota (514).
5. **Upload berkas besar** — ganti base64 ke Drive Picker/resumable bila payload sering >50MB.

## Keputusan teknis penting
- **Satu file frontend** (bukan template include GAS) supaya bisa dipreview lokal apa adanya
  + pola Kodomo. Saat dashboard admin ditambah, pertimbangkan split via `include()` GAS +
  shim preview lokal.
- **Nol dependensi** — semua efek "cinematic glass" pakai CSS/JS murni (tilt, mesh, grain,
  count-up, reveal). Font memakai system stack (offline-safe); ganti ke Inter via 1 `<link>`
  bila diinginkan.
- **Public anonymous, executeAs deployer** (`appsscript.json`) — pengirim tanpa login, sama
  seperti sistem lama. Modul admin butuh lapis akses sendiri (belum ada).
- **Ticket bulanan** `PKH-YYYYMM-XXXX`, sequence dihitung dalam `LockService` (anti balapan).
