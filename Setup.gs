/**
 * Setup.gs : ติดตั้งระบบครั้งแรก (Run จากหน้า Apps Script ทีละฟังก์ชัน)
 *  1) setupSystem      สร้าง Google Sheet ฐานข้อมูล + ชีททุกตาราง + ค่าตั้งต้น + บทเรียน 22 SOP + ข้อสอบ 24 ข้อ (เฉลยสุ่ม)
 *  2) createFirstAdmin สร้างบัญชีผู้ดูแลคนแรกจาก Script Property ADMIN_EMAIL → ดูลิงก์ตั้งรหัสผ่านใน "บันทึกการดำเนินการ"
 *  3) installTriggers  ตั้งงานกลางคืน 02:00 (ล้างข้อสอบค้าง + ส่งเตือนถ้าเปิด)
 *  4) fetchVideoDurations (ไม่บังคับ) อ่านความยาววิดีโอจาก Google Drive
 * รันซ้ำได้ไม่เสียหาย: ไม่ลบข้อมูลเดิม เติมเฉพาะชีท/คอลัมน์/แถวที่ยังไม่มี
 */
function setupSystem() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('DB_ID'), ss, log = [];
  if (id) { ss = SpreadsheetApp.openById(id); log.push('ใช้ฐานข้อมูลเดิม ' + ss.getUrl()); }
  else { ss = SpreadsheetApp.create('QSMH-IRB-Training_ฐานข้อมูล (ห้ามแชร์)'); p.setProperty('DB_ID', ss.getId()); log.push('สร้างฐานข้อมูลใหม่ ' + ss.getUrl()); }
  secretProp_('TOKEN_SECRET'); secretProp_('PW_PEPPER');
  Object.keys(SCHEMA).forEach(function (name) {
    var head = SCHEMA[name], sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); log.push('+ ชีท ' + name); }
    var cur = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0] : [];
    if (!cur.length || !cur[0]) { sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#e8edf5'); sh.setFrozenRows(1); }
    else {   // เพิ่มคอลัมน์ใหม่ท้ายตาราง (ไม่ลบ/ไม่เรียงใหม่)
      var miss = head.filter(function (h) { return cur.indexOf(h) < 0; });
      if (miss.length) { sh.getRange(1, cur.length + 1, 1, miss.length).setValues([miss]).setFontWeight('bold'); log.push('+ คอลัมน์ ' + name + ': ' + miss.join(', ')); }
    }
    try { sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@'); } catch (e) { }
  });
  var first = ss.getSheetByName('Sheet1') || ss.getSheetByName('แผ่น1') || ss.getSheetByName('ชีต1');
  if (first && ss.getSheets().length > 1) ss.deleteSheet(first);
  _TBL = {}; _SET = null;
  withLock_(function () {
    var st = T_('Settings'), have = {}; st.all().forEach(function (r) { have[r.key] = 1; });
    var add = SETTING_META.filter(function (m) { return !have[m.k]; }).map(function (m) { return { key: m.k, value: m.d, updated_at: nowIso_(), updated_by: 'setup' }; });
    if (add.length) { st.upsertMany(add); log.push('+ ค่าตั้งต้น ' + add.length + ' รายการ'); }
    var mt = T_('Modules');
    if (!mt.all().length) {
      mt.upsertMany(SEED_MODULES.map(function (m, i) { return { module_id: 'SOP' + m[0], sort: String(i + 1), code: m[1], title: m[2], video_type: 'DRIVE', video_ref: m[3], duration_sec: '', required: 'true', active: 'true', doc_url: '', note: '', updated_at: nowIso_() }; }));
      log.push('+ บทเรียน ' + SEED_MODULES.length + ' บท (วิดีโอ Google Drive · เปลี่ยนเป็น YouTube ได้ในหน้า "บทเรียน")');
    }
    var qt = T_('Questions');
    if (!qt.all().length) {
      qt.upsertMany(SEED_QUESTIONS.map(function (q, i) { return { q_id: 'Q' + ('00' + (i + 1)).slice(-3), sort: String(i + 1), sop_ref: q[0], text: q[1], options: JSON.stringify(q[2]), answer: String(Math.floor(Math.random() * q[2].length)), answer_verified: 'false', active: 'true', explain: '', updated_at: nowIso_(), updated_by: 'setup (เฉลยสุ่ม)' }; }));
      log.push('+ ข้อสอบ ' + SEED_QUESTIONS.length + ' ข้อ — ⚠ เฉลยเป็นค่าสุ่ม ผู้ดูแลต้องตั้งเฉลยจริงในหน้า "คลังข้อสอบ"');
    }
  });
  certFolder_();
  try { fetchVideoDurations(); log.push('อ่านความยาววิดีโอจาก Drive แล้ว'); } catch (e) { log.push('! อ่านความยาววิดีโอไม่ได้ (' + e.message + ') ใส่เองในหน้า "บทเรียน"'); }
  log.push('ขั้นถัดไป: ตั้ง Script Property ADMIN_EMAIL แล้ว Run createFirstAdmin');
  Logger.log(log.join('\n'));
  return log;
}

/** สร้าง/ยกระดับผู้ดูแลคนแรก (Script Property ADMIN_EMAIL) และพิมพ์ลิงก์ตั้งรหัสผ่านใน Logger */
function createFirstAdmin() {
  var email = str_(prop_('ADMIN_EMAIL')).toLowerCase();
  if (!emailOk_(email)) throw new Error('ตั้ง Script Property ADMIN_EMAIL เป็นอีเมลผู้ดูแลก่อน');
  var link = withLock_(function () {
    var u = findUserByEmail_(email), t = T_('Users');
    if (!u) { u = { user_id: nextUserId_(), email: email, status: 'PENDING', roles: 'ADMIN,LEARNER', group: 'STAFF', first_name: 'ผู้ดูแลระบบ', last_name: '', token_ver: '0', sort: '999', created_at: nowIso_(), updated_at: nowIso_() }; t.upsert(u); }
    else { var r = rolesOf_(u); if (r.indexOf('ADMIN') < 0) r.unshift('ADMIN'); if (r.indexOf('LEARNER') < 0) r.push('LEARNER'); t.upsert({ user_id: u.user_id, roles: r.join(',') }); u = t.get(u.user_id); }
    audit_('setup', 'FIRST_ADMIN', u.user_id, email);
    return makeSetLink_(u, u.pw_hash ? 'RESET' : 'INVITE', 'setup');
  });
  Logger.log('ลิงก์ตั้งรหัสผ่านผู้ดูแล (ใช้ได้ครั้งเดียว):\n' + link);
  return link;
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'nightlyJob') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('nightlyJob').timeBased().atHour(2).everyDays(1).inTimezone(APP.TZ).create();
  Logger.log('ตั้งงานกลางคืน 02:00 แล้ว');
}

/** อ่านความยาววิดีโอจาก Google Drive (Advanced Service "Drive API" v3) ให้บทที่ยังไม่มีความยาว */
function fetchVideoDurations() {
  withLock_(function () {
    var t = T_('Modules'), list = [];
    t.all().forEach(function (m) {
      if (m.video_type !== 'DRIVE' || num_(m.duration_sec) > 0 || !m.video_ref) return;
      var f = Drive.Files.get(m.video_ref, { fields: 'videoMediaMetadata' });
      var ms = f && f.videoMediaMetadata && f.videoMediaMetadata.durationMillis;
      if (ms) list.push({ module_id: m.module_id, duration_sec: String(Math.round(+ms / 1000)) });
    });
    t.upsertMany(list);
    Logger.log('อัปเดตความยาววิดีโอ ' + list.length + ' บท');
  });
}

/** สร้างแม่แบบใบเซอร์จากหน้า Apps Script (เหมือนปุ่มในหน้าตั้งค่า) */
function createCertTemplate() { var r = rebuildCertTemplate_(null); Logger.log('แม่แบบใบเซอร์: ' + r.url); return r; }
