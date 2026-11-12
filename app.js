/* QSMH IRB · SOP Training — app.js : แกนกลาง (เรียกหลังบ้าน · บัญชีกลาง One-key · เส้นทาง · โครงหน้า · UI กลาง · หน้าเข้าสู่ระบบ)
 * เลขรุ่นต้องตรงกับ Config.gs (APP.BUILD) และ version.json
 * token เก็บใน localStorage คีย์ qsmhirb.token — ทุกระบบที่อยู่ใต้ researchsomdej.github.io ใช้ร่วมกันได้ (เข้าระบบครั้งเดียว) */
var IRB_BUILD = '2569-11-13.1';
var TOKEN_KEY = 'qsmhirb.token';
var S = { token: null, boot: null, me: null, brand: null, cache: {} };

/* =================================================================== ตัวช่วย */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function nf(n) { return (+n || 0).toLocaleString('th-TH'); }
var TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
var TH_MONF = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
function thDate(iso, time) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/); if (!m) return '-'; var s = (+m[3]) + ' ' + TH_MON[+m[2] - 1] + ' ' + (+m[1] + 543); return time && m[4] ? s + ' ' + m[4] + ':' + m[5] + ' น.' : s; }
function thDateFull(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? (+m[3]) + ' ' + TH_MONF[+m[2] - 1] + ' ' + (+m[1] + 543) : '-'; }
function mmss(sec) { sec = Math.max(0, Math.round(sec || 0)); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + ('0' + m).slice(-2) : m) + ':' + ('0' + s).slice(-2); }
function debounce(fn, ms) { var t; return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); }; }
function isAdmin() { return S.me && S.me.roles.indexOf('ADMIN') >= 0; }
function qs(name) { var m = location.hash.match(new RegExp('[?&]' + name + '=([^&]*)')); return m ? decodeURIComponent(m[1]) : ''; }
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }

var ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5z"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
  exam: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  cert: '<circle cx="12" cy="9" r="6"/><path d="m8.5 13.5-1.5 7.5 5-3 5 3-1.5-7.5"/><path d="m9.8 9 1.5 1.5 3-3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.6.2 4.4 2 5 5"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  video: '<rect x="2.5" y="5" width="14" height="14" rx="2"/><path d="m16.5 10 5-3v10l-5-3"/>',
  quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
  mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="m3 6 9 7 9-7"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>', upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>', left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>', shield: '<path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
function ic(n, cls) { return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || '') + '</svg>'; }

/* =================================================================== เรียกหลังบ้าน */
var READ_RE = /^(get|list|my|bootstrap|branding|ping|check|verify|admin)/;
function api(action, payload, opt) {
  opt = opt || {};
  var tries = READ_RE.test(action) ? 3 : 1;
  function once(n) {
    return fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: action, token: S.token, payload: payload || {} }), credentials: 'omit', redirect: 'follow' })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        if (t.charAt(0) === '<') throw new Error('BUSY');
        var j = JSON.parse(t);
        if (!j.ok) {
          if (j.error === 'SESSION_EXPIRED') { if (!opt.quietAuth) { logoutLocal(); toast('หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง', 'bad'); go('#/login'); } throw new Error('SESSION_EXPIRED'); }
          throw new Error(j.error);
        }
        return j.data;
      })
      .catch(function (e) {
        var net = e.message === 'BUSY' || e.name === 'TypeError' || /JSON|Failed to fetch|NetworkError|Load failed/.test(e.message);
        if (net && n < tries) return new Promise(function (ok) { setTimeout(ok, 900 * n); }).then(function () { return once(n + 1); });
        if (net) throw new Error(e.message === 'BUSY' ? 'เซิร์ฟเวอร์ Google ไม่ว่างชั่วคราว กรุณาลองใหม่อีกครั้ง' : 'เชื่อมต่อระบบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
        throw e;
      });
  }
  return once(1);
}
function logoutLocal() { S.token = null; S.me = null; S.boot = null; S.cache = {}; store(TOKEN_KEY, null); }

/* =================================================================== UI กลาง */
function toast(msg, kind) {
  var el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = msg;
  $('#toasts').appendChild(el); setTimeout(function () { el.remove(); }, kind === 'bad' ? 6500 : 3800);
}
function modal(o) {
  var bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = '<div class="modal ' + (o.wide ? 'wide' : '') + '" role="dialog" aria-modal="true"><div class="mh"><h3>' + esc(o.title || '') + '</h3><button class="btn ghost sm" data-x aria-label="ปิด">' + ic('x') + '</button></div><div class="mb">' + (o.body || '') + '</div>' +
    (o.foot !== false ? '<div class="mf">' + (o.foot || '<button class="btn" data-x>ปิด</button>') + '</div>' : '') + '</div>';
  document.body.appendChild(bg);
  function close() { bg.remove(); document.removeEventListener('keydown', key); if (o.onClose) o.onClose(); }
  function key(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', key);
  bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-x]')) close(); });
  var root = bg.querySelector('.modal');
  if (o.onMount) o.onMount(root, close);
  return { root: root, close: close };
}
function confirmBox(title, html, okText, danger) {
  return new Promise(function (res) {
    var done = false;
    var m = modal({ title: title, body: '<div>' + html + '</div>', foot: '<button class="btn" data-x>ยกเลิก</button><button class="btn ' + (danger ? 'danger' : 'pri') + '" data-ok>' + esc(okText || 'ยืนยัน') + '</button>', onClose: function () { if (!done) res(false); } });
    m.root.querySelector('[data-ok]').onclick = function () { done = true; m.close(); res(true); };
  });
}
/** ปุ่มกำลังทำงาน: busy(btn, promise) */
function busy(btn, p) {
  if (!btn) return p;
  var html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin" style="width:16px;height:16px;border-width:2px"></span> ' + (btn.dataset.busy || 'กำลังทำงาน…');
  return p.finally(function () { btn.disabled = false; btn.innerHTML = html; });
}
function fail(e) { if (e && e.message !== 'SESSION_EXPIRED') toast(e.message || String(e), 'bad'); }
function loading(el, msg) { el.innerHTML = '<div class="empty"><span class="spin"></span><div style="margin-top:10px">' + esc(msg || 'กำลังโหลด…') + '</div></div>'; }
function copyText(t) {
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('คัดลอกแล้ว', 'ok'); })
    .catch(function () { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('คัดลอกแล้ว', 'ok'); } catch (e) { } ta.remove(); });
}
function downloadB64(d) {
  var bin = atob(d.b64), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  var url = URL.createObjectURL(new Blob([arr], { type: d.mime || 'application/octet-stream' })), a = document.createElement('a');
  a.href = url; a.download = d.name || 'file'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 60000);
}
function downloadCsv(name, rows) {
  var csv = rows.map(function (r) { return r.map(function (c) { c = String(c == null ? '' : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\r\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function pwInput(name, ph, auto) { return '<div class="pw"><input type="password" name="' + name + '" placeholder="' + esc(ph || '') + '" autocomplete="' + (auto || 'current-password') + '" required><button type="button" tabindex="-1" aria-label="แสดงรหัสผ่าน" onclick="var i=this.previousElementSibling;i.type=i.type===\'password\'?\'text\':\'password\'">' + ic('eye') + '</button></div>'; }
var CERT_BADGE = { VALID: ['ok', 'ผ่านแล้ว · ใช้ได้'], SOON: ['warn', 'ใกล้หมดอายุ'], EXPIRED: ['bad', 'หมดอายุ'], NONE: ['', 'ยังไม่ผ่าน'], REVOKED: ['bad', 'ยกเลิก'], REPLACED: ['', 'มีฉบับใหม่แทน'] };
function certBadge(st) { var b = CERT_BADGE[st] || ['', st]; return '<span class="badge ' + b[0] + '">' + b[1] + '</span>'; }

/* =================================================================== เส้นทาง */
var ROUTES = {};
function route(path, fn, opt) { ROUTES[path] = { fn: fn, opt: opt || {} }; }
function go(h) { if (location.hash === h) render(); else location.hash = h; }
var LEAVE = [];   // ฟังก์ชันที่ต้องเรียกก่อนออกจากหน้า (เช่น ส่ง heartbeat สุดท้าย)
function onLeave(fn) { LEAVE.push(fn); }
function render() {
  while (LEAVE.length) { try { LEAVE.pop()(); } catch (e) { } }
  var h = location.hash || '#/home', path = h.replace(/^#/, '').split('?')[0], parts = path.split('/').filter(String);
  var key = '/' + parts.slice(0, 2).join('/'), r = ROUTES['/' + parts.join('/')] || ROUTES[key] || ROUTES['/' + parts[0]];
  if (!r) { go('#/home'); return; }
  if (r.opt.public) { r.fn(parts); return; }
  if (!S.token) { store('qsmhirb.after', h); go('#/login'); return; }
  if (!S.boot) { boot().then(render).catch(function (e) { if (e.message !== 'SESSION_EXPIRED') { fail(e); showFatal(e.message); } }); return; }
  if (r.opt.admin && !isAdmin()) { go('#/home'); return; }
  layout(path);
  var main = $('#main'); window.scrollTo(0, 0);
  try { r.fn(main, parts); } catch (e) { fail(e); }
}
function boot() { return api('bootstrap').then(function (b) { S.boot = b; S.me = b.me; checkBuild(b.build); }); }
function checkBuild(apiBuild) {
  var old = $('#buildbar'); if (old) old.remove();
  if (apiBuild && apiBuild !== IRB_BUILD && isAdmin()) {
    var d = document.createElement('div'); d.id = 'buildbar'; d.className = 'banner';
    d.innerHTML = 'รุ่นหน้าเว็บ ' + esc(IRB_BUILD) + ' ไม่ตรงกับหลังบ้าน ' + esc(apiBuild) + ' — ตรวจว่าได้ Deploy › New version ใน Apps Script และอัปโหลดไฟล์หน้าเว็บครบ';
    document.body.insertBefore(d, document.body.firstChild);
  }
}
function showFatal(msg) { $('#app').innerHTML = '<div class="verify"><div class="card"><h2>' + ic('alert') + ' เปิดระบบไม่สำเร็จ</h2><p>' + esc(msg) + '</p><button class="btn pri" onclick="location.reload()">ลองใหม่</button> <button class="btn" onclick="logoutLocal();location.hash=\'#/login\';location.reload()">เข้าสู่ระบบใหม่</button></div></div>'; }

/* =================================================================== โครงหน้า */
function navItems() {
  var L = [['#/home', 'home', 'หน้าหลัก'], ['#/learn', 'play', 'บทเรียน SOP'], ['#/exam', 'exam', 'แบบทดสอบ'], ['#/cert', 'cert', 'ใบประกาศนียบัตร'], ['#/me', 'user', 'บัญชีของฉัน']];
  var A = [['#/admin', 'chart', 'ภาพรวม'], ['#/admin/users', 'users', 'ทะเบียนผู้เรียน'], ['#/admin/modules', 'video', 'บทเรียน/วิดีโอ'], ['#/admin/questions', 'quiz', 'คลังข้อสอบ'], ['#/admin/certs', 'cert', 'ใบเซอร์ที่ออก'], ['#/admin/mail', 'mail', 'อีเมล'], ['#/admin/settings', 'settings', 'ตั้งค่า'], ['#/admin/audit', 'history', 'บันทึกการใช้งาน']];
  return { L: L, A: isAdmin() ? A : [] };
}
function layout(path) {
  if (!$('#shell')) {
    var mm = S.boot.settings.mailMode;
    $('#app').innerHTML =
      '<header class="top"><button class="menu-btn" id="menuBtn" aria-label="เมนู">' + ic('menu') + '</button>' +
      '<a class="brand" href="#/home"><img src="icon-192.png" alt=""><div><b>SOP Training</b><span>คณะกรรมการจริยธรรมการวิจัยในมนุษย์</span></div></a><div class="sp"></div>' +
      (isAdmin() ? '<a class="chip-mail ' + esc(mm) + '" id="mailChip" href="#/admin/settings" title="โหมดส่งอีเมล">อีเมล: ' + ({ OFF: 'ปิด', TEST: 'ทดสอบ', ON: 'ส่งจริง' }[mm] || mm) + '</a>' : '') +
      '<div class="who">' + esc(S.me.name) + '<br><span style="opacity:.7">' + esc(S.me.groupTh || '') + '</span></div></header>' +
      '<div class="shell" id="shell"><nav class="side" id="side"></nav><div class="scrim" id="scrim"></div><main class="main" id="main"></main></div>';
    $('#menuBtn').onclick = function () { $('#side').classList.toggle('open'); $('#scrim').classList.toggle('open'); };
    $('#scrim').onclick = function () { $('#side').classList.remove('open'); $('#scrim').classList.remove('open'); };
  }
  var n = navItems(), cur = '#' + path, best = '';
  n.L.concat(n.A).forEach(function (x) { if (cur === x[0] || cur.indexOf(x[0] + '/') === 0) if (x[0].length > best.length) best = x[0]; });
  if (/^#\/admin\/user\//.test(cur)) best = '#/admin/users';
  var html = '<div class="sec">การเรียนของฉัน</div>' + n.L.map(function (x) { return '<a href="' + x[0] + '" class="' + (best === x[0] ? 'on' : '') + '">' + ic(x[1]) + esc(x[2]) + '</a>'; }).join('');
  if (n.A.length) html += '<div class="sec">ผู้ดูแลระบบ</div>' + n.A.map(function (x) { return '<a href="' + x[0] + '" class="' + (best === x[0] ? 'on' : '') + '">' + ic(x[1]) + esc(x[2]) + '</a>'; }).join('');
  html += '<div class="sec"></div><a href="#" id="logoutBtn">' + ic('logout') + 'ออกจากระบบ</a><div class="tiny mut" style="padding:14px 12px">รุ่น ' + esc(IRB_BUILD) + '</div>';
  $('#side').innerHTML = html; $('#side').classList.remove('open'); $('#scrim').classList.remove('open');
  $('#logoutBtn').onclick = function (e) { e.preventDefault(); api('logout', {}, { quietAuth: true }).catch(function () { }); logoutLocal(); location.hash = '#/login'; location.reload(); };
}
function refreshMailChip(mode) { var c = $('#mailChip'); if (!c) return; S.boot.settings.mailMode = mode; c.className = 'chip-mail ' + mode; c.textContent = 'อีเมล: ' + ({ OFF: 'ปิด', TEST: 'ทดสอบ', ON: 'ส่งจริง' }[mode] || mode); }

/* =================================================================== หน้าสาธารณะ */
function authShell(inner) {
  var b = S.brand || {};
  $('#app').innerHTML = '<div class="auth"><section class="art"><div><div class="logo"><img src="logo.jpg" alt="โรงพยาบาลสมเด็จพระบรมราชเทวี ณ ศรีราชา"></div>' +
    '<h1 style="margin-top:28px">ระบบอบรม SOP ออนไลน์<br>คณะกรรมการจริยธรรมการวิจัยในมนุษย์</h1><p>วิธีดำเนินการมาตรฐาน (SOP) ฉบับที่ 2 · ' + esc(b.orgName || 'โรงพยาบาลสมเด็จพระบรมราชเทวี ณ ศรีราชา') + '</p>' +
    '<ul style="margin-top:22px"><li>เรียนผ่านวิดีโอ 22 บท ตามลำดับ SOP</li><li>ทำแบบทดสอบออนไลน์หลังเรียนครบ</li><li>ผ่านเกณฑ์ รับใบประกาศนียบัตรทันที (อายุ 2 ปี)</li></ul></div>' +
    '<div class="foot small" style="opacity:.75;position:relative;z-index:1">' + esc(b.officeName || 'สำนักงานจริยธรรมการวิจัย') + ' · ' + esc(b.contact || '') + '</div></section>' +
    '<section class="pane"><div class="box">' + inner + '<p class="tiny mut" style="margin-top:26px">รุ่น ' + esc(IRB_BUILD) + ' · บัญชีนี้เป็นบัญชีกลางของระบบคณะกรรมการจริยธรรมการวิจัย ใช้รหัสผ่านเดียวกันทุกระบบ</p></div></section></div>';
}
function loadBrand() { if (S.brand) return Promise.resolve(S.brand); return api('branding').then(function (b) { S.brand = b; return b; }).catch(function () { return {}; }); }

route('/login', function () {
  if (S.token) { go('#/home'); return; }
  loadBrand().then(function (b) {
    authShell('<h2>เข้าสู่ระบบ</h2><p class="mut">ใช้อีเมลที่ลงทะเบียนไว้กับสำนักงานจริยธรรมการวิจัย</p>' +
      (b.maintenance ? '<div class="note warn">' + ic('alert') + '<div>ระบบปิดปรับปรุงชั่วคราว (ผู้ดูแลยังเข้าได้)</div></div>' : '') +
      '<form id="f"><label class="f"><span>อีเมล</span><input type="email" name="email" autocomplete="username" required></label>' +
      '<label class="f"><span>รหัสผ่าน</span>' + pwInput('password') + '</label>' +
      '<div class="row" style="justify-content:space-between;margin:-2px 0 16px"><label class="check small"><input type="checkbox" name="remember"> จดจำการเข้าสู่ระบบบนเครื่องนี้</label><a href="#/forgot" class="small">ลืมรหัสผ่าน?</a></div>' +
      '<button class="btn pri block lg" data-busy="กำลังเข้าสู่ระบบ…">' + ic('lock') + ' เข้าสู่ระบบ</button></form>' +
      '<div class="note" style="margin-top:18px">' + ic('info') + '<div class="small">ครั้งแรก: กรุณาใช้ลิงก์ "ตั้งรหัสผ่าน" ที่ได้รับทางอีเมล หรือกด "ลืมรหัสผ่าน" แล้วกรอกอีเมลของท่าน</div></div>');
    $('#f').onsubmit = function (e) {
      e.preventDefault(); var f = e.target;
      busy(f.querySelector('button.pri'), api('login', { email: f.email.value, password: f.password.value, remember: f.remember.checked })).then(function (d) {
        S.token = d.token; store(TOKEN_KEY, d.token); S.boot = null;
        var after = store('qsmhirb.after'); store('qsmhirb.after', null); go(after && !/login|set-password|forgot/.test(after) ? after : '#/home');
      }).catch(fail);
    };
  });
}, { public: true });

route('/forgot', function () {
  loadBrand().then(function () {
    authShell('<h2>ลืมรหัสผ่าน / ตั้งรหัสผ่านครั้งแรก</h2><p class="mut">กรอกอีเมลที่ลงทะเบียนไว้ ระบบจะส่งลิงก์ตั้งรหัสผ่านไปให้</p><form id="f"><label class="f"><span>อีเมล</span><input type="email" name="email" required></label><button class="btn pri block lg">' + ic('send') + ' ส่งลิงก์ตั้งรหัสผ่าน</button></form><p style="margin-top:16px"><a href="#/login">‹ กลับไปหน้าเข้าสู่ระบบ</a></p><div id="msg"></div>');
    $('#f').onsubmit = function (e) {
      e.preventDefault();
      busy(e.target.querySelector('button'), api('forgotPassword', { email: e.target.email.value })).then(function (d) { $('#msg').innerHTML = '<div class="note ok" style="margin-top:14px">' + ic('check') + '<div>' + esc(d.message) + '</div></div>'; }).catch(fail);
    };
  });
}, { public: true });

route('/set-password', function () {
  var t = qs('t');
  loadBrand().then(function () {
    authShell('<div id="sp"><div class="empty"><span class="spin"></span></div></div>');
    api('checkSetToken', { t: t }).then(function (d) {
      $('#sp').innerHTML = '<h2>' + (d.purpose === 'INVITE' ? 'ตั้งรหัสผ่านเพื่อเริ่มใช้งาน' : 'ตั้งรหัสผ่านใหม่') + '</h2><p class="mut">' + esc(d.name) + '<br>' + esc(d.email) + '</p>' +
        '<form id="f"><label class="f"><span>รหัสผ่านใหม่</span>' + pwInput('p1', '', 'new-password') + '<small>อย่างน้อย 8 ตัวอักษร มีทั้งตัวอักษรภาษาอังกฤษและตัวเลข</small></label>' +
        '<label class="f"><span>ยืนยันรหัสผ่าน</span>' + pwInput('p2', '', 'new-password') + '</label><button class="btn pri block lg">' + ic('check') + ' บันทึกรหัสผ่านและเข้าสู่ระบบ</button></form>';
      $('#f').onsubmit = function (e) {
        e.preventDefault(); var f = e.target;
        if (f.p1.value !== f.p2.value) { toast('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'bad'); return; }
        busy(f.querySelector('button'), api('setPassword', { t: t, password: f.p1.value })).then(function (r) {
          S.token = r.token; store(TOKEN_KEY, r.token); S.boot = null; toast('ตั้งรหัสผ่านเรียบร้อย ยินดีต้อนรับ', 'ok'); history.replaceState(null, '', location.pathname + '#/home'); render();
        }).catch(fail);
      };
    }).catch(function (e) { $('#sp').innerHTML = '<h2>ลิงก์ใช้งานไม่ได้</h2><div class="note bad">' + ic('alert') + '<div>' + esc(e.message) + '</div></div><a class="btn pri" href="#/forgot">ขอลิงก์ใหม่</a>'; });
  });
}, { public: true });

route('/verify', function () {
  var no = qs('no');
  $('#app').innerHTML = '<div class="verify"><div style="text-align:center;margin-bottom:18px"><img src="logo.jpg" alt="" style="height:70px"></div><div class="card" id="v"><h2>' + ic('shield') + ' ตรวจสอบใบประกาศนียบัตร</h2><form id="f" class="row"><input type="text" name="no" placeholder="เลขที่ เช่น SOP-2569/001" value="' + esc(no) + '" style="flex:1"><button class="btn pri">ตรวจสอบ</button></form><div id="vr" style="margin-top:16px"></div></div></div>';
  function check(n) {
    if (!n) return; loading($('#vr'), 'กำลังตรวจสอบ…');
    api('verifyCert', { no: n }).then(function (d) {
      if (!d.found) { $('#vr').innerHTML = '<div class="note bad">' + ic('alert') + '<div>ไม่พบใบประกาศนียบัตรเลขที่ ' + esc(n) + ' ในระบบ</div></div>'; return; }
      var good = d.status === 'VALID' || d.status === 'SOON';
      $('#vr').innerHTML = '<div class="note ' + (good ? 'ok' : 'bad') + '">' + ic(good ? 'check' : 'alert') + '<div><b>' + (good ? 'ใบประกาศนียบัตรนี้ถูกต้องและยังใช้ได้' : 'ใบประกาศนียบัตรนี้ ' + esc(d.statusTh)) + '</b></div></div>' +
        '<dl class="kv"><dt>เลขที่</dt><dd>' + esc(d.no) + '</dd><dt>ชื่อ</dt><dd><b>' + esc(d.name) + '</b></dd><dt>หลักสูตร</dt><dd>' + esc(d.course) + '</dd><dt>วันที่ออก</dt><dd>' + thDateFull(d.issued) + '</dd><dt>ใช้ได้ถึง</dt><dd>' + thDateFull(d.expire) + '</dd><dt>ออกโดย</dt><dd>' + esc(d.org) + '</dd></dl>';
    }).catch(function (e) { $('#vr').innerHTML = '<div class="note bad">' + esc(e.message) + '</div>'; });
  }
  $('#f').onsubmit = function (e) { e.preventDefault(); check(e.target.no.value.trim()); };
  check(no);
}, { public: true });

/* =================================================================== เริ่มต้น */
window.addEventListener('hashchange', render);
document.addEventListener('DOMContentLoaded', function () {
  S.token = store(TOKEN_KEY) || null;
  var bs = $('#bootsplash'); if (bs) bs.remove();
  render();
});
