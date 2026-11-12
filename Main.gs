/**
 * Main.gs : ทางเข้า (doGet/doPost) · ตารางคำสั่ง · rpc · ตัวช่วยทั่วไป
 * Deploy: Web app · Execute as: Me (researchsomdej@somdej-mec.or.th) · Who has access: Anyone
 * หน้าเว็บ (GitHub Pages) ส่ง POST {action, token, payload} แบบ text/plain → ตอบ {ok, data} หรือ {ok:false, error}
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.ping) return json_({ ok: true, app: APP.NAME, version: APP.VERSION, build: APP.BUILD, buildTh: APP.BUILD_TH, time: nowIso_() });
  var url = setting_('siteUrl');
  return HtmlService.createHtmlOutput('<meta http-equiv="refresh" content="0;url=' + url + '"><a href="' + url + '">ไปที่ ' + APP.NAME + '</a>');
}
function doPost(e) {
  var b = {};
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'รูปแบบคำขอไม่ถูกต้อง' }); }
  return json_(rpc(String(b.action || ''), b.token || null, b.payload || {}));
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** คำสั่งที่ไม่ต้องเข้าสู่ระบบ (มีเท่านี้เท่านั้น ตามมาตรฐานความปลอดภัยข้อ 4) */
function publicActions_() {
  return {
    ping: function () { return { build: APP.BUILD, version: APP.VERSION, buildTh: APP.BUILD_TH }; },
    branding: branding_,
    login: login_,
    forgotPassword: forgotPassword_,
    checkSetToken: checkSetToken_,
    setPassword: setPassword_,
    verifyCert: verifyCert_
  };
}

/** คำสั่งที่ต้องเข้าสู่ระบบ: [ฟังก์ชัน, บทบาทที่อนุญาต (ว่าง = ทุกคนที่เข้าสู่ระบบ)] */
function actions_() {
  var A = [ROLE.ADMIN];
  return {
    bootstrap: [bootstrap_, []],
    logout: [logout_, []],
    changePassword: [changePassword_, []],

    // ผู้เรียน
    myCourse: [myCourse_, []],
    getModule: [getModule_, []],
    beat: [beat_, []],
    markRead: [markRead_, []],
    startExam: [startExam_, []],
    submitExam: [submitExam_, []],
    myResults: [myResults_, []],
    downloadCert: [downloadCert_, []],

    // ผู้ดูแล: ผู้เรียน
    adminDashboard: [adminDashboard_, A],
    listUsers: [listUsers_, A],
    getUserDetail: [getUserDetail_, A],
    saveUser: [saveUser_, A],
    importUsers: [importUsers_, A],
    inviteUsers: [inviteUsers_, A],
    setUserProgress: [setUserProgress_, A],
    remindUsers: [remindUsers_, A],
    // ผู้ดูแล: บทเรียน / ข้อสอบ
    listModules: [listModules_, A],
    saveModule: [saveModule_, A],
    listQuestions: [listQuestions_, A],
    saveQuestion: [saveQuestion_, A],
    importQuestions: [importQuestions_, A],
    // ผู้ดูแล: ใบเซอร์
    listCerts: [listCerts_, A],
    regenCert: [regenCert_, A],
    revokeCert: [revokeCert_, A],
    issueCertManual: [issueCertManual_, A],
    rebuildCertTemplate: [rebuildCertTemplate_, A],
    previewCert: [previewCert_, A],
    // ผู้ดูแล: ตั้งค่า / อีเมล / ประวัติ
    getSettings: [getSettings_, A],
    saveSettings: [saveSettings_, A],
    testMail: [testMail_, A],
    listMailLog: [listMailLog_, A],
    listAudit: [listAudit_, A],
    runNightly: [function (c) { return nightlyJob_(c.user.email); }, A]
  };
}

function rpc(action, token, payload) {
  var t0 = Date.now();
  try {
    var pub = publicActions_();
    if (pub[action]) return { ok: true, data: pub[action](payload || {}) };
    var def = actions_()[action];
    if (!def) throw new Error('ไม่รู้จักคำสั่ง ' + action);
    var c = ctx_(token);
    if (def[1].length) requireRole_(c, def[1]);
    if (bool_(setting_('maintenance')) && !isAdmin_(c) && action !== 'bootstrap' && action !== 'logout') throw new Error('ระบบปิดปรับปรุงชั่วคราว กรุณาลองใหม่ภายหลัง');
    return { ok: true, data: def[0](c, payload || {}) };
  } catch (e) {
    var msg = e && e.message ? e.message : String(e);
    if (msg !== 'SESSION_EXPIRED') console.warn('[IRB] ' + action + ' ERROR ' + msg);
    return { ok: false, error: msg };
  } finally {
    console.log('[IRB] ' + action + ' ' + (Date.now() - t0) + ' ms');
  }
}

/** ข้อมูลหน้าเข้าสู่ระบบ (สาธารณะ — ไม่มีข้อมูลส่วนบุคคล) */
function branding_() {
  var s = settings_();
  return { app: APP.NAME, appTh: APP.NAME_TH, build: APP.BUILD, buildTh: APP.BUILD_TH, orgName: s.orgName, officeName: s.officeName, contact: s.contact, maintenance: bool_(s.maintenance) };
}

/* ---------------------------------------------------------------- ตัวช่วยทั่วไป */
function nowIso_() { return Utilities.formatDate(new Date(), APP.TZ, "yyyy-MM-dd'T'HH:mm:ss"); }
function todayYmd_() { return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd'); }
function str_(v) { return v == null ? '' : String(v).trim(); }
function num_(v, d) { var n = parseFloat(v); return isNaN(n) ? (d || 0) : n; }
function parseJson_(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
function bool_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function emailOk_(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(str_(e)); }
function audit_(actor, action, target, detail) {
  try { T_('AuditLog').append({ ts: nowIso_(), actor: actor || '-', action: action, target: target || '', detail: typeof detail === 'string' ? detail : JSON.stringify(detail || {}) }); }
  catch (e) { console.warn('audit fail ' + e.message); }
}
var TH_MON_ = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
/** '2026-11-09' → '9 พฤศจิกายน 2569' */
function thDate_(ymd) { var m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? (+m[3]) + ' ' + TH_MON_[+m[2] - 1] + ' ' + (+m[1] + 543) : '-'; }
/** จำนวนวันจากวันนี้ถึง ymd (ลบ = เลยมาแล้ว) */
function daysTo_(ymd) {
  var a = String(todayYmd_()).split('-'), b = String(ymd).slice(0, 10).split('-');
  return Math.round((Date.UTC(+b[0], +b[1] - 1, +b[2]) - Date.UTC(+a[0], +a[1] - 1, +a[2])) / 86400000);
}
/** บวกปีให้ yyyy-MM-dd แล้วลบ 1 วัน (อายุ 2 ปี นับรวมวันออก) */
function addYears_(ymd, years) {
  var b = String(ymd).split('-'), d = new Date(Date.UTC(+b[0] + years, +b[1] - 1, +b[2]));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}
function secsSince_(iso) { if (!iso) return 1e9; var t = new Date(String(iso).replace(' ', 'T') + (/[Z+]/.test(iso) ? '' : '+07:00')).getTime(); return isNaN(t) ? 1e9 : (Date.now() - t) / 1000; }
function isoPlus_(sec) { return Utilities.formatDate(new Date(Date.now() + sec * 1000), APP.TZ, "yyyy-MM-dd'T'HH:mm:ss"); }
function newId_(prefix) { return prefix + Utilities.formatDate(new Date(), APP.TZ, 'yyMMddHHmmss') + Math.floor(Math.random() * 900 + 100); }
function fullName_(u) { return [str_(u.prefix) + str_(u.first_name), str_(u.last_name)].filter(String).join(' '); }
function shuffle_(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
