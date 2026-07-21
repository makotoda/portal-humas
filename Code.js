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
  SPREADSHEET_ID: 'GANTI_DENGAN_ID_SPREADSHEET', // ID Google Sheet database
  DRIVE_FOLDER_ID: 'GANTI_DENGAN_ID_FOLDER_DRIVE', // folder Drive induk untuk unggahan
  ADMIN_EMAILS: 'makotoda999@gmail.com'          // dipakai modul admin (sesi berikutnya)
};
function cfg_(k) {
  const p = PropertiesService.getScriptProperties().getProperty(k);
  return (p && p.trim()) ? p.trim() : CONFIG_DEFAULT[k];
}

const SHEET_SUBMISSIONS = 'Submissions';
const HEADERS = ['Timestamp','TicketID','Kategori','Provinsi','Kabupaten','Instansi',
                 'NamaPenulis','NoWA','FileLinks','Status','Eksekutor','Keterangan','LastUpdated'];

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
function doGet() {
  setupSheets_(); // self-heal: pastikan sheet & header ada
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Portal Komunikasi Kehumasan — Ditjen Bimas Hindu')
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
    const ym = now.getFullYear() + pad2_(now.getMonth() + 1);
    const tiket = 'PKH-' + ym + '-' + pad4_(nextSeq_(sheet, 'PKH-' + ym + '-'));

    // Simpan berkas ke Drive (folder: induk / Kategori / YYYY-MM / tiket)
    const links = simpanBerkas_(p._files || [], p.kategori, ym, tiket);
    if (spec.video && p.linkVideo) links.push({ slot: 'linkVideo', url: String(p.linkVideo).trim() });

    const idx = colIndex_();
    const row = new Array(HEADERS.length).fill('');
    row[idx.Timestamp]   = now;
    row[idx.TicketID]    = tiket;
    row[idx.Kategori]    = p.kategori;
    row[idx.Provinsi]    = provinsi;
    row[idx.Kabupaten]   = kabupaten;
    row[idx.Instansi]    = org;
    row[idx.NamaPenulis] = penulis;
    row[idx.NoWA]        = noWA;
    row[idx.FileLinks]   = JSON.stringify(links);
    row[idx.Status]      = 'Terkirim';
    row[idx.LastUpdated] = now;
    sheet.appendRow(row);

    return { tiket: tiket, waktu: now.toISOString() };
  } finally {
    lock.releaseLock();
  }
}

/** Cari status berdasarkan nomor tiket (tepat) atau nomor WhatsApp. */
function cekStatus(query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const qDigit = q.replace(/\D/g, '');
  const idx = colIndex_();
  return dataRows_().filter(r => {
    const tid = String(r[idx.TicketID] || '').toLowerCase();
    if (tid === q.toLowerCase()) return true;
    const wa = String(r[idx.NoWA] || '').replace(/\D/g, '');
    return qDigit.length >= 6 && wa && wa.endsWith(qDigit);
  }).map(r => ({
    tiket: r[idx.TicketID], kategori: r[idx.Kategori],
    provinsi: r[idx.Provinsi], kabupaten: r[idx.Kabupaten],
    instansi: r[idx.Instansi], namaPenulis: r[idx.NamaPenulis],
    status: r[idx.Status] || 'Terkirim', eksekutor: r[idx.Eksekutor],
    keterangan: r[idx.Keterangan]
  })).reverse(); // terbaru dulu
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

/** Ambil sheet; buat + isi header bila belum ada (pola self-heal Kodomo). */
function getSheet_(name) {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function setupSheets_() { getSheet_(SHEET_SUBMISSIONS); }

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
}
