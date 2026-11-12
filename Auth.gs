/**
 * Auth.gs : บัญชีกลาง (One-key) — อีเมล + รหัสผ่าน ใช้ร่วมกับทุกระบบ IRB ในอนาคต
 *  - รหัสผ่าน: SHA-256 วนซ้ำ 1,000 รอบ + salt รายคน + pepper (Script Properties: PW_PEPPER สร้างอัตโนมัติ)
 *  - Token เข้าสู่ระบบ: payload.signature (HMAC-SHA256 ด้วย TOKEN_SECRET) ไม่ต้องเขียนชีททุกครั้ง
 *    ใน payload มี token_ver → เปลี่ยนรหัสผ่าน/ออกจากทุกเครื่อง = token เดิมทุกใบใช้ไม่ได้ทันที
 *  - ผิดเกิน maxFail ครั้ง พักบัญชี lockMinutes นาที
 *  - ลิงก์ตั้งรหัสผ่าน (เชิญ/ลืมรหัส): เก็บเฉพาะ hash ของ token ในชีท Tokens · ใช้ได้ครั้งเดียว
 * สถานะบัญชี: PENDING (ยังไม่ตั้งรหัส) · ACTIVE · DISABLED
 */
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function secretProp_(k) {
  var p = PropertiesService.getScriptProperties(), s = p.getProperty(k);
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty(k, s); }
  return s;
}
function b64u_(s) { return Utilities.base64EncodeWebSafe(s, Utilities.Charset.UTF_8).replace(/=+$/, ''); }
function unb64u_(s) { while (s.length % 4) s += '='; return Utilities.newBlob(Utilities.base64DecodeWebSafe(s)).getDataAsString('UTF-8'); }
function hex_(bytes) { return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }
function sha_(s) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)); }
function sign_(body) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, secretProp_('TOKEN_SECRET'))).replace(/=+$/, ''); }
function hashPw_(pw, salt) {
  var h = salt + '|' + secretProp_('PW_PEPPER') + '|' + pw;
  for (var i = 0; i < 1000; i++) h = sha_(h + salt);
  return h;
}
function randHex_(n) { var s = ''; while (s.length < n) s += Utilities.getUuid().replace(/-/g, ''); return s.slice(0, n); }
function checkPwPolicy_(pw) {
  pw = String(pw || '');
  if (pw.length < 8) throw new Error('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw new Error('รหัสผ่านต้องมีทั้งตัวอักษรภาษาอังกฤษและตัวเลข');
}

/* ---------------------------------------------------------------- token เข้าสู่ระบบ */
function issueToken_(u, remember) {
  var hours = remember ? num_(setting_('rememberDays'), 14) * 24 : num_(setting_('sessionHours'), 12);
  var body = b64u_(JSON.stringify({ u: u.user_id, v: +u.token_ver || 0, e: Date.now() + hours * 3600000 }));
  return body + '.' + sign_(body);
}
function ctx_(token) {
  if (!token) throw new Error('SESSION_EXPIRED');
  var parts = String(token).split('.');
  if (parts.length !== 2 || sign_(parts[0]) !== parts[1]) throw new Error('SESSION_EXPIRED');
  var p = parseJson_(unb64u_(parts[0]), null);
  if (!p || !p.u || p.e < Date.now()) throw new Error('SESSION_EXPIRED');
  var u = T_('Users').get(p.u);
  if (!u || u.status !== 'ACTIVE' || (+u.token_ver || 0) !== p.v) throw new Error('SESSION_EXPIRED');
  return { uid: u.user_id, user: u, roles: rolesOf_(u), name: fullName_(u) };
}
function rolesOf_(u) { return str_(u.roles).split(/[,\s]+/).filter(String).map(function (r) { return r.toUpperCase(); }); }
function isAdmin_(c) { return c.roles.indexOf(ROLE.ADMIN) >= 0; }
function requireRole_(c, roles) {
  for (var i = 0; i < roles.length; i++) if (c.roles.indexOf(roles[i]) >= 0) return true;
  throw new Error('ท่านไม่มีสิทธิ์ใช้งานส่วนนี้');
}
function findUserByEmail_(email) {
  var e = str_(email).toLowerCase(); if (!e) return null;
  return T_('Users').all().filter(function (u) { return str_(u.email).toLowerCase() === e; })[0] || null;
}

/* ---------------------------------------------------------------- เข้าสู่ระบบ */
function login_(p) {
  var email = str_(p.email).toLowerCase(), pw = String(p.password || '');
  if (!email || !pw) throw new Error('กรุณากรอกอีเมลและรหัสผ่าน');
  return withLock_(function () {
    var u = findUserByEmail_(email), bad = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    if (!u) { audit_(email, 'LOGIN_FAIL', '', 'ไม่พบอีเมล'); throw new Error(bad); }
    if (u.status === 'DISABLED') throw new Error('บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อ' + setting_('officeName'));
    if (u.locked_until && secsSince_(u.locked_until) < 0) {
      throw new Error('บัญชีถูกพักชั่วคราวจากการกรอกรหัสผิดหลายครั้ง กรุณารออีก ' + Math.ceil(-secsSince_(u.locked_until) / 60) + ' นาที');
    }
    if (!u.pw_hash) throw new Error('ท่านยังไม่ได้ตั้งรหัสผ่าน กรุณาใช้ลิงก์ตั้งรหัสผ่านในอีเมล หรือกด "ลืมรหัสผ่าน"');
    if (hashPw_(pw, u.pw_salt) !== u.pw_hash) {
      var n = (+u.fail_count || 0) + 1, max = num_(setting_('maxFail'), 5), patch = { user_id: u.user_id, fail_count: String(n) };
      if (n >= max) { patch.fail_count = '0'; patch.locked_until = isoPlus_(num_(setting_('lockMinutes'), 15) * 60); }
      T_('Users').upsert(patch);
      audit_(email, 'LOGIN_FAIL', u.user_id, 'ครั้งที่ ' + n);
      throw new Error(n >= max ? 'กรอกรหัสผิดครบ ' + max + ' ครั้ง ระบบพักบัญชี ' + setting_('lockMinutes') + ' นาที' : bad + ' (เหลืออีก ' + (max - n) + ' ครั้ง)');
    }
    T_('Users').upsert({ user_id: u.user_id, fail_count: '0', locked_until: '', last_login: nowIso_() });
    audit_(email, 'LOGIN', u.user_id, '');
    var fresh = T_('Users').get(u.user_id);
    return { token: issueToken_(fresh, !!p.remember), me: meOf_(fresh) };
  });
}
function meOf_(u) {
  return { id: u.user_id, email: u.email, name: fullName_(u), prefix: u.prefix, firstName: u.first_name, lastName: u.last_name, group: u.group, groupTh: GROUPS[u.group] || u.group, boardRole: u.board_role, position: u.position, department: u.department, roles: rolesOf_(u) };
}
function bootstrap_(c) {
  var s = settings_();
  return {
    me: meOf_(c.user), build: APP.BUILD, buildTh: APP.BUILD_TH,
    settings: { orgName: s.orgName, officeName: s.officeName, courseName: s.courseName, announce: s.announce, watchPercent: num_(s.watchPercent, 90), noSkip: bool_(s.noSkip), sequential: bool_(s.sequential), requireAll: bool_(s.requireAll), allowSpeed: num_(s.allowSpeed, 1.5), passPercent: num_(s.passPercent, 80), timeLimitMin: num_(s.timeLimitMin, 0), contact: s.contact, mailMode: isAdmin_(c) ? s.mailMode : undefined },
    groups: GROUPS
  };
}
/** ออกจากระบบ · all = ออกจากทุกเครื่อง (เพิ่ม token_ver) */
function logout_(c, p) {
  if (p && p.all) withLock_(function () { T_('Users').upsert({ user_id: c.uid, token_ver: String((+c.user.token_ver || 0) + 1) }); });
  audit_(c.user.email, p && p.all ? 'LOGOUT_ALL' : 'LOGOUT', c.uid, '');
  return true;
}
function changePassword_(c, p) {
  if (hashPw_(String(p.oldPassword || ''), c.user.pw_salt) !== c.user.pw_hash) throw new Error('รหัสผ่านเดิมไม่ถูกต้อง');
  checkPwPolicy_(p.newPassword);
  return withLock_(function () {
    var salt = randHex_(24), ver = (+c.user.token_ver || 0) + 1;
    T_('Users').upsert({ user_id: c.uid, pw_salt: salt, pw_hash: hashPw_(String(p.newPassword), salt), token_ver: String(ver), updated_at: nowIso_() });
    audit_(c.user.email, 'CHANGE_PW', c.uid, 'ออกจากระบบทุกเครื่อง');
    return { token: issueToken_(T_('Users').get(c.uid), false) };
  });
}

/* ---------------------------------------------------------------- ลิงก์ตั้งรหัสผ่าน (เชิญ / ลืมรหัส) */
/** สร้างลิงก์ใหม่ (ยกเลิกลิงก์เดิมของคนนั้น) · คืน URL เต็ม */
function makeSetLink_(u, purpose, by) {
  var raw = randHex_(40), days = num_(setting_('inviteDays'), 7);
  var t = T_('Tokens');
  t.all().filter(function (r) { return r.user_id === u.user_id && !r.used_at; }).forEach(function (r) { t.upsert({ token_hash: r.token_hash, used_at: 'ยกเลิก ' + nowIso_() }); });
  t.upsert({ token_hash: sha_(raw), user_id: u.user_id, purpose: purpose, expires_at: isoPlus_(days * 86400), used_at: '', created_at: nowIso_(), created_by: by || '' });
  return siteUrl_() + '#/set-password?t=' + raw;
}
function siteUrl_() { var s = str_(setting_('siteUrl')); return s.charAt(s.length - 1) === '/' ? s : s + '/'; }
function tokenRow_(raw) {
  var r = T_('Tokens').get(sha_(String(raw || '')));
  if (!r || r.used_at) throw new Error('ลิงก์นี้ใช้ไปแล้วหรือไม่ถูกต้อง กรุณากด "ลืมรหัสผ่าน" เพื่อขอลิงก์ใหม่');
  if (secsSince_(r.expires_at) > 0) throw new Error('ลิงก์หมดอายุแล้ว กรุณากด "ลืมรหัสผ่าน" เพื่อขอลิงก์ใหม่');
  var u = T_('Users').get(r.user_id);
  if (!u || u.status === 'DISABLED') throw new Error('บัญชีนี้ใช้งานไม่ได้ กรุณาติดต่อ' + setting_('officeName'));
  return { row: r, user: u };
}
function checkSetToken_(p) { var x = tokenRow_(p.t); return { name: fullName_(x.user), email: x.user.email, purpose: x.row.purpose }; }
function setPassword_(p) {
  checkPwPolicy_(p.password);
  return withLock_(function () {
    var x = tokenRow_(p.t), u = x.user, salt = randHex_(24);
    T_('Users').upsert({ user_id: u.user_id, pw_salt: salt, pw_hash: hashPw_(String(p.password), salt), status: 'ACTIVE', token_ver: String((+u.token_ver || 0) + 1), fail_count: '0', locked_until: '', updated_at: nowIso_() });
    T_('Tokens').upsert({ token_hash: x.row.token_hash, used_at: nowIso_() });
    audit_(u.email, 'SET_PW', u.user_id, x.row.purpose);
    var fresh = T_('Users').get(u.user_id);
    return { token: issueToken_(fresh, false), me: meOf_(fresh) };
  });
}
/** ลืมรหัสผ่าน: ตอบข้อความเดียวกันเสมอ (ไม่บอกว่ามีอีเมลนี้ในระบบหรือไม่) */
function forgotPassword_(p) {
  var email = str_(p.email).toLowerCase(), msg = 'หากอีเมลนี้อยู่ในระบบ ท่านจะได้รับลิงก์ตั้งรหัสผ่านใหม่ภายในไม่กี่นาที (ตรวจในกล่องจดหมายขยะด้วย) หากไม่ได้รับ กรุณาติดต่อ' + setting_('officeName');
  if (!emailOk_(email)) throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
  withLock_(function () {
    var u = findUserByEmail_(email);
    if (!u || u.status === 'DISABLED') { audit_(email, 'FORGOT_PW', '', 'ไม่พบ/ปิดใช้'); return; }
    var link = makeSetLink_(u, 'RESET', 'self');
    sendMail_(u.email, 'RESET', { name: fullName_(u), link: link, days: setting_('inviteDays') });
    audit_(email, 'FORGOT_PW', u.user_id, '');
  });
  return { message: msg };
}
