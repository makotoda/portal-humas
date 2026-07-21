# PROGRESS — Portal Komunikasi Kehumasan

## Sedang dikerjakan
- (kosong) — spine + dashboard admin (termasuk kelola admin & filter tanggal) selesai;
  kandidat berikutnya: notifikasi Telegram atau pindah wilayah/ketentuan ke sheet Config.

## Selesai (admin lanjutan, 21 Jul 2026)
- **Kelola Admin & Eksekutor dari UI** (khusus super admin, tombol di topbar):
  daftar admin + ubah role + hapus + tambah (nama/kode/role). Guard server: bukan super →
  ditolak, hapus akun sendiri → ditolak, super terakhir tak bisa dihapus/diturunkan,
  kode unik min. 4 karakter. Kode tak pernah dikirim balik ke klien.
  Backend `adminKelola` + demo mode; eksekutor otomatis ikut daftar admin.
- **Filter tanggal** (dari/sampai) di bar filter — `<input type="date">` native, ikut
  memfilter tabel/kanban/ekspor CSV. Terverifikasi: guard + filter lolos uji di preview.

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
2. **Sheet `MasterWilayah`/`Config`** — pindahkan wilayah & teks ketentuan ke sheet agar
   editable tanpa ubah kode; lengkapi seluruh kabupaten/kota (514).
3. **Upload berkas besar** — ganti base64 ke Drive Picker/resumable bila payload sering >50MB.

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
