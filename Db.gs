/**
 * Db.gs : Google Sheet เป็นฐานข้อมูล + แคชแบบแบ่งก้อน (CacheService 100KB/คีย์)
 * - 1 ชีท = 1 ตาราง · แถว 1 = ชื่อคอลัมน์ · คอลัมน์แรก = key · ทุกช่องเป็นข้อความ (format @)
 * - อ่านทั้งชีทครั้งเดียว แล้วเก็บแคช 6 ชม. · เขียนแบบ write-through ภายใต้ withLock_
 * - ค่าที่ขึ้นต้นด้วย = + - @ เติม ~ กัน Sheet แปลงเป็นสูตร
 */
var _TBL = {};
var LOG_TABLES = { AuditLog: 1, MailLog: 1 };   // ตารางบันทึก: เขียนต่อท้ายอย่างเดียว ไม่แคช
var CACHE_CHUNK = 25000;                          // ตัวอักษรต่อก้อน (ไทย 3 byte/ตัว ≈ 75KB)

function db_() {
  var id = PropertiesService.getScriptProperties().getProperty('DB_ID');
  if (!id) throw new Error('ระบบยังไม่ได้ติดตั้ง (ให้ผู้ดูแล Run setupSystem ใน Apps Script)');
  if (!_TBL.__ss) _TBL.__ss = SpreadsheetApp.openById(id);
  return _TBL.__ss;
}

function cachePutBig_(key, str) {
  var cache = CacheService.getScriptCache(), parts = {}, n = Math.ceil(str.length / CACHE_CHUNK) || 1;
  if (n > 90) return false;   // ใหญ่เกิน ไม่แคช
  for (var i = 0; i < n; i++) parts[key + ':' + i] = str.substr(i * CACHE_CHUNK, CACHE_CHUNK);
  parts[key + ':n'] = String(n);
  try { cache.putAll(parts, 21600); return true; } catch (e) { cache.remove(key + ':n'); return false; }
}
function cacheGetBig_(key) {
  var cache = CacheService.getScriptCache(), n = +cache.get(key + ':n');
  if (!n) return null;
  var keys = []; for (var i = 0; i < n; i++) keys.push(key + ':' + i);
  var got = cache.getAll(keys), out = '';
  for (var j = 0; j < n; j++) { if (got[keys[j]] == null) return null; out += got[keys[j]]; }
  return out;
}
function cacheDelBig_(key) { CacheService.getScriptCache().remove(key + ':n'); }

function cell_(v) { var s = v == null ? '' : String(v); return /^[=+\-@]/.test(s) ? '~' + s : s; }
function uncell_(v) { var s = v == null ? '' : String(v); return s.charAt(0) === '~' && /^[=+\-@]/.test(s.slice(1)) ? s.slice(1) : s; }

function T_(name) {
  if (_TBL[name]) return _TBL[name];
  var head = SCHEMA[name];
  if (!head) throw new Error('ไม่มีตาราง ' + name);
  var ck = 'irb1:' + name, sh = null, rows = null, idx = null;
  function sheet() {
    if (sh) return sh;
    sh = db_().getSheetByName(name);
    if (!sh) throw new Error('ไม่พบชีท ' + name + ' (Run setupSystem อีกครั้ง)');
    return sh;
  }
  function fromSheet() {
    var s = sheet(), last = s.getLastRow();
    var v = last > 1 ? s.getRange(2, 1, last - 1, head.length).getDisplayValues() : [];
    return v.map(function (r) { return r.map(uncell_); });
  }
  function toObj(a) { var o = {}; for (var i = 0; i < head.length; i++) o[head[i]] = a[i] == null ? '' : a[i]; return o; }
  function toArr(o) { return head.map(function (h) { return o[h] == null ? '' : String(o[h]); }); }
  function load(force) {
    var arr = null;
    if (!force && !LOG_TABLES[name]) { var hit = cacheGetBig_(ck); if (hit) try { arr = JSON.parse(hit); } catch (e) { arr = null; } }
    if (!arr) { arr = fromSheet(); if (!LOG_TABLES[name]) cachePutBig_(ck, JSON.stringify(arr)); }
    rows = arr.map(toObj); idx = null;
  }
  function index() {
    if (idx) return idx;
    idx = {}; for (var i = 0; i < rows.length; i++) if (rows[i][head[0]] !== '') idx[rows[i][head[0]]] = i;
    return idx;
  }
  function saveCache() { if (!LOG_TABLES[name]) { if (!cachePutBig_(ck, JSON.stringify(rows.map(toArr)))) cacheDelBig_(ck); } }

  var t = {
    name: name,
    all: function () { if (!rows) load(); return rows; },
    get: function (key) { if (!rows) load(); var i = index()[String(key)]; return i == null ? null : rows[i]; },
    reload: function () { load(true); return t; },
    /** เขียน 1 แถว (เพิ่มหรือแก้) */
    upsert: function (o) { return t.upsertMany([o]); },
    /** เขียนหลายแถว · ถ้าเปลี่ยนมาก (>40 แถว) เขียนทั้งช่วงครั้งเดียว */
    upsertMany: function (list) {
      if (!list || !list.length) return 0;
      if (!rows) load();
      var s = sheet();
      // ตรวจว่าแคชตรงกับชีท (กันคนไปเรียง/ลบแถวในชีทเอง)
      if (rows.length !== Math.max(0, s.getLastRow() - 1)) load(true);
      var changed = {}, appended = [];
      list.forEach(function (o) {
        var key = String(o[head[0]]);
        if (!key) throw new Error('ไม่มีคีย์ของ ' + name);
        var i = index()[key];
        if (i == null) { var obj = toObj(toArr(o)); rows.push(obj); idx[key] = rows.length - 1; appended.push(obj); }
        else { var merged = {}; head.forEach(function (h) { merged[h] = o.hasOwnProperty(h) ? (o[h] == null ? '' : String(o[h])) : rows[i][h]; }); rows[i] = merged; changed[i] = 1; }
      });
      var ci = Object.keys(changed).map(Number);
      if (ci.length > 40) {
        var base = rows.length - appended.length;
        s.getRange(2, 1, base, head.length).setValues(rows.slice(0, base).map(function (r) { return toArr(r).map(cell_); }));
      } else {
        ci.forEach(function (i) {
          var k = s.getRange(i + 2, 1).getDisplayValue();
          if (uncell_(k) !== rows[i][head[0]]) throw new Error('ข้อมูลในชีท ' + name + ' ถูกแก้ไขด้วยมือระหว่างใช้งาน กรุณาลองใหม่');
          s.getRange(i + 2, 1, 1, head.length).setValues([toArr(rows[i]).map(cell_)]);
        });
      }
      if (appended.length) {
        s.getRange(s.getLastRow() + 1, 1, appended.length, head.length).setValues(appended.map(function (r) { return toArr(r).map(cell_); }));
      }
      saveCache();
      return ci.length + appended.length;
    },
    /** ลบแถวตามคีย์ (ใช้กับตารางเล็ก เช่น Heads) */
    remove: function (key) {
      if (!rows) load();
      var i = index()[String(key)];
      if (i == null) return false;
      sheet().deleteRow(i + 2); rows.splice(i, 1); idx = null; saveCache();
      return true;
    },
    /** ลบหลายแถวตามเงื่อนไข (เขียนชีทใหม่ทั้งก้อนครั้งเดียว · ใช้ภายใต้ withLock_) คืนจำนวนที่ลบ */
    removeWhere: function (fn) {
      if (!rows) load();
      var s = sheet(), keep = rows.filter(function (r) { return !fn(r); }), n = rows.length - keep.length;
      if (!n) return 0;
      if (s.getLastRow() > 1) s.deleteRows(2, s.getLastRow() - 1);
      if (keep.length) s.getRange(2, 1, keep.length, head.length).setValues(keep.map(function (r) { return toArr(r).map(cell_); }));
      rows = keep; idx = null; saveCache();
      return n;
    },
    /** ต่อท้าย (ตารางบันทึก) */
    append: function (o) { if (!rows && !LOG_TABLES[name]) load(); sheet().appendRow(toArr(o).map(cell_)); if (rows) rows.push(toObj(toArr(o))); if (!LOG_TABLES[name]) saveCache(); },
    /** ต่อท้ายหลายแถวครั้งเดียว (ประวัติจำนวนมาก เช่น ตั้งไม่ประสงค์รับหลายคน) */
    appendMany: function (list) {
      if (!list || !list.length) return 0;
      if (!rows && !LOG_TABLES[name]) load();
      var s = sheet();
      s.getRange(s.getLastRow() + 1, 1, list.length, head.length).setValues(list.map(function (o) { return toArr(o).map(cell_); }));
      if (rows) list.forEach(function (o) { rows.push(toObj(toArr(o))); });
      if (!LOG_TABLES[name]) saveCache();
      return list.length;
    },
    /** อ่าน N แถวล่าสุด (ตารางบันทึก) */
    tail: function (n) {
      var s = sheet(), last = s.getLastRow();
      if (last < 2) return [];
      var from = Math.max(2, last - n + 1);
      return s.getRange(from, 1, last - from + 1, head.length).getDisplayValues().map(function (r) { return toObj(r.map(uncell_)); }).reverse();
    }
  };
  return (_TBL[name] = t);
}

/** ล็อกทั้งระบบ · เริ่มล็อกแล้วล้างหน่วยความจำตาราง เพื่ออ่านค่าล่าสุดเสมอ */
var _LOCK_DEPTH = 0;
function withLock_(fn) {
  if (_LOCK_DEPTH > 0) return fn();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw new Error('ระบบกำลังบันทึกงานอื่นอยู่ (มีผู้ใช้งานพร้อมกัน หรือมีงานใหญ่ที่ยังทำไม่เสร็จ) กรุณารอ 1–2 นาทีแล้วลองอีกครั้ง');
  _LOCK_DEPTH++;
  var ss = _TBL.__ss; _TBL = {}; if (ss) _TBL.__ss = ss;
  try { return fn(); }
  finally { _LOCK_DEPTH--; SpreadsheetApp.flush(); lock.releaseLock(); }
}

/* ---------------------------------------------------------------- Settings */
var _SET = null;
function settings_() {
  if (_SET) return _SET;
  var o = {}; Object.keys(DEFAULT_SETTINGS).forEach(function (k) { o[k] = DEFAULT_SETTINGS[k]; });
  try { T_('Settings').all().forEach(function (r) { if (r.key) o[r.key] = r.value; }); } catch (e) { }
  return (_SET = o);
}
function setting_(k) { return settings_()[k]; }

/** ตารางบันทึก: หาแถวที่คอลัมน์ col (0 = คอลัมน์แรก) เท่ากับ value · อ่านเฉพาะคอลัมน์นั้นก่อน แล้วอ่านแถวที่ตรง */
function findLogRows_(name, col, value) {
  var sh = db_().getSheetByName(name); if (!sh || sh.getLastRow() < 2) return [];
  var head = SCHEMA[name], n = sh.getLastRow() - 1, keys = sh.getRange(2, col + 1, n, 1).getDisplayValues(), out = [];
  for (var i = 0; i < n; i++) if (uncell_(keys[i][0]) === String(value)) {
    var v = sh.getRange(i + 2, 1, 1, head.length).getDisplayValues()[0], o = {};
    for (var j = 0; j < head.length; j++) o[head[j]] = uncell_(v[j]);
    out.push(o);
  }
  return out;
}
/** ตารางบันทึก: ลบแถวที่คอลัมน์ col เท่ากับ value (ใช้ตอนปลดล็อกรอบ) · ลบจากล่างขึ้นบน เป็นช่วงต่อเนื่อง */
function removeLogRows_(name, col, value) {
  var sh = db_().getSheetByName(name); if (!sh || sh.getLastRow() < 2) return 0;
  var n = sh.getLastRow() - 1, keys = sh.getRange(2, col + 1, n, 1).getDisplayValues(), del = 0, i = n - 1;
  while (i >= 0) {
    if (uncell_(keys[i][0]) !== String(value)) { i--; continue; }
    var end = i; while (i - 1 >= 0 && uncell_(keys[i - 1][0]) === String(value)) i--;
    sh.deleteRows(i + 2, end - i + 1); del += end - i + 1; i--;
  }
  return del;
}
