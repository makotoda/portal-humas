# PROGRESS — Portal Komunikasi Kehumasan

## Sedang dikerjakan
- (kosong) — spine + dashboard admin selesai; kandidat berikutnya: notifikasi Telegram
  atau pindah wilayah/ketentuan ke sheet Config.

## Selesai
- **Dashboard admin (21 Jul 2026)** — file `admin.html` (route `?page=admin`), terverifikasi
  di browser, nol error console:
  - Login berbasis **kode akses** (sheet `Admins`), diverifikasi ulang server tiap aksi
    (trust boundary, stateless). Role `super`/`admin`; auto-login via sessionStorage.
  - Queue **Tabel + Kanban** (toggle), filter kategori/provinsi/status/eksekutor + cari.
  - Aksi cepat **Setujui / Tolak+alasan / Assign / Tandai Direview** (live re-render).
  - Modal **Detail**: info lengkap, preview berkas (iframe Drive), assign eksekutor,
    **riwayat komunikasi** (dari sheet `Riwayat`).
  - **Analitik**: 5 stat card, penerimaan per provinsi (bar), alasan penolakan teratas,
    rerata waktu proses.
  - **Ekspor CSV** hasil terfilter. Tema gelap/terang.
  - Backend `Code.js`: routing `doGet(?page=admin)`, `adminLogin`, `adminData`, `adminAksi`,
    sheet `Admins`(seed super)/`Riwayat`, `cekAdmin_` (trust boundary).

## Selesai (spine)
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
1. **Notifikasi** — Telegram/WA saat status berubah (pola bot Telegram); kelola daftar
   eksekutor dari UI (super admin) — sekarang eksekutor = daftar nama di sheet `Admins`.
2. **Kelola admin dari UI** — super admin tambah/hapus admin & atur role (kini manual di
   sheet `Admins`).
3. **Sheet `MasterWilayah`/`Config`** — pindahkan wilayah & teks ketentuan ke sheet agar
   editable tanpa ubah kode; lengkapi seluruh kabupaten/kota (514).
4. **Upload berkas besar** — ganti base64 ke Drive Picker/resumable bila payload sering >50MB.
5. **Filter tanggal** di dashboard (kini: kategori/provinsi/status/eksekutor/cari).

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
