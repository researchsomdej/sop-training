/**
 * Exam.gs : คลังข้อสอบ · เริ่มสอบ (สุ่มข้อ/สลับตัวเลือกที่หลังบ้าน) · ตรวจคะแนนที่หลังบ้าน
 * หน้าเว็บไม่เคยได้รับเฉลย (ยกเว้นตั้ง showReview = TRUE และส่งคำตอบแล้ว)
 * ข้อสอบเก็บตัวเลือกเป็น JSON array · answer = ลำดับตัวเลือกที่ถูก (เริ่ม 0)
 */
var OPT_LABEL = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ', 'ช', 'ซ'];

function questions_(all) {
  return T_('Questions').all().filter(function (q) { return all || bool_(q.active); })
    .slice().sort(function (a, b) { return num_(a.sort) - num_(b.sort); });
}
/** ตรวจว่าสอบได้หรือไม่ → {ok, reason, renew} */
function canExam_(u, mods, pmap) {
  mods = mods || modules_(); pmap = pmap || progressMap_(u.user_id);
  var sum = learnerSummary_(u, mods, pmap), cs = sum.cert, renewDays = num_(setting_('renewDays'), 90);
  if (bool_(setting_('requireAll')) && !sum.learnDone) return { ok: false, reason: 'ต้องเรียนบทเรียนบังคับให้ครบ ' + sum.reqTotal + ' บทก่อน (เรียนแล้ว ' + sum.reqDone + ' บท)' };
  if (cs.status !== 'NONE' && cs.daysLeft > renewDays) return { ok: false, passed: true, reason: 'ท่านผ่านการอบรมแล้ว ใบประกาศนียบัตรใช้ได้ถึง ' + thDate_(cs.expire) + ' (สอบต่ออายุได้เมื่อเหลือไม่เกิน ' + renewDays + ' วัน)' };
  if (!questions_().length) return { ok: false, reason: 'ยังไม่มีข้อสอบในระบบ กรุณาติดต่อผู้ดูแล' };
  var cycleStart = cs.status !== 'NONE' ? cs.issued + 'T23:59:59' : '';
  var mine = T_('Attempts').all().filter(function (a) { return a.user_id === u.user_id && a.status === 'SUBMITTED' && String(a.submitted_at) > cycleStart; });
  var max = num_(setting_('maxAttempts'), 0);
  if (max > 0 && mine.length >= max) return { ok: false, reason: 'ท่านสอบครบ ' + max + ' ครั้งแล้ว กรุณาติดต่อผู้ดูแลเพื่อเปิดสิทธิ์สอบเพิ่ม' };
  var cd = num_(setting_('cooldownMin'), 0), last = mine[mine.length - 1];
  if (cd > 0 && last && !bool_(last.passed) && secsSince_(last.submitted_at) < cd * 60) return { ok: false, reason: 'สอบซ้ำได้อีกครั้งในอีก ' + Math.ceil(cd - secsSince_(last.submitted_at) / 60) + ' นาที' };
  return { ok: true, renew: cs.status !== 'NONE', count: examCount_(), passPercent: num_(setting_('passPercent'), 80), timeLimitMin: num_(setting_('timeLimitMin'), 0), attemptsUsed: mine.length, maxAttempts: max };
}
function examCount_() { var n = questions_().length, k = num_(setting_('examCount'), 0); return k > 0 && k < n ? k : n; }
function attemptPublic_(a) { return { id: a.attempt_id, at: a.submitted_at || a.started_at, score: num_(a.score), total: num_(a.total), percent: num_(a.percent), passed: bool_(a.passed), certNo: a.cert_no }; }

/** ลำดับตัวเลือกที่แสดง (สลับ แต่ตัวเลือกแบบ "ถูกทุกข้อ/ทั้ง ก และ ข" อยู่ท้ายเสมอ) */
function optionPerm_(opts) {
  var idx = opts.map(function (o, i) { return i; });
  if (!bool_(setting_('shuffleOpt'))) return idx;
  var fixed = idx.filter(function (i) { return /ทุกข้อ|ไม่มีข้อใด|ข้อ\s*[กขคง]\s*(และ|หรือ)|ทั้ง(สอง|หมด|\s*[กขคง])|ถูกทั้ง|all of|none of/i.test(opts[i]); });
  var free = shuffle_(idx.filter(function (i) { return fixed.indexOf(i) < 0; }));
  return free.concat(fixed);
}
function startExam_(c) {
  return withLock_(function () {
    var t = T_('Attempts'), limit = num_(setting_('timeLimitMin'), 0);
    var open = t.all().filter(function (a) { return a.user_id === c.uid && a.status === 'OPEN'; })[0];
    if (open && limit > 0 && secsSince_(open.started_at) > limit * 60 + 120) { t.upsert({ attempt_id: open.attempt_id, status: 'EXPIRED' }); open = null; }
    if (!open) {
      var chk = canExam_(c.user);
      if (!chk.ok) throw new Error(chk.reason);
      var qs = questions_(), n = examCount_();
      if (bool_(setting_('shuffleQ')) || n < qs.length) qs = shuffle_(qs.slice());
      qs = qs.slice(0, n);
      if (!bool_(setting_('shuffleQ'))) qs.sort(function (a, b) { return num_(a.sort) - num_(b.sort); });
      open = { attempt_id: newId_('A'), user_id: c.uid, status: 'OPEN', started_at: nowIso_(), q_ids: JSON.stringify(qs.map(function (q) { return q.q_id; })), perm: JSON.stringify(qs.map(function (q) { return optionPerm_(parseJson_(q.options, [])); })), answers: '', score: '', total: '', percent: '', passed: '', cert_no: '' };
      t.upsert(open);
      audit_(c.user.email, 'EXAM_START', open.attempt_id, n + ' ข้อ');
    }
    var ids = parseJson_(open.q_ids, []), perm = parseJson_(open.perm, []), qt = T_('Questions');
    return {
      attemptId: open.attempt_id, startedAt: open.started_at, timeLimitMin: limit, passPercent: num_(setting_('passPercent'), 80),
      secondsLeft: limit > 0 ? Math.max(0, Math.round(limit * 60 - secsSince_(open.started_at))) : null,
      questions: ids.map(function (id, i) {
        var q = qt.get(id) || { text: '(ข้อนี้ถูกลบแล้ว · ไม่นับคะแนน)', options: '[]' }, o = parseJson_(q.options, []);
        return { n: i + 1, text: q.text, sop: q.sop_ref, options: (perm[i] || []).map(function (k) { return o[k]; }) };
      })
    };
  });
}
/** p = {attemptId, answers: [ลำดับตัวเลือกที่แสดง | -1]} */
function submitExam_(c, p) {
  var res = withLock_(function () {
    var t = T_('Attempts'), a = t.get(p.attemptId);
    if (!a || a.user_id !== c.uid) throw new Error('ไม่พบชุดข้อสอบนี้');
    if (a.status !== 'OPEN') throw new Error('ชุดข้อสอบนี้ส่งคำตอบไปแล้ว');
    var ids = parseJson_(a.q_ids, []), perm = parseJson_(a.perm, []), ans = p.answers || [], qt = T_('Questions'), score = 0, total = 0, review = [];
    ids.forEach(function (id, i) {
      var q = qt.get(id); if (!q) return;
      total++;
      var pick = ans[i] == null || +ans[i] < 0 ? -1 : +ans[i], orig = pick >= 0 ? (perm[i] || [])[pick] : -1, right = String(orig) === String(q.answer);
      if (right) score++;
      var o = parseJson_(q.options, []);
      review.push({ n: i + 1, text: q.text, options: (perm[i] || []).map(function (k) { return o[k]; }), your: pick, correct: (perm[i] || []).indexOf(+q.answer), right: right, explain: q.explain });
    });
    var pct = total ? Math.round(score / total * 1000) / 10 : 0, passed = total > 0 && pct >= num_(setting_('passPercent'), 80);
    var patch = { attempt_id: a.attempt_id, status: 'SUBMITTED', submitted_at: nowIso_(), answers: JSON.stringify(ans), score: String(score), total: String(total), percent: String(pct), passed: String(passed) };
    var cert = null;
    if (passed) { cert = issueCertRow_(T_('Users').get(c.uid), a.attempt_id, todayYmd_(), c.user.email); patch.cert_no = cert.cert_no; }
    t.upsert(patch);
    audit_(c.user.email, 'EXAM_SUBMIT', a.attempt_id, score + '/' + total + (passed ? ' ผ่าน ' + cert.cert_no : ' ไม่ผ่าน'));
    return { score: score, total: total, percent: pct, passed: passed, passPercent: num_(setting_('passPercent'), 80), cert: cert, review: bool_(setting_('showReview')) ? review : null };
  });
  if (res.cert) {   // สร้างไฟล์ใบเซอร์ + อีเมล นอกล็อก (ใช้เวลาหลายวินาที)
    var cert = res.cert, u = T_('Users').get(c.uid), file = null;
    try { file = ensureCertFile_(cert); } catch (e) { console.warn('cert gen ' + e.message); }
    var att = file && bool_(setting_('attachCert')) ? [file.getBlob()] : null;
    sendMail_(u.email, 'PASSED', { name: fullName_(u), score: res.score + '/' + res.total + ' (' + res.percent + '%)', certNo: cert.cert_no, expire: thDate_(cert.expire_date), attached: !!att }, att);
    res.cert = { no: cert.cert_no, issued: cert.issued_date, expire: cert.expire_date };
  }
  return res;
}
function myResults_(c) { return T_('Attempts').all().filter(function (a) { return a.user_id === c.uid && a.status === 'SUBMITTED'; }).map(attemptPublic_).reverse(); }

/* ---------------------------------------------------------------- ผู้ดูแล: คลังข้อสอบ */
function qPublic_(q) { return { id: q.q_id, sort: num_(q.sort), sop: q.sop_ref, text: q.text, options: parseJson_(q.options, []), answer: q.answer === '' ? -1 : num_(q.answer, -1), verified: bool_(q.answer_verified), active: bool_(q.active), explain: q.explain, updatedAt: q.updated_at, updatedBy: q.updated_by }; }
function listQuestions_() {
  var qs = questions_(true).map(qPublic_), stat = {};
  T_('Attempts').all().forEach(function (a) {   // สถิติตอบถูกรายข้อ (ช่วยหาข้อที่เฉลยอาจผิด)
    if (a.status !== 'SUBMITTED') return;
    var ids = parseJson_(a.q_ids, []), perm = parseJson_(a.perm, []), ans = parseJson_(a.answers, []);
    ids.forEach(function (id, i) { var s = stat[id] || (stat[id] = { n: 0, right: 0, picks: {} }); s.n++; var pick = ans[i] == null ? -1 : +ans[i]; var orig = pick >= 0 ? (perm[i] || [])[pick] : -1; s.picks[orig] = (s.picks[orig] || 0) + 1; });
  });
  qs.forEach(function (q) { var s = stat[q.id]; if (s) { q.stat = { n: s.n, right: s.picks[q.answer] || 0, picks: s.picks }; } });
  return { questions: qs, unverified: qs.filter(function (q) { return q.active && !q.verified; }).length, examCount: examCount_() };
}
function saveQuestion_(c, p) {
  return withLock_(function () {
    var t = T_('Questions'), id = str_(p.id) || newId_('Q'), old = t.get(id) || {};
    if (p.remove) { t.upsert({ q_id: id, active: 'false', updated_at: nowIso_(), updated_by: c.user.email }); audit_(c.user.email, 'Q_DISABLE', id, ''); return listQuestions_(); }
    var opts = (p.options || []).map(str_).filter(String);
    if (!str_(p.text)) throw new Error('กรุณาพิมพ์คำถาม');
    if (opts.length < 2) throw new Error('ต้องมีตัวเลือกอย่างน้อย 2 ข้อ');
    var ans = num_(p.answer, -1);
    if (ans < 0 || ans >= opts.length) throw new Error('กรุณาเลือกคำตอบที่ถูกต้อง');
    var row = { q_id: id, sort: String(p.sort != null && p.sort !== '' ? num_(p.sort) : (old.sort || t.all().length + 1)), sop_ref: str_(p.sop), text: str_(p.text), options: JSON.stringify(opts), answer: String(ans), answer_verified: String(p.verified !== false), active: String(p.active !== false), explain: str_(p.explain), updated_at: nowIso_(), updated_by: c.user.email };
    t.upsert(row);
    audit_(c.user.email, old.q_id ? 'Q_EDIT' : 'Q_ADD', id, 'เฉลย ' + OPT_LABEL[ans] + (old.q_id && old.answer !== row.answer ? ' (เดิม ' + OPT_LABEL[+old.answer] + ')' : ''));
    return listQuestions_();
  });
}
/** นำเข้าหลายข้อ: rows = [{sop, text, options:[...], answer (0-based หรือ ก-จ), explain}] */
function importQuestions_(c, p) {
  var rows = p.rows || [];
  if (!rows.length) throw new Error('ไม่มีข้อสอบที่จะนำเข้า');
  return withLock_(function () {
    var t = T_('Questions'), base = t.all().length, list = [];
    rows.forEach(function (r, i) {
      var opts = (r.options || []).map(str_).filter(String), a = str_(r.answer), ans = OPT_LABEL.indexOf(a) >= 0 ? OPT_LABEL.indexOf(a) : (a === '' ? -1 : num_(a, -1));
      if (!str_(r.text) || opts.length < 2) throw new Error('แถวที่ ' + (i + 1) + ': ต้องมีคำถามและตัวเลือกอย่างน้อย 2 ข้อ');
      var verified = ans >= 0 && ans < opts.length;
      list.push({ q_id: newId_('Q') + i, sort: String(base + i + 1), sop_ref: str_(r.sop), text: str_(r.text), options: JSON.stringify(opts), answer: String(verified ? ans : Math.floor(Math.random() * opts.length)), answer_verified: String(verified), active: 'true', explain: str_(r.explain), updated_at: nowIso_(), updated_by: c.user.email });
    });
    t.upsertMany(list);
    audit_(c.user.email, 'Q_IMPORT', '', list.length + ' ข้อ');
    return listQuestions_();
  });
}
