/**
 * Course.gs : บทเรียน 22 SOP · บันทึกการดูวิดีโอ (heartbeat) · สรุปความก้าวหน้า
 * วิดีโอ 3 แบบ (ตั้งในหน้า "บทเรียน"):
 *  YOUTUBE → หน้าเว็บใช้ YouTube IFrame API วัดตำแหน่งจริง · ห้ามข้ามไปข้างหน้า (noSkip)
 *  DRIVE   → ฝัง Google Drive (วัดตำแหน่งไม่ได้) นับเวลาที่เปิดหน้าบทเรียนไว้แทน (ต้องใส่ความยาววิดีโอ)
 *  NONE    → ไม่มีวิดีโอ (อ่านเอกสาร) กด "เรียนบทนี้แล้ว"
 * กันการโกงฝั่งหลังบ้าน: เวลาที่นับเพิ่มต่อครั้ง ≤ เวลาจริงที่ผ่านไป × ความเร็วสูงสุดที่อนุญาต
 */
var VIDEO_TYPES = { YOUTUBE: 'YouTube', DRIVE: 'Google Drive', NONE: 'ไม่มีวิดีโอ (อ่านเอกสาร)' };

function modules_(all) {
  return T_('Modules').all().filter(function (m) { return all || bool_(m.active); })
    .slice().sort(function (a, b) { return num_(a.sort) - num_(b.sort); });
}
function progressMap_(uid) {
  var o = {}; T_('Progress').all().forEach(function (r) { if (r.user_id === uid) o[r.module_id] = r; }); return o;
}
/** สรุปของผู้เรียน 1 คน (ใช้ทั้งหน้าผู้เรียนและหน้าผู้ดูแล) */
function learnerSummary_(u, mods, pmap) {
  var req = mods.filter(function (m) { return bool_(m.required); }), done = 0, reqDone = 0, last = '';
  mods.forEach(function (m) { var r = pmap[m.module_id]; if (r && r.completed_at) { done++; if (bool_(m.required)) reqDone++; } if (r && r.updated_at > last) last = r.updated_at; });
  var cs = certState_(u);
  return { done: done, total: mods.length, reqDone: reqDone, reqTotal: req.length, learnDone: reqDone >= req.length, lastActive: last, cert: cs };
}
function certState_(u) {
  if (!u.sop_expire_date) return { status: 'NONE' };
  var d = daysTo_(u.sop_expire_date);
  return { status: d < 0 ? 'EXPIRED' : d <= 60 ? 'SOON' : 'VALID', no: u.sop_cert_no, issued: u.sop_train_date, expire: u.sop_expire_date, daysLeft: d };
}
function isLocked_(mods, pmap, idx) {
  if (!bool_(setting_('sequential')) || idx === 0) return false;
  for (var i = 0; i < idx; i++) { var r = pmap[mods[i].module_id]; if (bool_(mods[i].required) && !(r && r.completed_at)) return true; }
  return false;
}

/* ---------------------------------------------------------------- ผู้เรียน */
function myCourse_(c) {
  var mods = modules_(), pmap = progressMap_(c.uid), sum = learnerSummary_(c.user, mods, pmap);
  return {
    modules: mods.map(function (m, i) {
      var r = pmap[m.module_id] || {};
      return { id: m.module_id, code: m.code, title: m.title, type: m.video_type, required: bool_(m.required), duration: num_(m.duration_sec), percent: num_(r.percent), done: !!r.completed_at, completedAt: r.completed_at || '', locked: isLocked_(mods, pmap, i), docUrl: m.doc_url };
    }),
    summary: sum,
    exam: canExam_(c.user, mods, pmap),
    attempts: T_('Attempts').all().filter(function (a) { return a.user_id === c.uid && a.status === 'SUBMITTED'; }).map(attemptPublic_).reverse()
  };
}
function getModule_(c, p) {
  var mods = modules_(), pmap = progressMap_(c.uid), idx = -1;
  mods.forEach(function (m, i) { if (m.module_id === p.id) idx = i; });
  if (idx < 0) throw new Error('ไม่พบบทเรียนนี้');
  if (isLocked_(mods, pmap, idx)) throw new Error('กรุณาเรียนบทก่อนหน้าให้จบก่อน');
  var m = mods[idx], r = pmap[m.module_id] || {};
  return {
    id: m.module_id, code: m.code, title: m.title, type: m.video_type, ref: m.video_ref, duration: num_(m.duration_sec), docUrl: m.doc_url, note: m.note, required: bool_(m.required),
    watched: num_(r.watched_sec), maxPos: num_(r.max_pos), percent: num_(r.percent), done: !!r.completed_at,
    prev: idx > 0 ? mods[idx - 1].module_id : '', next: idx < mods.length - 1 ? mods[idx + 1].module_id : '', index: idx + 1, count: mods.length
  };
}
/** heartbeat ระหว่างดูวิดีโอ: p = {id, delta (วินาทีที่ดูเพิ่ม), pos (ตำแหน่งปัจจุบัน), dur (ความยาวจากเครื่องเล่น), ended} */
function beat_(c, p) {
  return withLock_(function () {
    var m = T_('Modules').get(p.id);
    if (!m || !bool_(m.active)) throw new Error('ไม่พบบทเรียนนี้');
    var key = c.uid + '|' + m.module_id, t = T_('Progress'), r = t.get(key) || { key: key, user_id: c.uid, module_id: m.module_id, watched_sec: '0', max_pos: '0' };
    var el = secsSince_(r.last_beat_at), speed = Math.max(1, num_(setting_('allowSpeed'), 1.5));
    if (el < 4 && !p.ended) return { percent: num_(r.percent), done: !!r.completed_at, maxPos: num_(r.max_pos), throttled: true };
    var allowed = el > 1e8 ? 40 * speed : el * speed + 5;
    var delta = Math.max(0, Math.min(num_(p.delta), allowed));
    var watched = num_(r.watched_sec) + delta, maxPos = num_(r.max_pos);
    var dur = num_(m.duration_sec) > 0 ? num_(m.duration_sec) : (num_(p.dur) > 30 ? Math.round(num_(p.dur)) : num_(r.duration_sec));
    if (m.video_type === 'YOUTUBE') {
      var pos = Math.max(0, Math.min(num_(p.pos), maxPos + allowed + 2));
      if (p.ended && dur && pos >= dur - 8) pos = dur;
      maxPos = Math.max(maxPos, pos);
      if (!num_(m.duration_sec) && num_(p.dur) > 30) T_('Modules').upsert({ module_id: m.module_id, duration_sec: String(Math.round(num_(p.dur))) });
    } else maxPos = watched;
    var pct = dur > 0 ? Math.min(100, Math.floor(Math.min(watched, maxPos) / dur * 100)) : 0;
    var patch = { key: key, user_id: c.uid, module_id: m.module_id, watched_sec: String(Math.round(watched)), max_pos: String(Math.round(maxPos)), duration_sec: String(dur || ''), last_beat_at: nowIso_(), updated_at: nowIso_() };
    if (!r.completed_at) {
      patch.percent = String(pct);
      if (dur > 0 && pct >= num_(setting_('watchPercent'), 90)) { patch.completed_at = nowIso_(); patch.method = m.video_type === 'YOUTUBE' ? 'ดูวิดีโอ YouTube' : 'เปิดวิดีโอ Drive ครบเวลา'; }
    }
    t.upsert(patch);
    var nr = t.get(key);
    return { percent: num_(nr.percent), done: !!nr.completed_at, maxPos: num_(nr.max_pos), watched: num_(nr.watched_sec) };
  });
}
/** บทที่ไม่มีวิดีโอ: กดเรียนแล้ว */
function markRead_(c, p) {
  return withLock_(function () {
    var m = T_('Modules').get(p.id);
    if (!m || !bool_(m.active)) throw new Error('ไม่พบบทเรียนนี้');
    if (m.video_type !== 'NONE') throw new Error('บทนี้ต้องดูวิดีโอให้ครบตามเกณฑ์');
    var key = c.uid + '|' + m.module_id;
    T_('Progress').upsert({ key: key, user_id: c.uid, module_id: m.module_id, percent: '100', completed_at: nowIso_(), method: 'อ่านเอกสาร', updated_at: nowIso_() });
    return { done: true };
  });
}

/* ---------------------------------------------------------------- ผู้ดูแล: บทเรียน */
function listModules_() {
  return modules_(true).map(function (m) { return { id: m.module_id, sort: num_(m.sort), code: m.code, title: m.title, type: m.video_type, ref: m.video_ref, duration: num_(m.duration_sec), required: bool_(m.required), active: bool_(m.active), docUrl: m.doc_url, note: m.note }; });
}
/** รับลิงก์ YouTube ได้ทุกรูปแบบ → เก็บเฉพาะรหัส 11 ตัว · ลิงก์ Drive → รหัสไฟล์ */
function parseVideoRef_(type, v) {
  v = str_(v); if (!v) return '';
  if (type === 'YOUTUBE') { var m = v.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/); if (m) return m[1]; if (/^[\w-]{11}$/.test(v)) return v; throw new Error('ลิงก์ YouTube ไม่ถูกต้อง'); }
  if (type === 'DRIVE') { var d = v.match(/\/d\/([\w-]{20,})/) || v.match(/id=([\w-]{20,})/); if (d) return d[1]; if (/^[\w-]{20,}$/.test(v)) return v; throw new Error('ลิงก์ Google Drive ไม่ถูกต้อง'); }
  return '';
}
function saveModule_(c, p) {
  return withLock_(function () {
    var t = T_('Modules'), id = str_(p.id) || ('M' + Utilities.formatDate(new Date(), APP.TZ, 'yyMMddHHmmss'));
    var old = t.get(id) || {}, type = str_(p.type || old.video_type || 'YOUTUBE').toUpperCase();
    if (!VIDEO_TYPES[type]) throw new Error('ชนิดวิดีโอไม่ถูกต้อง');
    if (!str_(p.title)) throw new Error('กรุณากรอกชื่อบทเรียน');
    var ref = p.ref !== undefined ? parseVideoRef_(type, p.ref) : old.video_ref;
    if (type !== 'NONE' && !ref) throw new Error('กรุณาใส่ลิงก์วิดีโอ');
    var dur = Math.round(num_(p.durationMin) * 60) || (p.duration !== undefined ? num_(p.duration) : num_(old.duration_sec));
    if (type === 'DRIVE' && !dur) throw new Error('วิดีโอ Google Drive ต้องระบุความยาว (นาที) เพราะระบบวัดตำแหน่งการเล่นไม่ได้');
    if (type !== old.video_type || ref !== old.video_ref) { if (type === 'YOUTUBE' && !num_(p.durationMin)) dur = 0; }
    var row = { module_id: id, sort: String(p.sort != null ? num_(p.sort) : num_(old.sort, 999)), code: str_(p.code), title: str_(p.title), video_type: type, video_ref: ref, duration_sec: dur ? String(dur) : '', required: String(p.required !== false), active: String(p.active !== false), doc_url: str_(p.docUrl), note: str_(p.note), updated_at: nowIso_() };
    t.upsert(row);
    audit_(c.user.email, 'SAVE_MODULE', id, row.code + ' ' + type + ' ' + ref);
    return listModules_();
  });
}
