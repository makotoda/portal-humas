# PROGRESS — Portal Komunikasi Kehumasan

## Sedang dikerjakan
- (kosong) — lihat Backlog di bawah untuk kandidat berikutnya; dua dari tiga item
  butuh info/keputusan dari Anda dulu (lihat catatan blocker per item).

## Selesai (sistem revisi per-field + fix produksi, 22-23 Jul 2026)
- **Minta Revisi per-field**: admin mencentang field spesifik yang perlu diperbaiki
  pengirim (bukan revisi seluruh form). Prefix `[REVISI:field1,field2]` disisipkan
  ke `Keterangan`, dibersihkan lagi saat ditampilkan di riwayat/timeline.
  Form revisi di sisi pengirim mengunci semua field kecuali yang dicentang.
- **Cek status tahan format WA lama** (`cekStatus`) — nomor tanpa angka nol depan
  dari form lama tetap cocok.
- Perbaikan bug produksi (ditemukan saat verifikasi live, bukan preview lokal):
  1. `Status._card()` memakai variabel `ket`/`revFields` yang tak pernah didefinisikan
     → `ReferenceError` di setiap render kartu → Cek Status selalu gagal untuk semua
     pengguna. Diperbaiki dengan parsing prefix `[REVISI:...]` dari `r.keterangan`.
  2. `KATEGORI`/`FIELD_DEF` baru di `admin.html` memakai literal `'image/*'` →
     kena gotcha stripper komentar GAS (lihat CLAUDE.md) → mematikan seluruh script
     admin di produksi. Diganti ke konstanta `IMG`.
  3. Tombol Setujui/Tolak/Revisi (tabel + modal) tetap aktif walau tiket sudah
     Disetujui/Ditolak → sekarang `disabled` via `statusFinal(status)`.
  4. Field kabupaten di form revisi ikut ter-*enable* meski tak dicentang reviewer —
     akar masalah: `_wireWilayah`'s change-handler menimpa `kab.disabled` tanpa sadar
     status lock revisi. Fix di satu titik (shared handler), bukan per-caller.
  5. Tiga bug lingkungan iframe GAS lain (login admin blank, mesh animasi membekukan
     renderer, `localStorage` SecurityError) — didokumentasikan di CLAUDE.md.

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
1. **Notifikasi** — Telegram/WA saat status berubah. **Blocker: butuh token bot
   Telegram / kredensial WA API dari Anda** — belum ada satu pun di repo/sheet ini,
   tak bisa dibangun tanpa itu. Kelola daftar eksekutor dari UI sudah selesai
   (lihat "Selesai — admin lanjutan").
2. **Sheet `MasterWilayah`/`Config`** — pindahkan wilayah & teks ketentuan ke sheet agar
   editable tanpa ubah kode. Plumbing (sheet + self-heal + fungsi getter) bisa dibangun
   kapan saja tanpa info tambahan; **tapi melengkapi seluruh 514 kabupaten/kota butuh
   sumber data resmi** (BPS/Kemendagri) — mengarang isian administratif berisiko salah,
   jadi belum diisi. Subset saat ini (provinsi aktif + kota besar) tetap dipakai.
3. **Upload berkas besar** — ganti base64 ke Drive Picker/resumable. Belum ada laporan
   payload >50MB gagal di produksi — ditunda sampai benar-benar jadi masalah (YAGNI).

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
