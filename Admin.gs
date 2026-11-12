/**
 * Admin.gs : งานผู้ดูแล — ภาพรวม · ทะเบียนผู้เรียน (สร้างบัญชี/นำเข้า/ส่งลิงก์เชิญ) · ปรับความก้าวหน้า · เตือน · ตั้งค่า · งานกลางคืน
 */
var STATUS_TH = { PENDING: 'ยังไม่ตั้งรหัสผ่าน', ACTIVE: 'ใช้งาน', DISABLED: 'ปิดใช้งาน' };

function userRow_(u, mods, att) {
  var pm = {}; (att.prog[u.user_id] || []).forEach(function (r) { pm[r.module_id] = r; });
  var sum = learnerSummary_(u, mods, pm), mine = att.att[u.user_id] || [], best = null;
  mine.forEach(function (a) { if (best == null || num_(a.percent) > best) best = num_(a.percent); });
  return {
    id: u.user_id, email: u.email, status: u.status, statusTh: STATUS_TH[u.status] || u.status, roles: rolesOf_(u), group: u.group, groupTh: GROUPS[u.group] || u.group,
    boardRole: u.board_role, sort: num_(u.sort, 999), prefix: u.prefix, firstName: u.first_name, lastName: u.last_name, name: fullName_(u), position: u.position, department: u.department,
    lastLogin: u.last_login, done: sum.done, total: sum.total, reqDone: sum.reqDone, reqTotal: sum.reqTotal, learnDone: sum.learnDone, lastActive: sum.lastActive,
    attempts: mine.length, best: best, cert: sum.cert, note: u.note
  };
}
function indexAll_() {
  var prog = {}, att = {};
  T_('Progress').all().forEach(function (r) { (prog[r.user_id] = prog[r.user_id] || []).push(r); });
  T_('Attempts').all().forEach(function (a) { if (a.status === 'SUBMITTED') (att[a.user_id] = att[a.user_id] || []).push(a); });
  return { prog: prog, att: att };
}
function listUsers_() {
  var mods = modules_(), ix = indexAll_();
  return T_('Users').all().map(function (u) { return userRow_(u, mods, ix); })
    .sort(function (a, b) { return (Object.keys(GROUPS).indexOf(a.group) - Object.keys(GROUPS).indexOf(b.group)) || (a.sort - b.sort) || a.name.localeCompare(b.name, 'th'); });
}
/** ภาพรวม: สถิติรายกลุ่ม + ความพร้อมของระบบ */
function adminDashboard_() {
  var rows = listUsers_().filter(function (r) { return r.status !== 'DISABLED' && r.roles.indexOf(ROLE.LEARNER) >= 0; }), groups = {};
  rows.forEach(function (r) {
    var g = groups[r.group] || (groups[r.group] = { group: r.group, groupTh: r.groupTh, total: 0, noAccount: 0, notStarted: 0, learning: 0, ready: 0, passed: 0, soon: 0, expired: 0 });
    g.total++;
    var cs = r.cert.status;   // นับแบบไม่ซ้ำกลุ่ม: ผ่าน / ยังไม่ตั้งรหัส / เรียนครบรอสอบ / กำลังเรียน / ยังไม่เริ่ม
    if (cs === 'VALID') g.passed++; else if (cs === 'SOON') { g.passed++; g.soon++; }
    else { if (cs === 'EXPIRED') g.expired++; if (r.learnDone) g.ready++; else if (r.done > 0) g.learning++; else if (r.status === 'PENDING') g.noAccount++; else g.notStarted++; }
  });
  var mods = modules_(), qs = listQuestions_(), s = settings_();
  return {
    rows: rows, groups: Object.keys(GROUPS).map(function (k) { return groups[k]; }).filter(Boolean),
    system: {
      modules: mods.length, youtube: mods.filter(function (m) { return m.video_type === 'YOUTUBE'; }).length, drive: mods.filter(function (m) { return m.video_type === 'DRIVE'; }).length,
      noDuration: mods.filter(function (m) { return m.video_type === 'DRIVE' && !num_(m.duration_sec); }).length,
      questions: qs.questions.filter(function (q) { return q.active; }).length, unverified: qs.unverified, examCount: qs.examCount,
      mailMode: s.mailMode, autoRemind: bool_(s.autoRemind), template: !!str_(s.certTemplateId), noEmail: rows.filter(function (r) { return !r.email; }).length
    }
  };
}
function getUserDetail_(c, p) {
  var u = T_('Users').get(p.id); if (!u) throw new Error('ไม่พบผู้เรียน');
  var mods = modules_(), pm = progressMap_(u.user_id);
  return {
    user: userRow_(u, mods, indexAll_()),
    modules: mods.map(function (m) { var r = pm[m.module_id] || {}; return { id: m.module_id, code: m.code, title: m.title, percent: num_(r.percent), done: !!r.completed_at, completedAt: r.completed_at || '', method: r.method || '', watched: num_(r.watched_sec), updatedAt: r.updated_at || '' }; }),
    attempts: T_('Attempts').all().filter(function (a) { return a.user_id === u.user_id && a.status === 'SUBMITTED'; }).map(attemptPublic_).reverse(),
    certs: listCerts_().filter(function (x) { return x.userId === u.user_id; })
  };
}
/** เพิ่ม/แก้ผู้เรียน */
function saveUser_(c, p) {
  return withLock_(function () {
    var t = T_('Users'), id = str_(p.id), old = id ? t.get(id) : null;
    if (id && !old) throw new Error('ไม่พบผู้เรียน');
    var email = str_(p.email).toLowerCase();
    if (email && !emailOk_(email)) throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
    if (email) { var dup = findUserByEmail_(email); if (dup && dup.user_id !== id) throw new Error('อีเมลนี้มีในระบบแล้ว (' + fullName_(dup) + ')'); }
    if (!str_(p.firstName)) throw new Error('กรุณากรอกชื่อ');
    if (!GROUPS[p.group]) throw new Error('กรุณาเลือกกลุ่ม');
    var roles = [ROLE.LEARNER]; if (p.admin) roles.unshift(ROLE.ADMIN);
    if (old && old.user_id === c.uid && !p.admin) throw new Error('ไม่สามารถถอนสิทธิ์ผู้ดูแลของตนเองได้');
    var row = {
      user_id: id || nextUserId_(), email: email, roles: roles.join(','), group: p.group, board_role: str_(p.boardRole), sort: String(num_(p.sort, 999)),
      prefix: str_(p.prefix), first_name: str_(p.firstName), last_name: str_(p.lastName), position: str_(p.position), department: str_(p.department), note: str_(p.note), updated_at: nowIso_()
    };
    if (!old) { row.status = 'PENDING'; row.token_ver = '0'; row.created_at = nowIso_(); }
    if (p.disabled === true) row.status = 'DISABLED';
    else if (old && old.status === 'DISABLED' && p.disabled === false) row.status = old.pw_hash ? 'ACTIVE' : 'PENDING';
    if (old && (email !== str_(old.email).toLowerCase() || row.status === 'DISABLED')) row.token_ver = String((+old.token_ver || 0) + 1);
    t.upsert(row);
    audit_(c.user.email, old ? 'USER_EDIT' : 'USER_ADD', row.user_id, fullName_(row) + ' ' + email + ' ' + row.roles + (row.status === 'DISABLED' ? ' ปิดใช้งาน' : ''));
    return userRow_(t.get(row.user_id), modules_(), indexAll_());
  });
}
function nextUserId_() {
  var max = 0; T_('Users').all().forEach(function (u) { var n = +String(u.user_id).replace(/\D/g, ''); if (n > max) max = n; });
  return 'U' + ('0000' + (max + 1)).slice(-4);
}
/**
 * นำเข้ารายชื่อ: rows = [{group, boardRole, sort, prefix, firstName, lastName, position, department, email}]
 * จับคู่ด้วยอีเมล ถ้าไม่มีอีเมลจับคู่ด้วยชื่อ+นามสกุล · ไม่ลบใครออก · ไม่แตะรหัสผ่าน
 */
function importUsers_(c, p) {
  var rows = p.rows || []; if (!rows.length) throw new Error('ไม่มีรายชื่อที่จะนำเข้า');
  var gmap = {}; Object.keys(GROUPS).forEach(function (k) { gmap[k] = k; gmap[GROUPS[k]] = k; }); gmap['กรรมการหลัก'] = 'MAIN'; gmap['กรรมการสมทบ'] = 'ALT'; gmap['เจ้าหน้าที่'] = 'STAFF';
  return withLock_(function () {
    var t = T_('Users'), add = 0, upd = 0, skip = [], list = [], norm = function (s) { return str_(s).replace(/\s+/g, ''); };
    var byName = {}; t.all().forEach(function (u) { byName[norm(u.first_name) + '|' + norm(u.last_name)] = u; });
    var seq = +nextUserId_().slice(1);
    rows.forEach(function (r, i) {
      var email = str_(r.email).toLowerCase(), g = gmap[str_(r.group)] || '';
      if (!str_(r.firstName)) { skip.push('แถว ' + (i + 1) + ': ไม่มีชื่อ'); return; }
      if (!g) { skip.push('แถว ' + (i + 1) + ': กลุ่ม "' + str_(r.group) + '" ไม่ถูกต้อง'); return; }
      if (email && !emailOk_(email)) { skip.push('แถว ' + (i + 1) + ': อีเมลไม่ถูกต้อง'); return; }
      var old = (email && findUserByEmail_(email)) || byName[norm(r.firstName) + '|' + norm(r.lastName)];
      var row = { group: g, board_role: str_(r.boardRole), sort: String(num_(r.sort, i + 1)), prefix: str_(r.prefix), first_name: str_(r.firstName), last_name: str_(r.lastName), position: str_(r.position), department: str_(r.department), updated_at: nowIso_() };
      if (old) { row.user_id = old.user_id; if (email) row.email = email; upd++; }
      else { row.user_id = 'U' + ('0000' + (seq++)).slice(-4); row.email = email; row.status = 'PENDING'; row.roles = ROLE.LEARNER; row.token_ver = '0'; row.created_at = nowIso_(); add++; }
      list.push(row); byName[norm(r.firstName) + '|' + norm(r.lastName)] = row;
    });
    t.upsertMany(list);
    audit_(c.user.email, 'USER_IMPORT', '', 'เพิ่ม ' + add + ' แก้ ' + upd + ' ข้าม ' + skip.length);
    return { added: add, updated: upd, skipped: skip };
  });
}
/** สร้างลิงก์ตั้งรหัสผ่าน (+ ส่งอีเมลตามโหมด) · คืนลิงก์ให้ผู้ดูแลคัดลอกส่งทางอื่นได้ */
function inviteUsers_(c, p) {
  var ids = p.ids || [], out = [];
  withLock_(function () {
    ids.forEach(function (id) {
      var u = T_('Users').get(id); if (!u) return;
      if (!u.email) { out.push({ id: id, name: fullName_(u), error: 'ยังไม่มีอีเมล' }); return; }
      if (u.status === 'DISABLED') { out.push({ id: id, name: fullName_(u), error: 'บัญชีปิดใช้งาน' }); return; }
      var purpose = u.pw_hash ? 'RESET' : 'INVITE', link = makeSetLink_(u, purpose, c.user.email);
      var m = p.send === false ? { status: 'NOT_SENT', note: 'สร้างลิงก์อย่างเดียว' } : sendMail_(u.email, purpose, { name: fullName_(u), email: u.email, link: link, days: setting_('inviteDays') });
      out.push({ id: id, name: fullName_(u), email: u.email, link: link, mail: m.status, mailTh: MAIL_STATUS_TH[m.status] || m.note });
    });
  });
  audit_(c.user.email, 'INVITE', '', out.length + ' คน');
  return out;
}
/** ผู้ดูแลปรับความก้าวหน้า: action = complete | reset · moduleId = รหัสบท หรือ ALL */
function setUserProgress_(c, p) {
  return withLock_(function () {
    var u = T_('Users').get(p.userId); if (!u) throw new Error('ไม่พบผู้เรียน');
    var mods = p.moduleId === 'ALL' ? modules_() : [T_('Modules').get(p.moduleId)].filter(Boolean), t = T_('Progress'), list = [];
    mods.forEach(function (m) {
      var key = u.user_id + '|' + m.module_id;
      if (p.action === 'complete') list.push({ key: key, user_id: u.user_id, module_id: m.module_id, percent: '100', completed_at: nowIso_(), method: 'ผู้ดูแลบันทึกให้ (' + c.user.email + ')' + (p.note ? ' ' + str_(p.note) : ''), updated_at: nowIso_() });
      else list.push({ key: key, user_id: u.user_id, module_id: m.module_id, watched_sec: '0', max_pos: '0', percent: '0', completed_at: '', method: '', last_beat_at: '', updated_at: nowIso_() });
    });
    t.upsertMany(list);
    audit_(c.user.email, p.action === 'complete' ? 'PROGRESS_SET' : 'PROGRESS_RESET', u.user_id, p.moduleId + ' ' + str_(p.note));
    return getUserDetail_(c, { id: u.user_id });
  });
}
function remindUsers_(c, p) {
  var mods = modules_(), ix = indexAll_(), out = [];
  (p.ids || []).forEach(function (id) {
    var u = T_('Users').get(id); if (!u) return;
    var r = userRow_(u, mods, ix);
    if (r.cert.status === 'VALID' || r.cert.status === 'SOON') { out.push({ name: r.name, mailTh: 'ผ่านแล้ว ไม่ต้องเตือน' }); return; }
    var m = sendMail_(u.email, 'REMIND_COURSE', { name: r.name, done: r.reqDone, total: r.reqTotal, examReady: r.learnDone });
    out.push({ name: r.name, mail: m.status, mailTh: MAIL_STATUS_TH[m.status] || m.note });
  });
  audit_(c.user.email, 'REMIND', '', out.length + ' คน');
  return out;
}

/* ---------------------------------------------------------------- ตั้งค่า */
function getSettings_() {
  var s = settings_();
  return { meta: SETTING_META.map(function (m) { return { k: m.k, g: m.g, t: m.t, l: m.l, h: m.h || '', o: m.o || null, v: s[m.k] }; }), build: APP.BUILD, groups: GROUPS, videoTypes: VIDEO_TYPES };
}
function saveSettings_(c, p) {
  var vals = p.values || {}, meta = {}; SETTING_META.forEach(function (m) { meta[m.k] = m; });
  return withLock_(function () {
    var list = [], changed = [];
    Object.keys(vals).forEach(function (k) {
      var m = meta[k]; if (!m) return;
      var v = vals[k];
      if (m.t === 'number') { if (v === '' || isNaN(+v) || +v < 0) throw new Error('"' + m.l + '" ต้องเป็นตัวเลขไม่ติดลบ'); v = String(+v); }
      else if (m.t === 'bool') v = bool_(v) ? 'TRUE' : 'FALSE';
      else if (m.t === 'select') { v = String(v).toUpperCase(); if (m.o.indexOf(v) < 0) throw new Error('ค่า "' + m.l + '" ไม่ถูกต้อง'); }
      else v = String(v == null ? '' : v);
      if (k === 'mailMode' && v === 'TEST' && !emailOk_(vals.mailTestTo != null ? vals.mailTestTo : setting_('mailTestTo'))) throw new Error('โหมด TEST ต้องกรอกอีเมลทดสอบก่อน');
      if (k === 'watchPercent' && (+v < 1 || +v > 100)) throw new Error('% การดูวิดีโอต้องอยู่ระหว่าง 1–100');
      if (k === 'passPercent' && (+v < 1 || +v > 100)) throw new Error('เกณฑ์ผ่านต้องอยู่ระหว่าง 1–100');
      if (String(settings_()[k]) !== v) changed.push(k + '=' + (k === 'mailTestTo' ? v : v.slice(0, 40)));
      list.push({ key: k, value: v, updated_at: nowIso_(), updated_by: c.user.email });
    });
    T_('Settings').upsertMany(list); _SET = null;
    if (changed.length) audit_(c.user.email, 'SETTINGS', '', changed.join(' · '));
    return getSettings_();
  });
}
function listAudit_(c, p) { return T_('AuditLog').tail(num_(p.limit, 300)); }

/* ---------------------------------------------------------------- งานกลางคืน (trigger 02:00) */
function nightlyJob() { return nightlyJob_('trigger'); }
function nightlyJob_(by) {
  var s = settings_(), res = { expiredAttempts: 0, remindCourse: 0, remindExpire: 0 }, limit = num_(s.timeLimitMin, 0);
  withLock_(function () {
    var t = T_('Attempts'), list = [];
    t.all().forEach(function (a) { if (a.status === 'OPEN' && secsSince_(a.started_at) > Math.max(limit * 60 + 600, 86400 * 3)) list.push({ attempt_id: a.attempt_id, status: 'EXPIRED' }); });
    t.upsertMany(list); res.expiredAttempts = list.length;
  });
  if (!bool_(s.autoRemind) || String(s.mailMode).toUpperCase() === 'OFF') { res.note = 'ไม่ส่งเตือน (ปิดเตือนอัตโนมัติหรือปิดอีเมล)'; audit_(by, 'NIGHTLY', '', JSON.stringify(res)); return res; }
  var mods = modules_(), ix = indexAll_(), every = num_(s.remindEveryDays, 7), days = String(s.remindDays).split(',').map(function (x) { return +x; }).filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
  var patches = [];
  T_('Users').all().forEach(function (u) {
    if (u.status === 'DISABLED' || !u.email || rolesOf_(u).indexOf(ROLE.LEARNER) < 0) return;
    var r = userRow_(u, mods, ix), log = parseJson_(u.remind_log, {}), changed = false;
    if ((r.cert.status === 'NONE' || r.cert.status === 'EXPIRED') && every > 0 && u.status === 'ACTIVE' && secsSince_(log.course) > every * 86400 - 3600) {
      if (sendMail_(u.email, 'REMIND_COURSE', { name: r.name, done: r.reqDone, total: r.reqTotal, examReady: r.learnDone }).status === 'SENT') { log.course = nowIso_(); changed = true; res.remindCourse++; }
    }
    if (r.cert.status === 'SOON' || r.cert.status === 'VALID') {
      var hit = days.filter(function (d) { return r.cert.daysLeft <= d; })[0];
      var tag = hit && r.cert.no + '@' + hit;
      if (hit && log.expire !== tag && sendMail_(u.email, 'REMIND_EXPIRE', { name: r.name, days: r.cert.daysLeft, certNo: r.cert.no, expire: thDate_(r.cert.expire) }).status === 'SENT') { log.expire = tag; changed = true; res.remindExpire++; }
    }
    if (changed) patches.push({ user_id: u.user_id, remind_log: JSON.stringify(log) });
  });
  if (patches.length) withLock_(function () { T_('Users').upsertMany(patches); });
  audit_(by, 'NIGHTLY', '', JSON.stringify(res));
  return res;
}
