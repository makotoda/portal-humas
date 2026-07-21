/**
 * PORTAL KOMUNIKASI KEHUMASAN — Ditjen Bimas Hindu
 * Backend Google Apps Script. Google Sheets = database, Google Drive = berkas.
 *
 * File .js di sini = file .gs di editor Apps Script (disinkron via clasp).
 * Frontend tunggal: index.html (dipanggil lewat google.script.run).
 *
 * SETUP (lihat README.md): isi tiga konstanta CONFIG di bawah, lalu deploy.
 */

/* ===================== KONFIGURASI ===================== */
// Boleh diisi langsung di sini ATAU lewat Script Properties (kunci sama).
// Script Properties menang bila diisi — berguna agar ID tak ikut ter-commit.
const CONFIG_DEFAULT = {
  SPREADSHEET_ID: '1j_tuEOaKeoUAdZXGhbwaTdnDL8zg87LCZ_GLIKrV3NI', // ID Google Sheet database
  DRIVE_FOLDER_ID: 'GANTI_DENGAN_ID_FOLDER_DRIVE', // folder Drive induk untuk unggahan
  ADMIN_SUPER_CODE: 'ubah-kode-super-ini'        // kode super admin awal (seed sheet Admins)
};
function cfg_(k) {
  const p = PropertiesService.getScriptProperties().getProperty(k);
  return (p && p.trim()) ? p.trim() : CONFIG_DEFAULT[k];
}

const SHEET_SUBMISSIONS = 'Submissions';
const HEADERS = ['Timestamp','TicketID','Kategori','Provinsi','Kabupaten','Instansi',
                 'NamaPenulis','NoWA','FileLinks','Status','Eksekutor','Keterangan','LastUpdated'];

const SHEET_ADMINS = 'Admins';
const HEADERS_ADMIN = ['Nama','Kode','Role'];        // Role: 'super' | 'admin'
const SHEET_RIWAYAT = 'Riwayat';
const HEADERS_RIWAYAT = ['Timestamp','TicketID','Aksi','Oleh','Catatan'];

// Kategori valid + field organisasi wajibnya (kontrak dgn KATEGORI di index.html).
const KATEGORI_VALID = {
  'berita-daerah':     { org:'instansi',      penulis:false, video:false },
  'berita-widyalaya':  { org:'namaWidyalaya', penulis:false, video:false },
  'berita-ptkh':       { org:'instansi',      penulis:false, video:false },
  'naskah-mimbar':     { org:'instansi',      penulis:true,  video:false },
  'wisata-religi':     { org:'instansi',      penulis:false, video:false },
  'berita-pasraman':   { org:'namaPasraman',  penulis:false, video:false },
  'konten-medsos':     { org:'instansi',      penulis:false, video:false },
  'artikel-inspiratif':{ org:'instansi',      penulis:true,  video:false },
  'video-mimbar':      { org:'instansi',      penulis:true,  video:true  }
};

/* ===================== WEB APP ENTRY ===================== */
function doGet(e) {
  setupSheets_(); // self-heal: pastikan sheet & header ada
  const page = (e && e.parameter && e.parameter.page) || '';
  const file = page === 'admin' ? 'admin' : 'index';
  const judul = page === 'admin'
    ? 'Dashboard Humas — Portal Komunikasi Kehumasan'
    : 'Portal Komunikasi Kehumasan — Ditjen Bimas Hindu';
  return HtmlService.createHtmlOutputFromFile(file)
    .setTitle(judul)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    // ALLOWALL agar bisa disematkan (embed) di Google Sites portal.
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ===================== API (dipanggil frontend) ===================== */

/** Statistik ringkas untuk hero beranda. Non-kritis; aman bila kosong. */
function getStats() {
  const rows = dataRows_();
  const kini = new Date(), ym = kini.getFullYear() + pad2_(kini.getMonth() + 1);
  const idx = colIndex_();
  let bulanIni = 0, disetujui = 0, diputus = 0;
  const satker = {};
  rows.forEach(r => {
    const tid = String(r[idx.TicketID] || '');
    if (tid.indexOf('PKH-' + ym) === 0) bulanIni++;
    const st = String(r[idx.Status] || '').toLowerCase();
    if (/setuju|selesai|terbit|complete/.test(st)) { disetujui++; diputus++; }
    else if (/tolak|reject/.test(st)) diputus++;
    const ins = String(r[idx.Instansi] || '').trim();
    if (ins) satker[ins] = 1;
  });
  return {
    diproses: bulanIni,
    penerimaan: diputus ? Math.round((disetujui / diputus) * 100) : 0,
    satker: Object.keys(satker).length
  };
}

/**
 * Terima kiriman bahan. Mengembalikan { tiket, waktu }.
 * payload: { kategori, provinsi, kabupaten, instansi|namaWidyalaya|namaPasraman,
 *            namaPenulis?, noWA, linkVideo?, _files:[{slot,name,mime,data(base64)}] }
 */
function submitPermohonan(payload) {
  const p = payload || {};
  const spec = KATEGORI_VALID[p.kategori];
  if (!spec) throw new Error('Kategori tidak dikenal.');

  const org = String(p[spec.org] || p.instansi || '').trim();
  const provinsi = String(p.provinsi || '').trim();
  const kabupaten = String(p.kabupaten || '').trim();
  const noWA = normalizeWA_(p.noWA);
  const penulis = String(p.namaPenulis || '').trim();

  if (!provinsi || !kabupaten) throw new Error('Provinsi dan Kabupaten/Kota wajib dipilih.');
  if (!org) throw new Error('Nama instansi/satuan kerja wajib diisi.');
  if (!noWA) throw new Error('Nomor WhatsApp tidak valid.');
  if (spec.penulis && !penulis) throw new Error('Nama penulis wajib diisi.');
  if (spec.video && !String(p.linkVideo || '').trim()) throw new Error('Tautan video wajib diisi.');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = getSheet_(SHEET_SUBMISSIONS);
    const now = new Date();
    let tiket = p.tiket_revisi;
    let ym = '';
    let rownum = 0;
    const idx = colIndex_();

    if (tiket) {
      rownum = findRow_(sheet, tiket);
      if (!rownum) throw new Error('Tiket revisi tidak ditemukan.');
      ym = tiket.split('-')[1]; // ex: PKH-202607-0001 -> 202607
    } else {
      ym = now.getFullYear() + pad2_(now.getMonth() + 1);
      tiket = 'PKH-' + ym + '-' + pad4_(nextSeq_(sheet, 'PKH-' + ym + '-'));
    }

    // Simpan berkas ke Drive (folder: induk / Kategori / YYYY-MM / tiket)
    const links = simpanBerkas_(p._files || [], p.kategori, ym, tiket);
    
    let mergedFiles = [];
    if (rownum) {
      // Gabungkan berkas lama jika revisi
      const oldStr = sheet.getRange(rownum, idx.FileLinks + 1).getValue();
      try { mergedFiles = JSON.parse(oldStr || '[]'); } catch(e) {}
      if (spec.video && p.linkVideo) mergedFiles = mergedFiles.filter(f => f.slot !== 'linkVideo');
    }
    mergedFiles.push(...links);
    if (spec.video && p.linkVideo) mergedFiles.push({ slot: 'linkVideo', url: String(p.linkVideo).trim() });

    if (rownum) {
      // Menimpa baris yang sudah ada (Revisi)
      sheet.getRange(rownum, idx.Kategori + 1).setValue(p.kategori);
      sheet.getRange(rownum, idx.Provinsi + 1).setValue(provinsi);
      sheet.getRange(rownum, idx.Kabupaten + 1).setValue(kabupaten);
      sheet.getRange(rownum, idx.Instansi + 1).setValue(org);
      sheet.getRange(rownum, idx.NamaPenulis + 1).setValue(penulis);
      sheet.getRange(rownum, idx.NoWA + 1).setValue(noWA);
      sheet.getRange(rownum, idx.FileLinks + 1).setValue(JSON.stringify(mergedFiles));
      sheet.getRange(rownum, idx.Status + 1).setValue('Direvisi');
      sheet.getRange(rownum, idx.LastUpdated + 1).setValue(now);
      getSheet_(SHEET_RIWAYAT).appendRow([now, tiket, 'Inputan Direvisi', penulis || noWA, 'Pengirim memperbaiki data inputan.']);
    } else {
      // Buat baris baru
      const row = new Array(HEADERS.length).fill('');
      row[idx.Timestamp]   = now;
      row[idx.TicketID]    = tiket;
      row[idx.Kategori]    = p.kategori;
      row[idx.Provinsi]    = provinsi;
      row[idx.Kabupaten]   = kabupaten;
      row[idx.Instansi]    = org;
      row[idx.NamaPenulis] = penulis;
      row[idx.NoWA]        = noWA;
      row[idx.FileLinks]   = JSON.stringify(mergedFiles);
      row[idx.Status]      = 'Terkirim';
      row[idx.LastUpdated] = now;
      sheet.appendRow(row);
    }

    return { tiket: tiket, waktu: now.toISOString(), isRevisi: !!rownum };
  } finally {
    lock.releaseLock();
  }
}

/** Cari status berdasarkan nomor tiket (tepat) atau nomor WhatsApp. */
function cekStatus(query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const qDigit = q.replace(/\D/g, '');
  const qSearch = qDigit.replace(/^0+/, ''); // Atasi data lama dari Form: awalan 0 hilang di Sheet
  const idx = colIndex_();
  return dataRows_().filter(r => {
    const tid = String(r[idx.TicketID] || '').toLowerCase();
    if (tid === q.toLowerCase()) return true;
    const wa = String(r[idx.NoWA] || '').replace(/\D/g, '');
    return qSearch.length >= 6 && wa && (wa.endsWith(qDigit) || wa.endsWith(qSearch));
  }).map(r => ({
    tiket: r[idx.TicketID], kategori: r[idx.Kategori],
    provinsi: r[idx.Provinsi], kabupaten: r[idx.Kabupaten],
    instansi: r[idx.Instansi], namaPenulis: r[idx.NamaPenulis],
    status: r[idx.Status] || 'Terkirim', eksekutor: r[idx.Eksekutor],
    keterangan: r[idx.Keterangan]
  })).reverse(); // terbaru dulu
}

/** Mengambil detail asli untuk pre-fill form revisi. */
function getDetailRevisi(payload) {
  const tiket = payload.tiket;
  const queryWa = payload.wa;
  const t = String(tiket || '').trim().toLowerCase();
  const waQ = String(queryWa || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!t) throw new Error('Debug: Tiket kosong. payload=' + JSON.stringify(payload));
  if (!queryWa) throw new Error('Debug: queryWa kosong atau undefined. payload=' + JSON.stringify(payload));
  if (!waQ) throw new Error('Debug: waQ kosong (tidak ada angka). payload=' + JSON.stringify(payload));
  
  const idx = colIndex_();
  const row = dataRows_().find(r => {
    const tid = String(r[idx.TicketID] || '').toLowerCase();
    const wa = String(r[idx.NoWA] || '').replace(/\D/g, '');
    return tid === t && (wa.endsWith(waQ) || wa.endsWith(waQ.replace(/^0+/, '')));
  });
  if (!row) throw new Error('Debug: Tiket tidak ditemukan atau WA salah (t=' + t + ', waQ=' + waQ + ')');
  if (row[idx.Status] !== 'Revisi') throw new Error('Debug: Tiket ini tidak sedang dalam status Revisi (status=' + row[idx.Status] + ')');
  
  let linkVideo = '';
  try {
    const files = JSON.parse(row[idx.FileLinks] || '[]');
    const lv = files.find(f => f.slot === 'linkVideo');
    if (lv) linkVideo = lv.url;
  } catch(e) {}

  return {
    tiket: row[idx.TicketID], kategori: row[idx.Kategori],
    provinsi: row[idx.Provinsi], kabupaten: row[idx.Kabupaten],
    instansi: row[idx.Instansi], namaPenulis: row[idx.NamaPenulis],
    noWA: row[idx.NoWA], linkVideo: linkVideo
  };
}

/* ===================== HELPER (internal) ===================== */

function getSpreadsheet_() {
  const id = cfg_('SPREADSHEET_ID');
  if (!id || id.indexOf('GANTI') === 0) {
    // fallback: bila skrip terikat ke sheet (container-bound)
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('SPREADSHEET_ID belum dikonfigurasi.');
  }
  return SpreadsheetApp.openById(id);
}

function headersFor_(name) {
  if (name === SHEET_ADMINS) return HEADERS_ADMIN;
  if (name === SHEET_RIWAYAT) return HEADERS_RIWAYAT;
  return HEADERS;
}

/** Ambil sheet; buat + isi header bila belum ada (pola self-heal Kodomo). */
function getSheet_(name) {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    const H = headersFor_(name);
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, H.length).setValues([H]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function setupSheets_() {
  getSheet_(SHEET_SUBMISSIONS);
  getSheet_(SHEET_RIWAYAT);
  const admins = getSheet_(SHEET_ADMINS);
  // seed satu super admin bila kosong (ganti kodenya lewat CONFIG/Script Properties)
  if (admins.getLastRow() < 2) {
    admins.appendRow(['Super Admin', cfg_('ADMIN_SUPER_CODE'), 'super']);
  }
}

/** Peta nama kolom → indeks (0-based), mengikuti HEADERS. */
function colIndex_() {
  const m = {};
  HEADERS.forEach((h, i) => m[h] = i);
  return m;
}

/** Semua baris data (tanpa header). */
function dataRows_() {
  const sh = getSheet_(SHEET_SUBMISSIONS);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
}

/** Nomor urut berikutnya untuk prefiks tiket tertentu (dipanggil dalam lock). */
function nextSeq_(sheet, prefix) {
  const last = sheet.getLastRow();
  if (last < 2) return 1;
  const idx = colIndex_();
  const col = sheet.getRange(2, idx.TicketID + 1, last - 1, 1).getValues();
  let n = 0;
  col.forEach(row => { if (String(row[0] || '').indexOf(prefix) === 0) n++; });
  return n + 1;
}

/**
 * Simpan berkas base64 ke Drive terstruktur. Kembalikan [{slot,name,url}].
 * ponytail: unggah via base64 lewat google.script.run — batas payload ~50MB.
 *           Untuk berkas besar/banyak, ganti ke Drive Picker/resumable nanti.
 */
function simpanBerkas_(files, kategori, ym, tiket) {
  const out = [];
  if (!files || !files.length) return out;
  const induk = getFolderInduk_();
  const fKat = subFolder_(induk, kategori);
  const fBln = subFolder_(fKat, ym);
  const fTkt = subFolder_(fBln, tiket);
  files.forEach(f => {
    try {
      const blob = Utilities.newBlob(Utilities.base64Decode(f.data), f.mime || 'application/octet-stream', f.name || 'berkas');
      const file = fTkt.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      out.push({ slot: f.slot, name: f.name, url: file.getUrl() });
    } catch (e) {
      out.push({ slot: f.slot, name: f.name, url: '', error: String(e) });
    }
  });
  return out;
}

function getFolderInduk_() {
  const id = cfg_('DRIVE_FOLDER_ID');
  if (!id || id.indexOf('GANTI') === 0) {
    // fallback: folder di My Drive
    const it = DriveApp.getFoldersByName('Portal Kehumasan - Unggahan');
    return it.hasNext() ? it.next() : DriveApp.createFolder('Portal Kehumasan - Unggahan');
  }
  return DriveApp.getFolderById(id);
}

function subFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function normalizeWA_(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (!/^(0|62)\d{8,13}$/.test(d)) return '';
  return d.indexOf('62') === 0 ? '0' + d.slice(2) : d;
}

function pad2_(n) { return String(n).padStart(2, '0'); }
function pad4_(n) { return String(n).padStart(4, '0'); }

/* ===================== API ADMIN (dashboard humas) ===================== */
// TRUST BOUNDARY: setiap fungsi admin* WAJIB memanggil cekAdmin_ dulu.
// Web app anonymous → tak ada identitas Google; auth = kode akses di sheet Admins.
// Kode diverifikasi ULANG di server tiap aksi (stateless) — jangan percaya klien.

/** Verifikasi kode → {nama, role} atau null. Tak pernah mengembalikan kode. */
function cekAdmin_(kode) {
  const k = String(kode || '').trim();
  if (!k) return null;
  const sh = getSheet_(SHEET_ADMINS);
  const last = sh.getLastRow();
  if (last < 2) return null;
  const vals = sh.getRange(2, 1, last - 1, HEADERS_ADMIN.length).getValues();
  for (const r of vals) {
    if (String(r[1]).trim() === k) return { nama: String(r[0]), role: String(r[2] || 'admin') };
  }
  return null;
}

/** Login: lempar error bila kode salah, jika benar kembalikan profil. */
function adminLogin(kode) {
  const me = cekAdmin_(kode);
  if (!me) throw new Error('Kode akses salah.');
  return me;
}

/** Muat seluruh data dashboard (list + eksekutor + statistik). */
function adminData(kode) {
  const me = cekAdmin_(kode);
  if (!me) throw new Error('Akses ditolak. Kode salah.');
  const idx = colIndex_();
  const riw = riwayatMap_();
  const list = dataRows_().map(r => {
    let files = [];
    try { files = JSON.parse(r[idx.FileLinks] || '[]'); } catch (e) { files = []; }
    const tiket = r[idx.TicketID];
    return {
      tiket: tiket, kategori: r[idx.Kategori], provinsi: r[idx.Provinsi], kabupaten: r[idx.Kabupaten],
      instansi: r[idx.Instansi], namaPenulis: r[idx.NamaPenulis], noWA: r[idx.NoWA],
      files: files, status: r[idx.Status] || 'Terkirim', eksekutor: r[idx.Eksekutor],
      keterangan: r[idx.Keterangan], dibuat: toIso_(r[idx.Timestamp]),
      diperbarui: toIso_(r[idx.LastUpdated]), riwayat: riw[tiket] || []
    };
  }).reverse();
  return { roleAnda: me, eksekutors: daftarEksekutor_(), stats: hitungStats_(list), rows: list };
}

/**
 * Aksi admin atas satu tiket. payload: { tiket, aksi, catatan?, eksekutor? }
 * aksi: 'setujui' | 'tolak'(catatan wajib) | 'review' | 'assign'(eksekutor wajib)
 * Mengembalikan adminData terbaru (pola "kembalikan state penuh").
 */
function adminAksi(kode, payload) {
  const me = cekAdmin_(kode);
  if (!me) throw new Error('Akses ditolak. Kode salah.');
  const p = payload || {};
  const tiket = String(p.tiket || '').trim();
  const aksi = String(p.aksi || '').trim();
  const catatan = String(p.catatan || '').trim();
  const eksekutor = String(p.eksekutor || '').trim();

  let status = '';
  if (aksi === 'setujui') status = 'Disetujui';
  else if (aksi === 'tolak') { if (!catatan) throw new Error('Alasan penolakan wajib diisi.'); status = 'Ditolak'; }
  else if (aksi === 'revisi') { if (!catatan) throw new Error('Catatan revisi wajib diisi.'); status = 'Revisi'; }
  else if (aksi === 'review') status = 'Direview';
  else if (aksi === 'assign') { if (!eksekutor) throw new Error('Pilih eksekutor.'); }
  else throw new Error('Aksi tidak dikenal.');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = getSheet_(SHEET_SUBMISSIONS);
    const idx = colIndex_();
    const rownum = findRow_(sh, tiket);
    if (!rownum) throw new Error('Tiket tidak ditemukan.');
    const now = new Date();
    if (status) sh.getRange(rownum, idx.Status + 1).setValue(status);
    if (aksi === 'tolak' || aksi === 'revisi') sh.getRange(rownum, idx.Keterangan + 1).setValue(catatan);
    if (eksekutor) sh.getRange(rownum, idx.Eksekutor + 1).setValue(eksekutor);
    sh.getRange(rownum, idx.LastUpdated + 1).setValue(now);
    const label = { setujui: 'Disetujui', tolak: 'Ditolak', revisi: 'Minta Revisi', review: 'Ditandai direview', assign: 'Ditugaskan' }[aksi];
    const ket = (aksi === 'tolak' || aksi === 'revisi') ? catatan : (aksi === 'assign' ? ('Ditugaskan ke ' + eksekutor) : catatan);
    getSheet_(SHEET_RIWAYAT).appendRow([now, tiket, label, me.nama, ket]);
    return adminData(kode);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Kelola admin/eksekutor (KHUSUS super admin). payload.sub:
 *  'list'  → daftar admin (tanpa kode)
 *  'tambah'→ {nama, kode, role}
 *  'hapus' → {nama}
 *  'ubahRole' → {nama, role}
 * Mengembalikan daftar admin terbaru [{nama, role}] — kode TIDAK pernah dikirim balik.
 */
function adminKelola(kode, payload) {
  const me = cekAdmin_(kode);
  if (!me) throw new Error('Akses ditolak. Kode salah.');
  if (me.role !== 'super') throw new Error('Hanya super admin yang boleh mengelola admin.');
  const p = payload || {};
  const sub = String(p.sub || 'list');
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = getSheet_(SHEET_ADMINS);
    if (sub === 'tambah') {
      const nama = String(p.nama || '').trim();
      const kd = String(p.kode || '').trim();
      const role = (p.role === 'super') ? 'super' : 'admin';
      if (!nama || !kd) throw new Error('Nama dan kode wajib diisi.');
      if (kd.length < 4) throw new Error('Kode minimal 4 karakter.');
      const rows = adminRows_();
      if (rows.some(r => r.nama.toLowerCase() === nama.toLowerCase())) throw new Error('Nama admin sudah ada.');
      if (rows.some(r => r.kode === kd)) throw new Error('Kode sudah dipakai admin lain.');
      sh.appendRow([nama, kd, role]);
    } else if (sub === 'hapus') {
      const nama = String(p.nama || '').trim();
      const rows = adminRows_();
      const t = rows.find(r => r.nama === nama);
      if (!t) throw new Error('Admin tidak ditemukan.');
      if (t.nama === me.nama) throw new Error('Tidak bisa menghapus akun sendiri.');
      if (t.role === 'super' && rows.filter(r => r.role === 'super').length <= 1) throw new Error('Minimal harus ada satu super admin.');
      const rn = findAdminRow_(nama);
      if (rn) sh.deleteRow(rn);
    } else if (sub === 'ubahRole') {
      const nama = String(p.nama || '').trim();
      const role = (p.role === 'super') ? 'super' : 'admin';
      const rows = adminRows_();
      const t = rows.find(r => r.nama === nama);
      if (!t) throw new Error('Admin tidak ditemukan.');
      if (t.role === 'super' && role !== 'super' && rows.filter(r => r.role === 'super').length <= 1)
        throw new Error('Minimal harus ada satu super admin.');
      const rn = findAdminRow_(nama);
      if (rn) sh.getRange(rn, 3).setValue(role);
    }
    return adminRows_().map(r => ({ nama: r.nama, role: r.role })); // tanpa kode
  } finally {
    lock.releaseLock();
  }
}

/* ---- helper admin ---- */
function adminRows_() {
  const sh = getSheet_(SHEET_ADMINS);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEADERS_ADMIN.length).getValues()
    .map(r => ({ nama: String(r[0]), kode: String(r[1]), role: String(r[2] || 'admin') }));
}
function findAdminRow_(nama) {
  const sh = getSheet_(SHEET_ADMINS);
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const col = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < col.length; i++) if (String(col[i][0]) === nama) return i + 2;
  return 0;
}
function findRow_(sheet, tiket) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const idx = colIndex_();
  const col = sheet.getRange(2, idx.TicketID + 1, last - 1, 1).getValues();
  for (let i = 0; i < col.length; i++) if (String(col[i][0]) === tiket) return i + 2;
  return 0;
}

function riwayatMap_() {
  const sh = getSheet_(SHEET_RIWAYAT);
  const last = sh.getLastRow();
  const map = {};
  if (last < 2) return map;
  sh.getRange(2, 1, last - 1, HEADERS_RIWAYAT.length).getValues().forEach(r => {
    const t = String(r[1]); if (!t) return;
    (map[t] = map[t] || []).push({ waktu: toIso_(r[0]), aksi: r[2], oleh: r[3], catatan: r[4] });
  });
  return map;
}

function daftarEksekutor_() {
  return adminRows_().map(r => r.nama).filter(Boolean);
}

function hitungStats_(list) {
  const s = { total: list.length, terkirim: 0, direview: 0, disetujui: 0, ditolak: 0,
              penerimaan: 0, avgProsesJam: 0, perProvinsi: [], alasanTolak: [] };
  const prov = {}, alasan = {};
  let diputus = 0, totalJam = 0, nProses = 0;
  list.forEach(r => {
    const st = String(r.status || '').toLowerCase();
    const disetujui = /setuju|selesai|terbit|complete/.test(st);
    const ditolak = /tolak|reject/.test(st);
    if (disetujui) s.disetujui++; else if (ditolak) s.ditolak++;
    else if (/review|proses|progress/.test(st)) s.direview++; else s.terkirim++;
    const P = r.provinsi || '—';
    prov[P] = prov[P] || { total: 0, disetujui: 0 };
    prov[P].total++; if (disetujui) prov[P].disetujui++;
    if (disetujui || ditolak) {
      diputus++;
      const t0 = Date.parse(r.dibuat), t1 = Date.parse(r.diperbarui);
      if (t0 && t1 && t1 >= t0) { totalJam += (t1 - t0) / 3.6e6; nProses++; }
    }
    if (ditolak && r.keterangan) { const k = String(r.keterangan).trim(); alasan[k] = (alasan[k] || 0) + 1; }
  });
  s.penerimaan = diputus ? Math.round((s.disetujui / diputus) * 100) : 0;
  s.avgProsesJam = nProses ? Math.round(totalJam / nProses) : 0;
  s.perProvinsi = Object.keys(prov).map(p => ({
    prov: p, total: prov[p].total, disetujui: prov[p].disetujui,
    rate: prov[p].total ? Math.round((prov[p].disetujui / prov[p].total) * 100) : 0
  })).sort((a, b) => b.total - a.total);
  s.alasanTolak = Object.keys(alasan).map(k => ({ teks: k, jumlah: alasan[k] }))
    .sort((a, b) => b.jumlah - a.jumlah).slice(0, 6);
  return s;
}

function toIso_(v) {
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v || '') : d.toISOString();
}

/* ===================== MIGRASI DATA LAMA (jalankan SEKALI dari editor) ===================== */
/**
 * Impor data historis dari spreadsheet "Respon Portal Komunikasi Kehumasan" (9 tab
 * respons Google Form lama) ke sheet Submissions database baru.
 * - Baca-saja terhadap sumber; aman dijalankan pemilik akses view.
 * - Idempotent: dijaga Script Property MIGRASI_DONE (hapus properti itu untuk mengulang).
 * - Header tiap tab lama tidak seragam → dicocokkan per kata kunci.
 * Jalankan `migrasiDariRespon` dari editor Apps Script, lihat Log hasilnya.
 */
function migrasiDariRespon() {
  const SUMBER_ID = '1oguyXhVZdAZGXWop_wsXvshmpXUlUiig6NsRCW4tp94';
  const MAP = {
    'Publikasi Berita Daerah': 'berita-daerah',
    'Berita PTKHN': 'berita-ptkh',
    'Berita Widyalaya': 'berita-widyalaya',
    'Berita Pasraman': 'berita-pasraman',
    'Artikel kisah inspiratif': 'artikel-inspiratif',
    'Wisata Religi': 'wisata-religi',
    'Naskah Mimbar Hindu': 'naskah-mimbar',
    'Video Mimbar Hindu': 'video-mimbar',
    'Bahan Konten Medsos': 'konten-medsos'
  };
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('MIGRASI_DONE'))
    throw new Error('Migrasi sudah pernah dijalankan. Hapus Script Property MIGRASI_DONE untuk mengulang.');

  const src = SpreadsheetApp.openById(SUMBER_ID);
  const entri = [];
  const perTab = {};

  Object.keys(MAP).forEach(function (nama) {
    const sh = src.getSheetByName(nama);
    if (!sh) { perTab[nama] = 'tab tidak ditemukan'; return; }
    const vals = sh.getDataRange().getValues();
    if (vals.length < 2) { perTab[nama] = 0; return; }
    const head = vals[0].map(function (h) { return String(h).toLowerCase(); });
    const cari = function () { const keys = arguments;
      for (var i = 0; i < head.length; i++)
        for (var k = 0; k < keys.length; k++) if (head[i].indexOf(keys[k]) >= 0) return i;
      return -1; };
    const iT = cari('timestamp', 'waktu');
    const iProv = cari('provinsi');
    const iKab = cari('kabupaten', 'kota');
    const iIns = cari('instansi', 'widyalaya', 'pasraman', 'satuan kerja', 'lembaga');
    const iWA = cari('whatsapp', 'no wa', 'no. wa', 'hp', 'telepon');
    const iStatus = cari('status');
    const iEks = cari('eksekutor');
    const iKet = cari('keterangan');
    var iNama = -1;
    for (var i = 0; i < head.length; i++) {
      if ((head[i].indexOf('penulis') >= 0) ||
          (head[i].indexOf('nama') >= 0 && head[i].indexOf('widyalaya') < 0 &&
           head[i].indexOf('pasraman') < 0 && head[i].indexOf('instansi') < 0)) { iNama = i; break; }
    }
    // kolom berkas: header berbau bahan/naskah/foto/video/link/dokumentasi/notulen
    const kolFile = [];
    head.forEach(function (h, ix) {
      if (/notulen|naskah|foto|bahan|video|link|dokumentasi/.test(h)) kolFile.push(ix);
    });

    var n = 0;
    for (var r = 1; r < vals.length; r++) {
      const row = vals[r];
      const ins = iIns >= 0 ? String(row[iIns] || '').trim() : '';
      const prov = iProv >= 0 ? String(row[iProv] || '').trim() : '';
      if (!ins && !prov) continue; // baris kosong
      const ts = (iT >= 0 && row[iT] instanceof Date) ? row[iT] : new Date(row[iT] || Date.now());
      const files = [];
      kolFile.forEach(function (ix) {
        const m = String(row[ix] || '').match(/https?:\/\/\S+/g);
        if (m) m.forEach(function (u) { files.push({ slot: String(head[ix]).slice(0, 24), name: '', url: u }); });
      });
      const stRaw = iStatus >= 0 ? String(row[iStatus] || '').toUpperCase() : '';
      const status = /COMPLET|SETUJU|SELESAI/.test(stRaw) ? 'Disetujui'
        : /REJECT|TOLAK/.test(stRaw) ? 'Ditolak'
        : /PROGRESS|REVIEW|PROSES/.test(stRaw) ? 'Direview' : 'Terkirim';
      entri.push({
        ts: ts, kategori: MAP[nama],
        provinsi: rapikanProv_(prov), kabupaten: iKab >= 0 ? rapikanKata_(String(row[iKab] || '')) : '',
        instansi: ins, namaPenulis: iNama >= 0 ? String(row[iNama] || '').trim() : '',
        noWA: iWA >= 0 ? normalizeWA_(row[iWA]) || String(row[iWA] || '').trim() : '',
        files: files, status: status,
        eksekutor: iEks >= 0 ? String(row[iEks] || '').trim() : '',
        keterangan: iKet >= 0 ? String(row[iKet] || '').trim() : ''
      });
      n++;
    }
    perTab[nama] = n;
  });

  // urutkan kronologis, beri tiket per bulan, tulis sekaligus
  entri.sort(function (a, b) { return a.ts - b.ts; });
  const idx = colIndex_();
  const seq = {};
  const rows = entri.map(function (e) {
    const ym = e.ts.getFullYear() + pad2_(e.ts.getMonth() + 1);
    seq[ym] = (seq[ym] || 0) + 1;
    const row = new Array(HEADERS.length).fill('');
    row[idx.Timestamp] = e.ts;
    row[idx.TicketID] = 'PKH-' + ym + '-' + pad4_(seq[ym]);
    row[idx.Kategori] = e.kategori;
    row[idx.Provinsi] = e.provinsi;
    row[idx.Kabupaten] = e.kabupaten;
    row[idx.Instansi] = e.instansi;
    row[idx.NamaPenulis] = e.namaPenulis;
    row[idx.NoWA] = e.noWA;
    row[idx.FileLinks] = JSON.stringify(e.files);
    row[idx.Status] = e.status;
    row[idx.Eksekutor] = e.eksekutor;
    row[idx.Keterangan] = e.keterangan;
    row[idx.LastUpdated] = e.ts;
    return row;
  });
  if (rows.length) {
    const dst = getSheet_(SHEET_SUBMISSIONS);
    dst.getRange(dst.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
  }
  props.setProperty('MIGRASI_DONE', '1');
  Logger.log('Migrasi selesai: ' + rows.length + ' baris. Rincian: ' + JSON.stringify(perTab));
  return { total: rows.length, perTab: perTab };
}

/** Normalisasi teks wilayah data lama ("bali"/"BALI"/"Kalteng" dsb.). */
function rapikanKata_(s) {
  s = String(s || '').trim();
  return s.replace(/\S+/g, function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); });
}
function rapikanProv_(s) {
  const t = rapikanKata_(s);
  const alias = {
    'Kalteng': 'Kalimantan Tengah', 'Kaltim': 'Kalimantan Timur', 'Kalsel': 'Kalimantan Selatan',
    'Kalbar': 'Kalimantan Barat', 'Sulteng': 'Sulawesi Tengah', 'Sulsel': 'Sulawesi Selatan',
    'Sulut': 'Sulawesi Utara', 'Sultra': 'Sulawesi Tenggara', 'Ntb': 'Nusa Tenggara Barat',
    'Ntt': 'Nusa Tenggara Timur', 'Diy': 'DI Yogyakarta', 'Daerah Istimewa Yogyakarta': 'DI Yogyakarta',
    'Daerah Istimewa Yogyak': 'DI Yogyakarta', 'Dki': 'DKI Jakarta', 'Jateng': 'Jawa Tengah',
    'Jatim': 'Jawa Timur', 'Jabar': 'Jawa Barat', 'Sumut': 'Sumatera Utara', 'Sumsel': 'Sumatera Selatan',
    'Sumbar': 'Sumatera Barat', 'Nusa Tenggara Tim': 'Nusa Tenggara Timur', 'Nusa Tenggara Timu': 'Nusa Tenggara Timur'
  };
  return alias[t] || t;
}

/* ===================== UJI MANUAL (jalankan dari editor) ===================== */
// Ganti CONFIG dulu, lalu jalankan uji_() dari editor Apps Script untuk memastikan
// submit + cek status bekerja tanpa lewat UI.
function uji_() {
  const r = submitPermohonan({
    kategori: 'berita-daerah', provinsi: 'Bali', kabupaten: 'Klungkung',
    instansi: 'Kemenag Kab. Klungkung (UJI)', noWA: '081337214493', _files: []
  });
  Logger.log('Tiket: ' + r.tiket);
  Logger.log('Cek status: ' + JSON.stringify(cekStatus(r.tiket)));
  Logger.log('Stats: ' + JSON.stringify(getStats()));
  // admin: login super + setujui tiket uji
  const me = adminLogin(cfg_('ADMIN_SUPER_CODE'));
  Logger.log('Admin: ' + JSON.stringify(me));
  const d = adminAksi(cfg_('ADMIN_SUPER_CODE'), { tiket: r.tiket, aksi: 'setujui' });
  Logger.log('Setelah setujui — stats: ' + JSON.stringify(d.stats));
}
// trigger push
