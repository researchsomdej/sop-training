/* QSMH IRB · SOP Training — pages-admin.js : หน้าผู้ดูแล
 * ภาพรวม · ทะเบียนผู้เรียน (เพิ่ม/นำเข้า/แก้ไข/ส่งลิงก์เชิญ) · รายละเอียดผู้เรียน · บทเรียน/วิดีโอ · คลังข้อสอบ · ใบเซอร์ · อีเมล · ตั้งค่า · บันทึกการใช้งาน */
var OPT_L = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ', 'ช', 'ซ'];
var ST_BADGE = { PENDING: 'warn', ACTIVE: 'ok', DISABLED: 'bad' };
function groupsOpts(sel) { var g = S.boot.groups; return Object.keys(g).map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(g[k]) + '</option>'; }).join(''); }
function progressCell(r) { var p = r.reqTotal ? Math.round(r.reqDone / r.reqTotal * 100) : 0; return '<div style="min-width:120px"><div class="small">' + r.reqDone + '/' + r.reqTotal + ' บท</div><div class="bar ' + (r.learnDone ? 'ok' : '') + '"><i style="width:' + p + '%"></i></div></div>'; }
function learnState(r) {
  if (r.cert.status === 'VALID' || r.cert.status === 'SOON') return 'PASSED';
  return r.learnDone ? 'READY' : r.done > 0 ? 'LEARNING' : r.status === 'PENDING' ? 'NOACC' : 'NOTSTART';
}
var LS_TH = { PASSED: 'ผ่านแล้ว', NOACC: 'ยังไม่ตั้งรหัสผ่าน', NOTSTART: 'ยังไม่เริ่มเรียน', LEARNING: 'กำลังเรียน', READY: 'เรียนครบ รอสอบ/สอบไม่ผ่าน' };

/* ---------------------------------------------------------------- ภาพรวม */
route('/admin', function (main) {
  loading(main);
  api('adminDashboard').then(function (d) {
    var sys = d.system, all = { total: 0, passed: 0, noAccount: 0, notStarted: 0, learning: 0, ready: 0, soon: 0, expired: 0 };
    d.groups.forEach(function (g) { Object.keys(all).forEach(function (k) { all[k] += g[k] || 0; }); });
    var checks = [
      [sys.youtube === sys.modules, 'วิดีโอเป็น YouTube ครบ ' + sys.youtube + '/' + sys.modules + ' บท', 'ตอนนี้ยังใช้ Google Drive ' + sys.drive + ' บท (กรรมการต้องมีสิทธิ์ดูไฟล์ใน Drive) — อัปโหลด YouTube แล้ววางลิงก์ในหน้า "บทเรียน/วิดีโอ"', '#/admin/modules'],
      [!sys.noDuration, 'วิดีโอ Drive มีความยาวครบ', sys.noDuration + ' บทยังไม่มีความยาว (จำเป็นสำหรับนับเวลา)', '#/admin/modules'],
      [!sys.unverified, 'ตั้งเฉลยข้อสอบครบแล้ว', 'เฉลยยังไม่ยืนยัน ' + sys.unverified + ' ข้อ (ตอนติดตั้งระบบสุ่มไว้) — ต้องตั้งก่อนเปิดให้สอบจริง', '#/admin/questions'],
      [sys.template, 'มีแม่แบบใบเซอร์แล้ว', 'ยังไม่มีแม่แบบใบเซอร์ — กด "สร้างแม่แบบใหม่" ในตั้งค่า › ใบเซอร์', '#/admin/settings'],
      [!sys.noEmail, 'ผู้เรียนมีอีเมลครบ', sys.noEmail + ' คนยังไม่มีอีเมล — เติมในทะเบียนผู้เรียน', '#/admin/users'],
      [sys.mailMode === 'ON', 'อีเมลเปิดส่งจริงแล้ว', 'อีเมลอยู่โหมด ' + ({ OFF: 'ปิด (ไม่ส่ง)', TEST: 'ทดสอบ' }[sys.mailMode] || sys.mailMode) + ' — เปิดเมื่อพร้อมใช้งานจริง', '#/admin/settings']
    ];
    main.innerHTML = '<div class="ph"><div class="t"><h1>ภาพรวมการอบรม SOP</h1><p>' + esc(S.boot.settings.courseName) + '</p></div><button class="btn" id="csv">' + ic('download') + ' ส่งออก CSV</button></div>' +
      '<div class="grid g4" style="margin-bottom:16px">' + stat(all.total, 'ผู้เรียนทั้งหมด', 'nv') + stat(all.passed, 'ผ่านแล้ว (' + (all.total ? Math.round(all.passed / all.total * 100) : 0) + '%)', 'ok') + stat(all.learning + all.ready, 'กำลังเรียน / รอสอบ', 'warn') + stat(all.notStarted + all.noAccount, 'ยังไม่เริ่ม (ยังไม่ตั้งรหัส ' + all.noAccount + ')', 'bad') + '</div>' +
      '<div class="grid g2"><div class="card"><h2>' + ic('users') + ' แยกตามกลุ่ม</h2><div class="tw"><table class="t"><tr><th>กลุ่ม</th><th class="num">ทั้งหมด</th><th class="num">ผ่าน</th><th class="num">ใกล้หมดอายุ</th><th class="num">ยังไม่ผ่าน</th></tr>' +
      d.groups.map(function (g) { return '<tr><td>' + esc(g.groupTh) + '</td><td class="num">' + g.total + '</td><td class="num" style="color:var(--ok)"><b>' + g.passed + '</b></td><td class="num">' + (g.soon || '-') + '</td><td class="num">' + (g.total - g.passed) + '</td></tr>'; }).join('') + '</table></div></div>' +
      '<div class="card"><h2>' + ic('shield') + ' ความพร้อมของระบบ</h2>' + checks.map(function (c) { return '<a href="' + c[3] + '" class="row" style="text-decoration:none;color:inherit;padding:6px 0;align-items:flex-start;flex-wrap:nowrap"><span class="badge ' + (c[0] ? 'ok' : 'warn') + '">' + ic(c[0] ? 'check' : 'alert') + '</span><span class="small">' + esc(c[0] ? c[1] : c[2]) + '</span></a>'; }).join('') + '</div></div>' +
      '<div class="card pad0"><div class="toolbar"><b style="margin-right:6px">ความก้าวหน้ารายบุคคล</b><input type="search" id="q" placeholder="ค้นหาชื่อ/อีเมล"><select id="fg"><option value="">ทุกกลุ่ม</option>' + groupsOpts('') + '</select><select id="fs"><option value="">ทุกสถานะ</option>' + Object.keys(LS_TH).map(function (k) { return '<option value="' + k + '">' + LS_TH[k] + '</option>'; }).join('') + '</select><div style="flex:1"></div>' +
      '<button class="btn sm" id="inv" disabled>' + ic('link') + ' ส่งลิงก์ตั้งรหัสผ่าน</button><button class="btn sm" id="rem" disabled>' + ic('send') + ' ส่งอีเมลเตือน</button></div><div class="tw" id="tb"></div></div>';
    function stat(n, l, c) { return '<div class="stat ' + c + '"><div class="n">' + nf(n) + '</div><div class="l">' + esc(l) + '</div></div>'; }
    var sel = {};
    function draw() {
      var q = $('#q').value.trim().toLowerCase(), fg = $('#fg').value, fs = $('#fs').value;
      var rows = d.rows.filter(function (r) { return (!q || (r.name + ' ' + r.email).toLowerCase().indexOf(q) >= 0) && (!fg || r.group === fg) && (!fs || learnState(r) === fs); });
      $('#tb').innerHTML = rows.length ? '<table class="t"><tr><th><input type="checkbox" id="all"></th><th>ชื่อ</th><th>กลุ่ม</th><th>การเรียน</th><th>สอบ</th><th>ใบเซอร์</th><th>ใช้งานล่าสุด</th></tr>' + rows.map(function (r) {
        return '<tr class="click" data-id="' + r.id + '"><td onclick="event.stopPropagation()"><input type="checkbox" data-s="' + r.id + '"' + (sel[r.id] ? ' checked' : '') + '></td><td><b>' + esc(r.name) + '</b><div class="tiny mut">' + esc(r.boardRole || '') + (r.email ? ' · ' + esc(r.email) : ' · <span style="color:var(--bad)">ไม่มีอีเมล</span>') + '</div></td><td class="small">' + esc(r.groupTh) + '</td><td>' + progressCell(r) + '</td>' +
          '<td class="small">' + (r.attempts ? r.attempts + ' ครั้ง · สูงสุด ' + r.best + '%' : '-') + '</td><td>' + (r.status === 'PENDING' ? '<span class="badge warn">ยังไม่ตั้งรหัส</span>' : certBadge(r.cert.status)) + (r.cert.expire ? '<div class="tiny mut">ถึง ' + thDate(r.cert.expire) + '</div>' : '') + '</td><td class="small mut">' + (r.lastActive ? thDate(r.lastActive, true) : r.lastLogin ? thDate(r.lastLogin, true) : '-') + '</td></tr>';
      }).join('') + '</table>' : '<div class="empty">ไม่พบผู้เรียนตามเงื่อนไข</div>';
      $$('#tb tr.click').forEach(function (tr) { tr.onclick = function () { go('#/admin/user/' + tr.dataset.id); }; });
      $$('#tb [data-s]').forEach(function (c) { c.onchange = function () { if (c.checked) sel[c.dataset.s] = 1; else delete sel[c.dataset.s]; btns(); }; });
      var a = $('#all'); if (a) a.onchange = function () { rows.forEach(function (r) { if (a.checked) sel[r.id] = 1; else delete sel[r.id]; }); draw(); btns(); };
    }
    function btns() { var n = Object.keys(sel).length; $('#inv').disabled = $('#rem').disabled = !n; $('#inv').innerHTML = ic('link') + ' ส่งลิงก์ตั้งรหัสผ่าน' + (n ? ' (' + n + ')' : ''); $('#rem').innerHTML = ic('send') + ' ส่งอีเมลเตือน' + (n ? ' (' + n + ')' : ''); }
    $('#q').oninput = debounce(draw, 200); $('#fg').onchange = $('#fs').onchange = draw; draw();
    $('#inv').onclick = function () { inviteFlow(Object.keys(sel)); };
    $('#rem').onclick = function () {
      var ids = Object.keys(sel);
      confirmBox('ส่งอีเมลเตือน', 'ส่งอีเมลเตือนให้เรียน/สอบ ' + ids.length + ' คน (ผู้ที่ผ่านแล้วจะข้าม) · โหมดอีเมลปัจจุบัน: <b>' + esc(S.boot.settings.mailMode) + '</b>', 'ส่งเตือน').then(function (ok) {
        if (ok) api('remindUsers', { ids: ids }).then(function (r) { modal({ title: 'ผลการส่งเตือน', body: '<table class="t">' + r.map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td>' + esc(x.mailTh) + '</td></tr>'; }).join('') + '</table>' }); }).catch(fail);
      });
    };
    $('#csv').onclick = function () {
      downloadCsv('ผลอบรมSOP_' + new Date().toISOString().slice(0, 10) + '.csv', [['ชื่อ', 'อีเมล', 'กลุ่ม', 'ตำแหน่งในคณะกรรมการ', 'บทที่เรียนแล้ว', 'บทบังคับ', 'สถานะ', 'สอบ (ครั้ง)', 'คะแนนสูงสุด %', 'เลขที่ใบเซอร์', 'วันที่ผ่าน', 'วันหมดอายุ']].concat(d.rows.map(function (r) {
        return [r.name, r.email, r.groupTh, r.boardRole, r.reqDone, r.reqTotal, LS_TH[learnState(r)], r.attempts, r.best == null ? '' : r.best, r.cert.no || '', r.cert.issued || '', r.cert.expire || ''];
      })));
    };
  }).catch(fail);
});

/** สร้างลิงก์เชิญ/ตั้งรหัสใหม่ แล้วแสดงลิงก์ให้คัดลอก (เผื่อส่งทาง LINE ระหว่างปิดอีเมล) */
function inviteFlow(ids) {
  var mode = S.boot.settings.mailMode;
  modal({
    title: 'ส่งลิงก์ตั้งรหัสผ่าน (' + ids.length + ' คน)',
    body: '<p>ระบบจะสร้างลิงก์ตั้งรหัสผ่านใหม่ (ลิงก์เดิมจะใช้ไม่ได้) · โหมดอีเมลตอนนี้: <b>' + ({ OFF: 'ปิด — ไม่ส่งอีเมล ให้คัดลอกลิงก์ไปส่งเอง', TEST: 'ทดสอบ — ส่งไปอีเมลทดสอบเท่านั้น', ON: 'ส่งจริงถึงผู้เรียน' }[mode]) + '</b></p><label class="check"><input type="checkbox" id="snd"' + (mode === 'OFF' ? '' : ' checked') + '> ส่งอีเมลตามโหมดปัจจุบัน</label><div id="res" style="margin-top:12px"></div>',
    foot: '<button class="btn" data-x>ปิด</button><button class="btn pri" id="go">' + ic('link') + ' สร้างลิงก์</button>',
    wide: true,
    onMount: function (root) {
      root.querySelector('#go').onclick = function () {
        var b = root.querySelector('#go');
        busy(b, api('inviteUsers', { ids: ids, send: root.querySelector('#snd').checked })).then(function (r) {
          b.remove();
          root.querySelector('#res').innerHTML = '<div class="tw"><table class="t"><tr><th>ชื่อ</th><th>อีเมล</th><th>ลิงก์ (ใช้ได้ครั้งเดียว)</th></tr>' + r.map(function (x) {
            return '<tr><td>' + esc(x.name) + '</td><td class="small">' + (x.error ? '<span class="badge bad">' + esc(x.error) + '</span>' : esc(x.email) + '<div class="tiny mut">' + esc(x.mailTh) + '</div>') + '</td><td>' + (x.link ? '<div class="copybox"><input type="text" readonly value="' + esc(x.link) + '"><button class="btn sm" data-c="' + esc(x.link) + '">' + ic('copy') + '</button></div>' : '') + '</td></tr>';
          }).join('') + '</table></div>';
          $$('[data-c]', root).forEach(function (c) { c.onclick = function () { copyText(c.dataset.c); }; });
        }).catch(fail);
      };
    }
  });
}

/* ---------------------------------------------------------------- ทะเบียนผู้เรียน */
route('/admin/users', function (main) {
  loading(main);
  api('listUsers').then(function (rows) {
    main.innerHTML = '<div class="ph"><div class="t"><h1>ทะเบียนผู้เรียน</h1><p>' + rows.length + ' บัญชี · บัญชีกลางใช้ร่วมกับทุกระบบของคณะกรรมการฯ</p></div><button class="btn" id="imp">' + ic('upload') + ' นำเข้ารายชื่อ</button><button class="btn pri" id="add">' + ic('plus') + ' เพิ่มผู้เรียน</button></div>' +
      '<div class="card pad0"><div class="toolbar"><input type="search" id="q" placeholder="ค้นหา"><select id="fg"><option value="">ทุกกลุ่ม</option>' + groupsOpts('') + '</select></div><div class="tw" id="tb"></div></div>';
    function draw() {
      var q = $('#q').value.trim().toLowerCase(), fg = $('#fg').value;
      var list = rows.filter(function (r) { return (!q || (r.name + r.email + r.boardRole + r.department).toLowerCase().indexOf(q) >= 0) && (!fg || r.group === fg); });
      $('#tb').innerHTML = '<table class="t"><tr><th>#</th><th>ชื่อ</th><th>กลุ่ม / ตำแหน่งในคณะกรรมการ</th><th>อีเมล</th><th>บัญชี</th><th></th></tr>' + list.map(function (r) {
        return '<tr class="click" data-id="' + r.id + '"><td class="small mut">' + (r.sort < 999 ? r.sort : '') + '</td><td><b>' + esc(r.name) + '</b><div class="tiny mut">' + esc([r.position, r.department].filter(Boolean).join(' · ')) + '</div></td><td class="small">' + esc(r.groupTh) + '<div class="tiny mut">' + esc(r.boardRole || '') + '</div></td><td class="small">' + (r.email ? esc(r.email) : '<span class="badge bad">ไม่มีอีเมล</span>') + '</td>' +
          '<td><span class="badge ' + (ST_BADGE[r.status] || '') + '">' + esc(r.statusTh) + '</span>' + (r.roles.indexOf('ADMIN') >= 0 ? ' <span class="badge gold">ผู้ดูแล</span>' : '') + '</td><td><button class="btn sm ghost" data-e="' + r.id + '">' + ic('edit') + '</button></td></tr>';
      }).join('') + '</table>';
      $$('#tb tr.click').forEach(function (tr) { tr.onclick = function (e) { if (e.target.closest('[data-e]')) { userForm(rows.filter(function (x) { return x.id === tr.dataset.id; })[0], function () { render(); }); return; } go('#/admin/user/' + tr.dataset.id); }; });
    }
    $('#q').oninput = debounce(draw, 200); $('#fg').onchange = draw; draw();
    $('#add').onclick = function () { userForm(null, function (u) { go('#/admin/user/' + u.id); }); };
    $('#imp').onclick = importUsersDialog;
  }).catch(fail);
});
function userForm(u, done) {
  u = u || { group: 'MAIN', roles: ['LEARNER'], sort: 999 };
  modal({
    title: u.id ? 'แก้ไขข้อมูลผู้เรียน' : 'เพิ่มผู้เรียน', wide: true,
    body: '<form id="uf"><div class="grid g3"><label class="f"><span>คำนำหน้า</span><input type="text" name="prefix" value="' + esc(u.prefix || '') + '" placeholder="นายแพทย์ / แพทย์หญิง / นาง"></label><label class="f"><span>ชื่อ *</span><input type="text" name="firstName" value="' + esc(u.firstName || '') + '" required></label><label class="f"><span>นามสกุล</span><input type="text" name="lastName" value="' + esc(u.lastName || '') + '"></label></div>' +
      '<div class="grid g2"><label class="f"><span>อีเมล (ใช้เข้าสู่ระบบ)</span><input type="email" name="email" value="' + esc(u.email || '') + '"><small>เว้นว่างได้ เติมภายหลังแล้วค่อยส่งลิงก์ตั้งรหัสผ่าน</small></label><label class="f"><span>กลุ่ม *</span><select name="group">' + groupsOpts(u.group) + '</select></label></div>' +
      '<div class="grid g3"><label class="f"><span>ตำแหน่งในคณะกรรมการ</span><input type="text" name="boardRole" value="' + esc(u.boardRole || '') + '" placeholder="ประธาน / กรรมการ / เลขานุการ"></label><label class="f"><span>ตำแหน่งงาน</span><input type="text" name="position" value="' + esc(u.position || '') + '"></label><label class="f"><span>ฝ่าย/หน่วยงาน</span><input type="text" name="department" value="' + esc(u.department || '') + '"></label></div>' +
      '<div class="grid g3"><label class="f"><span>ลำดับในคำสั่ง</span><input type="number" name="sort" value="' + (u.sort < 999 ? u.sort : '') + '"></label><label class="f"><span>หมายเหตุ</span><input type="text" name="note" value="' + esc(u.note || '') + '"></label><div></div></div>' +
      '<label class="check"><input type="checkbox" name="admin"' + (u.roles.indexOf('ADMIN') >= 0 ? ' checked' : '') + '> เป็นผู้ดูแลระบบ (เห็นข้อมูลทุกคน ตั้งค่าได้)</label>' +
      (u.id ? '<label class="check" style="margin-top:8px"><input type="checkbox" name="disabled"' + (u.status === 'DISABLED' ? ' checked' : '') + '> ปิดใช้งานบัญชี (เข้าสู่ระบบไม่ได้ · ไม่นับในภาพรวม)</label>' : '') + '</form>',
    foot: '<button class="btn" data-x>ยกเลิก</button><button class="btn pri" id="sv">บันทึก</button>',
    onMount: function (root, close) {
      root.querySelector('#sv').onclick = function () {
        var f = root.querySelector('#uf'), p = { id: u.id, prefix: f.prefix.value, firstName: f.firstName.value, lastName: f.lastName.value, email: f.email.value, group: f.group.value, boardRole: f.boardRole.value, position: f.position.value, department: f.department.value, sort: f.sort.value || 999, note: f.note.value, admin: f.admin.checked };
        if (u.id) p.disabled = f.disabled.checked;
        busy(root.querySelector('#sv'), api('saveUser', p)).then(function (r) { toast('บันทึกแล้ว', 'ok'); close(); done && done(r); }).catch(fail);
      };
    }
  });
}
function importUsersDialog() {
  modal({
    title: 'นำเข้ารายชื่อผู้เรียน', wide: true,
    body: '<p class="small">คัดลอกตารางจาก Excel (รวมแถวหัวตาราง) มาวางด้านล่าง · คอลัมน์ที่รู้จัก: <b>กลุ่ม</b> (คณะกรรมการหลัก / คณะกรรมการสมทบ / เจ้าหน้าที่สำนักงาน / ที่ปรึกษา / อื่น ๆ), <b>ลำดับ</b>, <b>ตำแหน่งในคณะกรรมการ</b>, <b>คำนำหน้า</b>, <b>ชื่อ</b>, <b>นามสกุล</b>, <b>ตำแหน่ง</b>, <b>ฝ่าย</b>, <b>อีเมล</b></p>' +
      '<p class="small mut">จับคู่คนเดิมด้วยอีเมล ถ้าไม่มีอีเมลจับคู่ด้วยชื่อ+นามสกุล · ไม่ลบใครออก · ไม่แตะรหัสผ่าน · แม่แบบอยู่ในโฟลเดอร์ 05_แม่แบบนำเข้าข้อมูล</p><textarea id="tsv" rows="10" placeholder="กลุ่ม&#9;ลำดับ&#9;ตำแหน่งในคณะกรรมการ&#9;คำนำหน้า&#9;ชื่อ&#9;นามสกุล&#9;ตำแหน่ง&#9;ฝ่าย&#9;อีเมล"></textarea><div id="pv" class="small" style="margin-top:8px"></div>',
    foot: '<button class="btn" data-x>ยกเลิก</button><button class="btn pri" id="go" disabled>นำเข้า</button>',
    onMount: function (root, close) {
      var rows = [];
      var MAP = { 'กลุ่ม': 'group', 'ลำดับ': 'sort', 'ตำแหน่งในคณะกรรมการ': 'boardRole', 'คำนำหน้า': 'prefix', 'ชื่อ': 'firstName', 'นามสกุล': 'lastName', 'ตำแหน่ง': 'position', 'ตำแหน่งงาน': 'position', 'ฝ่าย': 'department', 'สังกัด': 'department', 'อีเมล': 'email', 'email': 'email', 'e-mail': 'email' };
      root.querySelector('#tsv').oninput = function () {
        var lines = this.value.replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
        if (lines.length < 2) { rows = []; root.querySelector('#pv').textContent = ''; root.querySelector('#go').disabled = true; return; }
        var sep = lines[0].indexOf('\t') >= 0 ? '\t' : ',', head = lines[0].split(sep).map(function (h) { return MAP[h.trim().toLowerCase()] || MAP[h.trim()] || ''; });
        rows = lines.slice(1).map(function (l) { var c = l.split(sep), o = {}; head.forEach(function (h, i) { if (h) o[h] = (c[i] || '').trim(); }); return o; }).filter(function (o) { return o.firstName; });
        var miss = ['group', 'firstName'].filter(function (k) { return head.indexOf(k) < 0; });
        root.querySelector('#pv').innerHTML = miss.length ? '<span style="color:var(--bad)">ไม่พบคอลัมน์: ' + miss.map(function (k) { return k === 'group' ? 'กลุ่ม' : 'ชื่อ'; }).join(', ') + '</span>' : 'พบ ' + rows.length + ' แถว · มีอีเมล ' + rows.filter(function (r) { return r.email; }).length + ' แถว';
        root.querySelector('#go').disabled = !!miss.length || !rows.length;
      };
      root.querySelector('#go').onclick = function () {
        busy(root.querySelector('#go'), api('importUsers', { rows: rows })).then(function (r) {
          close(); modal({ title: 'นำเข้าเรียบร้อย', body: '<p>เพิ่มใหม่ <b>' + r.added + '</b> คน · ปรับปรุง <b>' + r.updated + '</b> คน</p>' + (r.skipped.length ? '<div class="note warn">' + ic('alert') + '<div>' + r.skipped.map(esc).join('<br>') + '</div></div>' : ''), onClose: function () { render(); } });
        }).catch(fail);
      };
    }
  });
}

/* ---------------------------------------------------------------- รายละเอียดผู้เรียน */
route('/admin/user', function (main, parts) {
  loading(main);
  api('getUserDetail', { id: parts[2] }).then(function (d) {
    var u = d.user;
    main.innerHTML = '<div class="row small mut" style="margin-bottom:10px"><a href="#/admin/users">ทะเบียนผู้เรียน</a> › ' + esc(u.name) + '</div>' +
      '<div class="ph"><div class="t"><h1>' + esc(u.name) + '</h1><p>' + esc(u.groupTh) + (u.boardRole ? ' · ' + esc(u.boardRole) : '') + ' · ' + (u.email ? esc(u.email) : 'ยังไม่มีอีเมล') + '</p></div>' +
      '<button class="btn" id="ed">' + ic('edit') + ' แก้ไขข้อมูล</button><button class="btn" id="iv"' + (u.email ? '' : ' disabled') + '>' + ic('link') + ' ลิงก์ตั้งรหัสผ่าน</button></div>' +
      '<div class="grid g4" style="margin-bottom:16px"><div class="stat"><div class="n" style="font-size:18px"><span class="badge ' + (ST_BADGE[u.status] || '') + '">' + esc(u.statusTh) + '</span></div><div class="l">บัญชี · เข้าใช้ล่าสุด ' + (u.lastLogin ? thDate(u.lastLogin, true) : '-') + '</div></div>' +
      '<div class="stat nv"><div class="n">' + u.reqDone + '/' + u.reqTotal + '</div><div class="l">บทบังคับที่เรียนแล้ว</div></div><div class="stat"><div class="n">' + (u.best == null ? '-' : u.best + '%') + '</div><div class="l">คะแนนสูงสุด (' + u.attempts + ' ครั้ง)</div></div>' +
      '<div class="stat"><div class="n" style="font-size:18px">' + certBadge(u.cert.status) + '</div><div class="l">' + (u.cert.no ? esc(u.cert.no) + ' · ถึง ' + thDate(u.cert.expire) : 'ยังไม่มีใบเซอร์') + '</div></div></div>' +
      '<div class="card pad0"><div class="toolbar"><b>ความก้าวหน้ารายบท</b><div style="flex:1"></div><button class="btn sm" id="allDone">' + ic('check') + ' บันทึกว่าเรียนครบทุกบท</button><button class="btn sm danger" id="allReset">รีเซ็ตทั้งหมด</button></div><div class="tw"><table class="t"><tr><th>บท</th><th>ความคืบหน้า</th><th>เรียนจบเมื่อ</th><th>วิธี</th><th></th></tr>' +
      d.modules.map(function (m) { return '<tr><td><b>' + esc(m.code) + '</b><div class="tiny mut">' + esc(m.title) + '</div></td><td style="min-width:130px"><div class="small">' + (m.done ? 100 : m.percent) + '%</div><div class="bar ' + (m.done ? 'ok' : '') + '"><i style="width:' + (m.done ? 100 : m.percent) + '%"></i></div></td><td class="small">' + (m.completedAt ? thDate(m.completedAt, true) : '-') + '</td><td class="tiny mut">' + esc(m.method) + '</td><td class="nowrap">' + (m.done ? '<button class="btn sm ghost" data-r="' + m.id + '">รีเซ็ต</button>' : '<button class="btn sm" data-c="' + m.id + '">เรียนแล้ว</button>') + '</td></tr>'; }).join('') + '</table></div></div>' +
      '<div class="grid g2"><div class="card"><h2>ประวัติการสอบ</h2>' + (d.attempts.length ? '<table class="t">' + d.attempts.map(function (a) { return '<tr><td class="small">' + thDate(a.at, true) + '</td><td class="num">' + a.score + '/' + a.total + ' (' + a.percent + '%)</td><td>' + (a.passed ? '<span class="badge ok">ผ่าน</span>' : '<span class="badge bad">ไม่ผ่าน</span>') + '</td></tr>'; }).join('') + '</table>' : '<p class="mut">ยังไม่เคยสอบ</p>') + '</div>' +
      '<div class="card"><h2>ใบเซอร์</h2>' + (d.certs.length ? '<table class="t">' + d.certs.map(function (c) { return '<tr><td><b>' + esc(c.no) + '</b><div class="tiny mut">' + thDate(c.issued) + ' – ' + thDate(c.expire) + '</div></td><td>' + certBadge(c.status) + '</td><td>' + (c.status !== 'REVOKED' ? '<button class="btn sm" data-dl="' + esc(c.no) + '">' + ic('download') + '</button>' : '') + '</td></tr>'; }).join('') + '</table>' : '<p class="mut">ยังไม่มี</p>') +
      '<button class="btn sm" id="manual" style="margin-top:10px">' + ic('plus') + ' ออกใบเซอร์ให้ (เช่น อบรม onsite)</button></div></div>';
    $('#ed').onclick = function () { userForm(u, function () { render(); }); };
    $('#iv').onclick = function () { inviteFlow([u.id]); };
    function prog(mid, action) {
      var note = action === 'complete' ? prompt('หมายเหตุ (เช่น เข้าอบรม onsite วันที่ …)', '') : '';
      if (note === null) return;
      api('setUserProgress', { userId: u.id, moduleId: mid, action: action, note: note }).then(function () { toast('บันทึกแล้ว', 'ok'); render(); }).catch(fail);
    }
    $$('[data-c]').forEach(function (b) { b.onclick = function () { prog(b.dataset.c, 'complete'); }; });
    $$('[data-r]').forEach(function (b) { b.onclick = function () { confirmBox('รีเซ็ตความก้าวหน้า', 'ผู้เรียนต้องดูบทนี้ใหม่', 'รีเซ็ต', true).then(function (ok) { if (ok) prog(b.dataset.r, 'reset'); }); }; });
    $('#allDone').onclick = function () { prog('ALL', 'complete'); };
    $('#allReset').onclick = function () { confirmBox('รีเซ็ตทุกบท', 'ความก้าวหน้าทั้งหมดของ ' + esc(u.name) + ' จะถูกล้าง (ประวัติการสอบและใบเซอร์ไม่หาย)', 'รีเซ็ตทั้งหมด', true).then(function (ok) { if (ok) prog('ALL', 'reset'); }); };
    $$('[data-dl]').forEach(function (b) { b.onclick = function () { busy(b, api('downloadCert', { no: b.dataset.dl })).then(downloadB64).catch(fail); }; });
    $('#manual').onclick = function () {
      modal({ title: 'ออกใบเซอร์ให้ ' + u.name, body: '<label class="f"><span>วันที่ผ่านการอบรม</span><input type="date" id="dt" value="' + new Date().toISOString().slice(0, 10) + '"></label><label class="f"><span>หมายเหตุ (บันทึกเป็นหลักฐาน)</span><input type="text" id="nt" placeholder="เช่น เข้าอบรม SOP แบบ onsite วันที่ …"></label>', foot: '<button class="btn" data-x>ยกเลิก</button><button class="btn gold" id="ok">ออกใบเซอร์</button>',
        onMount: function (root, close) { root.querySelector('#ok').onclick = function () { busy(root.querySelector('#ok'), api('issueCertManual', { userId: u.id, date: root.querySelector('#dt').value, note: root.querySelector('#nt').value })).then(function () { close(); toast('ออกใบเซอร์แล้ว', 'ok'); render(); }).catch(fail); }; } });
    };
  }).catch(fail);
});

/* ---------------------------------------------------------------- บทเรียน / วิดีโอ */
route('/admin/modules', function (main) {
  loading(main);
  api('listModules').then(function (mods) { drawMods(main, mods); }).catch(fail);
});
function drawMods(main, mods) {
  var TN = { YOUTUBE: 'YouTube', DRIVE: 'Google Drive', NONE: 'ไม่มีวิดีโอ' };
  main.innerHTML = '<div class="ph"><div class="t"><h1>บทเรียน / วิดีโอ</h1><p>' + mods.length + ' บท · YouTube ' + mods.filter(function (m) { return m.type === 'YOUTUBE'; }).length + ' · Drive ' + mods.filter(function (m) { return m.type === 'DRIVE'; }).length + '</p></div><button class="btn" id="bulk">' + ic('play') + ' วางลิงก์ YouTube ทีละหลายบท</button><button class="btn pri" id="add">' + ic('plus') + ' เพิ่มบทเรียน</button></div>' +
    '<div class="note">' + ic('info') + '<div class="small"><b>แนะนำ YouTube แบบ "ไม่เป็นสาธารณะ" (Unlisted)</b> — ระบบวัดเวลาที่ดูจริงได้และเล่นบนมือถือลื่น · วิดีโอ Google Drive ผู้เรียนต้องมีสิทธิ์ดูไฟล์ และระบบนับได้แค่เวลาที่เปิดหน้าไว้</div></div>' +
    '<div class="card pad0"><div class="tw"><table class="t"><tr><th>#</th><th>บทเรียน</th><th>วิดีโอ</th><th class="num">ความยาว</th><th>บังคับ</th><th></th></tr>' + mods.map(function (m) {
      var link = m.type === 'YOUTUBE' ? 'https://youtu.be/' + m.ref : m.type === 'DRIVE' ? 'https://drive.google.com/file/d/' + m.ref + '/view' : '';
      return '<tr' + (m.active ? '' : ' style="opacity:.5"') + '><td class="small mut">' + m.sort + '</td><td><b>' + esc(m.code) + '</b><div class="small">' + esc(m.title) + '</div></td><td><span class="badge ' + (m.type === 'YOUTUBE' ? 'ok' : m.type === 'DRIVE' ? 'warn' : '') + '">' + TN[m.type] + '</span>' + (link ? ' <a class="tiny" target="_blank" rel="noopener" href="' + esc(link) + '">เปิด</a>' : '') + '</td>' +
        '<td class="num small">' + (m.duration ? mmss(m.duration) : '<span style="color:var(--bad)">' + (m.type === 'DRIVE' ? 'ต้องใส่' : 'อ่านจากเครื่องเล่น') + '</span>') + '</td><td>' + (m.required ? 'บังคับ' : '<span class="mut">ไม่บังคับ</span>') + (m.active ? '' : ' · ปิด') + '</td><td><button class="btn sm ghost" data-e="' + m.id + '">' + ic('edit') + '</button></td></tr>';
    }).join('') + '</table></div></div>';
  $$('[data-e]').forEach(function (b) { b.onclick = function () { modForm(mods.filter(function (m) { return m.id === b.dataset.e; })[0], main); }; });
  $('#add').onclick = function () { modForm({ sort: mods.length + 1, type: 'YOUTUBE', required: true, active: true }, main); };
  $('#bulk').onclick = function () {
    modal({ title: 'วางลิงก์ YouTube ทีละหลายบท', wide: true,
      body: '<p class="small">วางลิงก์ 1 บรรทัดต่อ 1 บท เรียงตามลำดับบทเรียน (บรรทัดว่าง = ข้ามบทนั้น) · ความยาววิดีโอระบบอ่านจากเครื่องเล่นอัตโนมัติ</p><div class="grid g2"><textarea id="ln" rows="16" placeholder="https://youtu.be/xxxxxxxxxxx"></textarea><div class="small" id="pv"></div></div>',
      foot: '<button class="btn" data-x>ยกเลิก</button><button class="btn pri" id="go">บันทึก</button>',
      onMount: function (root, close) {
        var ta = root.querySelector('#ln');
        ta.oninput = function () { var ls = ta.value.split('\n'); root.querySelector('#pv').innerHTML = mods.map(function (m, i) { var l = (ls[i] || '').trim(); return '<div>' + esc(m.code) + ' → ' + (l ? '<span style="color:var(--ok)">' + esc(l.slice(0, 40)) + '</span>' : '<span class="mut">ไม่เปลี่ยน</span>') + '</div>'; }).join(''); };
        ta.oninput();
        root.querySelector('#go').onclick = function () {
          var ls = ta.value.split('\n'), jobs = [];
          mods.forEach(function (m, i) { var l = (ls[i] || '').trim(); if (l) jobs.push(Object.assign({}, m, { type: 'YOUTUBE', ref: l, durationMin: 0, duration: 0 })); });
          if (!jobs.length) return;
          var b = root.querySelector('#go'), last;
          busy(b, jobs.reduce(function (p, j) { return p.then(function () { return api('saveModule', j).then(function (r) { last = r; }); }); }, Promise.resolve())).then(function () { close(); toast('บันทึก ' + jobs.length + ' บทแล้ว', 'ok'); drawMods(main, last); }).catch(fail);
        };
      } });
  };
}
function modForm(m, main) {
  modal({ title: m.id ? 'แก้ไข ' + m.code : 'เพิ่มบทเรียน', wide: true,
    body: '<form id="mf"><div class="grid g3"><label class="f"><span>ลำดับ</span><input type="number" name="sort" value="' + (m.sort || '') + '"></label><label class="f"><span>รหัส</span><input type="text" name="code" value="' + esc(m.code || '') + '" placeholder="SOP 001.02"></label><label class="f"><span>ชนิดวิดีโอ</span><select name="type">' + ['YOUTUBE', 'DRIVE', 'NONE'].map(function (t) { return '<option value="' + t + '"' + (m.type === t ? ' selected' : '') + '>' + { YOUTUBE: 'YouTube', DRIVE: 'Google Drive', NONE: 'ไม่มีวิดีโอ (อ่านเอกสาร)' }[t] + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="f"><span>ชื่อบทเรียน *</span><input type="text" name="title" value="' + esc(m.title || '') + '"></label>' +
      '<div class="grid g2"><label class="f"><span>ลิงก์วิดีโอ</span><input type="text" name="ref" value="' + esc(m.type === 'YOUTUBE' && m.ref ? 'https://youtu.be/' + m.ref : m.type === 'DRIVE' && m.ref ? 'https://drive.google.com/file/d/' + m.ref + '/view' : '') + '"><small>วางลิงก์ YouTube หรือ Google Drive ได้ทุกรูปแบบ</small></label><label class="f"><span>ความยาว (นาที)</span><input type="number" step="0.1" name="durationMin" value="' + (m.duration ? Math.round(m.duration / 6) / 10 : '') + '"><small>Drive ต้องใส่ · YouTube เว้นว่างได้ (อ่านจากเครื่องเล่น)</small></label></div>' +
      '<label class="f"><span>ลิงก์เอกสาร SOP ประกอบ (ไม่บังคับ)</span><input type="url" name="docUrl" value="' + esc(m.docUrl || '') + '"></label><label class="f"><span>คำอธิบาย (แสดงในบทที่ไม่มีวิดีโอ)</span><input type="text" name="note" value="' + esc(m.note || '') + '"></label>' +
      '<label class="check"><input type="checkbox" name="required"' + (m.required !== false ? ' checked' : '') + '> บทบังคับ (ต้องเรียนก่อนสอบ)</label><label class="check" style="margin-top:6px"><input type="checkbox" name="active"' + (m.active !== false ? ' checked' : '') + '> เปิดใช้งาน</label></form>',
    foot: '<button class="btn" data-x>ยกเลิก</button><button class="btn pri" id="sv">บันทึก</button>',
    onMount: function (root, close) {
      root.querySelector('#sv').onclick = function () {
        var f = root.querySelector('#mf');
        busy(root.querySelector('#sv'), api('saveModule', { id: m.id, sort: f.sort.value, code: f.code.value, type: f.type.value, title: f.title.value, ref: f.ref.value, durationMin: f.durationMin.value, docUrl: f.docUrl.value, note: f.note.value, required: f.required.checked, active: f.active.checked }))
          .then(function (mods) { close(); toast('บันทึกแล้ว', 'ok'); drawMods(main, mods); }).catch(fail);
      };
    } });
}

/* ---------------------------------------------------------------- คลังข้อสอบ */
route('/admin/questions', function (main) { loading(main); api('listQuestions').then(function (d) { drawQs(main, d); }).catch(fail); });
function drawQs(main, d) {
  var act = d.questions.filter(function (q) { return q.active; }), off = d.questions.filter(function (q) { return !q.active; });
  main.innerHTML = '<div class="ph"><div class="t"><h1>คลังข้อสอบ</h1><p>ใช้งาน ' + act.length + ' ข้อ · สอบครั้งละ ' + d.examCount + ' ข้อ (ตั้งได้ในหน้าตั้งค่า)</p></div><button class="btn" id="imp">' + ic('upload') + ' นำเข้าหลายข้อ</button><button class="btn pri" id="add">' + ic('plus') + ' เพิ่มข้อสอบ</button></div>' +
    (d.unverified ? '<div class="note warn">' + ic('alert') + '<div><b>เฉลยยังไม่ยืนยัน ' + d.unverified + ' ข้อ</b> — ระบบสุ่มเฉลยไว้ตอนติดตั้ง เพราะไฟล์เฉลยต้นฉบับไม่มีการทำเครื่องหมายคำตอบ · <b>คลิกที่ตัวเลือกที่ถูกต้อง</b> ของแต่ละข้อแล้วกด "ยืนยันเฉลย"</div></div>' : '<div class="note ok">' + ic('check') + '<div>ตั้งเฉลยครบทุกข้อแล้ว</div></div>') +
    '<div class="row" style="margin-bottom:12px"><label class="check small"><input type="checkbox" id="onlyU"> แสดงเฉพาะข้อที่ยังไม่ยืนยันเฉลย</label></div><div id="ql"></div>' +
    (off.length ? '<details style="margin-top:14px"><summary class="mut">ข้อที่ปิดใช้ (' + off.length + ')</summary><div id="qoff" style="margin-top:10px"></div></details>' : '');
  function card(q, i) {
    var st = q.stat, pct = st && st.n ? Math.round(st.right / st.n * 100) : null;
    return '<div class="q" data-q="' + q.id + '"><div class="qt"><span class="qn" style="' + (q.verified ? 'background:var(--ok-l);color:var(--ok)' : 'background:var(--warn-l);color:var(--warn)') + '">' + (i + 1) + '</span><div style="flex:1">' + esc(q.text) + '<div class="tiny mut">' + (q.sop ? 'SOP ' + esc(q.sop) + ' · ' : '') + (q.verified ? 'เฉลยยืนยันแล้ว' + (q.updatedBy ? ' โดย ' + esc(q.updatedBy) : '') : '<b style="color:var(--warn)">เฉลยยังไม่ยืนยัน (สุ่ม)</b>') + (pct != null ? ' · ตอบถูก ' + pct + '% จาก ' + st.n + ' ครั้ง' : '') + '</div></div>' +
      '<button class="btn sm ghost" data-ed="' + q.id + '">' + ic('edit') + '</button></div><div class="qa-opts">' +
      q.options.map(function (o, k) { var picks = st && st.picks ? st.picks[k] || 0 : 0; return '<div class="opt' + (k === q.answer ? ' is' : '') + '" data-k="' + k + '"><span class="lb">' + OPT_L[k] + '.</span><span style="flex:1">' + esc(o) + '</span>' + (k === q.answer ? '<span class="badge ok">' + ic('check') + ' เฉลย</span>' : '') + (st && st.n ? '<span class="tiny mut">' + picks + ' คน</span>' : '') + '</div>'; }).join('') +
      '</div><div class="row" style="justify-content:flex-end"><button class="btn sm ' + (q.verified ? '' : 'pri') + '" data-vf="' + q.id + '" ' + (q.verified ? 'disabled' : '') + '>' + ic('check') + (q.verified ? ' ยืนยันแล้ว' : ' ยืนยันเฉลย') + '</button></div></div>';
  }
  function draw() {
    var only = $('#onlyU').checked;
    $('#ql').innerHTML = act.map(function (q, i) { return only && q.verified ? '' : card(q, i); }).join('') || '<div class="empty">ไม่มีข้อที่ต้องยืนยัน</div>';
    if ($('#qoff')) $('#qoff').innerHTML = off.map(function (q, i) { return '<div class="q"><div class="qt"><div style="flex:1">' + esc(q.text) + '</div><button class="btn sm" data-on="' + q.id + '">เปิดใช้</button></div></div>'; }).join('');
    $$('#ql .q').forEach(function (el) {
      var q = act.filter(function (x) { return x.id === el.dataset.q; })[0];
      $$('.opt', el).forEach(function (o) { o.onclick = function () { q.answer = +o.dataset.k; q.verified = false; el.outerHTML = card(q, act.indexOf(q)); draw(); }; });
    });
    $$('[data-vf]').forEach(function (b) { b.onclick = function () { var q = act.filter(function (x) { return x.id === b.dataset.vf; })[0]; busy(b, api('saveQuestion', Object.assign({}, q, { verified: true }))).then(function (r) { toast('ยืนยันเฉลยข้อนี้แล้ว (' + OPT_L[q.answer] + ')', 'ok'); drawQs(main, r); }).catch(fail); }; });
    $$('[data-ed]').forEach(function (b) { b.onclick = function () { qForm(act.filter(function (x) { return x.id === b.dataset.ed; })[0], main); }; });
    $$('[data-on]').forEach(function (b) { b.onclick = function () { var q = off.filter(function (x) { return x.id === b.dataset.on; })[0]; api('saveQuestion', Object.assign({}, q, { active: true })).then(function (r) { drawQs(main, r); }).catch(fail); }; });
  }
  $('#onlyU').onchange = draw; draw();
  $('#add').onclick = function () { qForm({ options: ['', '', '', '', ''], answer: -1, active: true }, main); };
  $('#imp').onclick = function () {
    modal({ title: 'นำเข้าข้อสอบหลายข้อ', wide: true,
      body: '<p class="small">วางจาก Excel (มีแถวหัวตาราง): <b>SOP</b> · <b>คำถาม</b> · <b>ก</b> · <b>ข</b> · <b>ค</b> · <b>ง</b> · <b>จ</b> · <b>เฉลย</b> (ก–จ, เว้นว่าง = ยังไม่ยืนยัน) · <b>คำอธิบาย</b></p><textarea id="tsv" rows="10"></textarea><div id="pv" class="small"></div>',
      foot: '<button class="btn" data-x>ยกเลิก</button><button class="btn pri" id="go" disabled>นำเข้า</button>',
      onMount: function (root, close) {
        var rows = [];
        root.querySelector('#tsv').oninput = function () {
          var ls = this.value.replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); }); if (ls.length < 2) { rows = []; root.querySelector('#go').disabled = true; return; }
          var h = ls[0].split('\t').map(function (x) { return x.trim(); });
          rows = ls.slice(1).map(function (l) { var c = l.split('\t'), o = { options: [] }; h.forEach(function (k, i) { var v = (c[i] || '').trim(); if (k === 'SOP') o.sop = v; else if (k === 'คำถาม') o.text = v; else if (OPT_L.indexOf(k) >= 0) { if (v) o.options.push(v); } else if (k === 'เฉลย') o.answer = v; else if (k === 'คำอธิบาย') o.explain = v; }); return o; }).filter(function (o) { return o.text; });
          root.querySelector('#pv').textContent = 'พบ ' + rows.length + ' ข้อ'; root.querySelector('#go').disabled = !rows.length;
        };
        root.querySelector('#go').onclick = function () { busy(root.querySelector('#go'), api('importQuestions', { rows: rows })).then(function (r) { close(); toast('นำเข้าแล้ว', 'ok'); drawQs(main, r); }).catch(fail); };
      } });
  };
}
function qForm(q, main) {
  modal({ title: q.id ? 'แก้ไขข้อสอบ' : 'เพิ่มข้อสอบ', wide: true,
    body: '<form id="qf"><div class="grid g3"><label class="f"><span>SOP ที่เกี่ยวข้อง</span><input type="text" name="sop" value="' + esc(q.sop || '') + '" placeholder="เช่น 009"></label><label class="f"><span>ลำดับ</span><input type="number" name="sort" value="' + (q.sort || '') + '"></label><div></div></div>' +
      '<label class="f"><span>คำถาม *</span><textarea name="text" rows="3">' + esc(q.text || '') + '</textarea></label><div class="small b" style="margin-bottom:6px">ตัวเลือก (เลือกวงกลมหน้าข้อที่ถูก) · เว้นว่างได้ถ้าน้อยกว่า 5 ตัวเลือก</div>' +
      [0, 1, 2, 3, 4, 5].map(function (k) { return '<div class="row" style="margin-bottom:6px;flex-wrap:nowrap"><input type="radio" name="ans" value="' + k + '"' + (q.answer === k ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:var(--ok)"><b style="width:18px">' + OPT_L[k] + '.</b><input type="text" name="o' + k + '" value="' + esc((q.options || [])[k] || '') + '"></div>'; }).join('') +
      '<label class="f" style="margin-top:10px"><span>คำอธิบายเฉลย (แสดงเมื่อเปิด "แสดงเฉลย")</span><input type="text" name="explain" value="' + esc(q.explain || '') + '"></label></form>',
    foot: (q.id ? '<button class="btn danger" id="del" style="margin-right:auto">ปิดใช้ข้อนี้</button>' : '') + '<button class="btn" data-x>ยกเลิก</button><button class="btn pri" id="sv">บันทึก (ยืนยันเฉลย)</button>',
    onMount: function (root, close) {
      root.querySelector('#sv').onclick = function () {
        var f = root.querySelector('#qf'), opts = [], map = {}, ans = f.querySelector('input[name=ans]:checked');
        [0, 1, 2, 3, 4, 5].forEach(function (k) { var v = f['o' + k].value.trim(); if (v) { map[k] = opts.length; opts.push(v); } });
        var a = ans ? map[+ans.value] : -1; if (a == null) a = -1;
        busy(root.querySelector('#sv'), api('saveQuestion', { id: q.id, sop: f.sop.value, sort: f.sort.value, text: f.text.value, options: opts, answer: a, explain: f.explain.value, verified: true })).then(function (r) { close(); toast('บันทึกแล้ว', 'ok'); drawQs(main, r); }).catch(fail);
      };
      var del = root.querySelector('#del'); if (del) del.onclick = function () { busy(del, api('saveQuestion', { id: q.id, remove: true })).then(function (r) { close(); drawQs(main, r); }).catch(fail); };
    } });
}

/* ---------------------------------------------------------------- ใบเซอร์ที่ออก */
route('/admin/certs', function (main) {
  loading(main);
  api('listCerts').then(function (rows) { drawCerts(main, rows); }).catch(fail);
});
function drawCerts(main, rows) {
  main.innerHTML = '<div class="ph"><div class="t"><h1>ใบเซอร์ที่ออก</h1><p>' + rows.length + ' ฉบับ · ใช้ได้ ' + rows.filter(function (r) { return r.status === 'VALID' || r.status === 'SOON'; }).length + ' ฉบับ</p></div><button class="btn" id="csv">' + ic('download') + ' ส่งออก CSV</button></div>' +
    '<div class="card pad0"><div class="tw">' + (rows.length ? '<table class="t"><tr><th>เลขที่</th><th>ชื่อ</th><th>วันที่ออก</th><th>ใช้ได้ถึง</th><th>สถานะ</th><th></th></tr>' + rows.map(function (r) {
      return '<tr><td><b>' + esc(r.no) + '</b>' + (r.attempt === 'MANUAL' ? '<div class="tiny mut">ออกโดยผู้ดูแล</div>' : '') + '</td><td><a href="#/admin/user/' + esc(r.userId) + '">' + esc(r.name) + '</a>' + (r.note ? '<div class="tiny mut">' + esc(r.note) + '</div>' : '') + '</td><td class="small">' + thDate(r.issued) + '</td><td class="small">' + thDate(r.expire) + '</td><td>' + certBadge(r.status) + '</td>' +
        '<td class="nowrap">' + (r.status !== 'REVOKED' ? '<button class="btn sm" data-dl="' + esc(r.no) + '" title="ดาวน์โหลด">' + ic('download') + '</button> <button class="btn sm ghost" data-rg="' + esc(r.no) + '" title="สร้างไฟล์ใหม่ (หลังแก้แม่แบบ/ชื่อ)">' + ic('refresh') + '</button> <button class="btn sm danger" data-rv="' + esc(r.no) + '">ยกเลิก</button>' : '') + '</td></tr>';
    }).join('') + '</table>' : '<div class="empty">ยังไม่มีใบเซอร์</div>') + '</div></div>';
  $$('[data-dl]').forEach(function (b) { b.onclick = function () { busy(b, api('downloadCert', { no: b.dataset.dl })).then(downloadB64).catch(fail); }; });
  $$('[data-rg]').forEach(function (b) { b.onclick = function () { busy(b, api('regenCert', { no: b.dataset.rg })).then(function (r) { toast('สร้างไฟล์ใหม่แล้ว', 'ok'); drawCerts(main, r); }).catch(fail); }; });
  $$('[data-rv]').forEach(function (b) { b.onclick = function () { var why = prompt('เหตุผลการยกเลิกใบเซอร์ ' + b.dataset.rv); if (why) api('revokeCert', { no: b.dataset.rv, reason: why }).then(function (r) { toast('ยกเลิกแล้ว', 'ok'); drawCerts(main, r); }).catch(fail); }; });
  $('#csv').onclick = function () { downloadCsv('ทะเบียนใบเซอร์SOP.csv', [['เลขที่', 'ชื่อ', 'วันที่ออก', 'ใช้ได้ถึง', 'สถานะ', 'หมายเหตุ']].concat(rows.map(function (r) { return [r.no, r.name, r.issued, r.expire, r.statusTh, r.note]; }))); };
}

/* ---------------------------------------------------------------- อีเมล */
route('/admin/mail', function (main) {
  loading(main);
  api('listMailLog', { limit: 300 }).then(function (rows) {
    var mm = S.boot.settings.mailMode, SB = { SENT: 'ok', SKIPPED: '', FAILED: 'bad' }, ST = { SENT: 'ส่งแล้ว', SKIPPED: 'ไม่ส่ง (ปิด)', FAILED: 'ไม่สำเร็จ' }, K = { INVITE: 'เชิญ', RESET: 'ตั้งรหัสใหม่', PASSED: 'แจ้งผ่าน', REMIND_COURSE: 'เตือนเรียน', REMIND_EXPIRE: 'เตือนหมดอายุ', TEST: 'ทดสอบ' };
    main.innerHTML = '<div class="ph"><div class="t"><h1>อีเมล</h1><p>ประวัติ 300 ฉบับล่าสุด · ไม่เก็บลิงก์ตั้งรหัสผ่านในประวัติ</p></div><a class="btn" href="#/admin/settings">' + ic('settings') + ' ตั้งค่าอีเมล</a><button class="btn pri" id="t">' + ic('send') + ' ทดสอบส่ง</button></div>' +
      '<div class="note ' + (mm === 'ON' ? 'ok' : 'warn') + '">' + ic(mm === 'ON' ? 'check' : 'alert') + '<div>โหมดตอนนี้: <b>' + ({ OFF: 'ปิด — ไม่มีอีเมลออกจากระบบ', TEST: 'ทดสอบ — ทุกฉบับส่งไปอีเมลทดสอบเท่านั้น', ON: 'ส่งจริงถึงผู้รับ' }[mm]) + '</b></div></div>' +
      '<div class="card pad0"><div class="tw">' + (rows.length ? '<table class="t"><tr><th>เวลา</th><th>ผู้รับ</th><th>ประเภท</th><th>สถานะ</th></tr>' + rows.map(function (r) { return '<tr><td class="small nowrap">' + thDate(r.ts, true) + '</td><td class="small">' + esc(r.to) + '<div class="tiny mut">' + esc(r.subject) + '</div></td><td class="small">' + esc(K[r.kind] || r.kind) + '</td><td><span class="badge ' + (SB[r.status] || '') + '">' + esc(ST[r.status] || r.status) + '</span><div class="tiny mut">' + esc(r.detail) + '</div></td></tr>'; }).join('') + '</table>' : '<div class="empty">ยังไม่มีประวัติ</div>') + '</div></div>';
    $('#t').onclick = function () { var to = prompt('ส่งอีเมลทดสอบไปที่', S.me.email); if (to) api('testMail', { to: to }).then(function (r) { toast('ผล: ' + (ST[r.status] || r.status) + (r.note ? ' · ' + r.note : ''), r.status === 'FAILED' ? 'bad' : 'ok'); render(); }).catch(fail); };
  }).catch(fail);
});

/* ---------------------------------------------------------------- ตั้งค่า */
route('/admin/settings', function (main) {
  loading(main);
  api('getSettings').then(function (d) { drawSettings(main, d); }).catch(fail);
});
function drawSettings(main, d) {
  var groups = []; d.meta.forEach(function (m) { if (groups.indexOf(m.g) < 0) groups.push(m.g); });
  function field(m) {
    var id = 's_' + m.k, v = m.v == null ? '' : m.v, inp;
    if (m.t === 'bool') return '<div class="row" style="justify-content:space-between;flex-wrap:nowrap;padding:8px 0;border-bottom:1px solid #f0ede6"><div><div>' + esc(m.l) + '</div>' + (m.h ? '<div class="tiny mut">' + esc(m.h) + '</div>' : '') + '</div><label class="switch"><input type="checkbox" data-k="' + m.k + '"' + (String(v).toUpperCase() === 'TRUE' ? ' checked' : '') + '><i></i></label></div>';
    if (m.t === 'select') inp = '<select data-k="' + m.k + '">' + m.o.map(function (o) { return '<option value="' + o + '"' + (o === v ? ' selected' : '') + '>' + esc({ OFF: 'OFF — ปิด ไม่ส่งอีเมล', TEST: 'TEST — ส่งไปอีเมลทดสอบเท่านั้น', ON: 'ON — ส่งจริงถึงผู้รับ' }[o] || o) + '</option>'; }).join('') + '</select>';
    else if (m.t === 'textarea') inp = '<textarea data-k="' + m.k + '" rows="2">' + esc(v) + '</textarea>';
    else inp = '<input type="' + (m.t === 'number' ? 'number' : 'text') + '" data-k="' + m.k + '" value="' + esc(v) + '"' + (m.t === 'number' ? ' step="any" min="0"' : '') + '>';
    return '<label class="f"><span>' + esc(m.l) + '</span>' + inp + (m.h ? '<small>' + esc(m.h) + '</small>' : '') + '</label>';
  }
  main.innerHTML = '<div class="ph"><div class="t"><h1>ตั้งค่าระบบ</h1><p>หลังบ้านรุ่น ' + esc(d.build) + ' · การเปลี่ยนแปลงทุกครั้งถูกบันทึกในบันทึกการใช้งาน</p></div><button class="btn pri" id="sv">' + ic('check') + ' บันทึกการตั้งค่า</button></div><div class="grid g2">' +
    groups.map(function (g) {
      var extra = g === 'ใบเซอร์' ? '<div class="row" style="margin-top:6px"><button class="btn sm" id="tpl">' + ic('refresh') + ' สร้างแม่แบบใหม่</button><button class="btn sm" id="prev">' + ic('eye') + ' ดูตัวอย่าง PDF</button>' + (d.meta.filter(function (m) { return m.k === 'certTemplateId'; })[0].v ? '<a class="btn sm ghost" target="_blank" rel="noopener" href="https://docs.google.com/presentation/d/' + esc(d.meta.filter(function (m) { return m.k === 'certTemplateId'; })[0].v) + '/edit">เปิดแม่แบบใน Google Slides</a>' : '') + '</div>'
        : g === 'อีเมล' ? '<div class="row" style="margin-top:6px"><button class="btn sm" id="tm">' + ic('send') + ' ทดสอบส่งอีเมล</button><button class="btn sm" id="nj">' + ic('refresh') + ' รันงานกลางคืนตอนนี้</button></div>' : '';
      return '<div class="card"><h2>' + esc(g) + '</h2>' + d.meta.filter(function (m) { return m.g === g; }).map(field).join('') + extra + '</div>';
    }).join('') + '</div>';
  $('#sv').onclick = function () {
    var vals = {}; $$('[data-k]', main).forEach(function (el) { vals[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; });
    busy($('#sv'), api('saveSettings', { values: vals })).then(function (r) { toast('บันทึกการตั้งค่าแล้ว', 'ok'); S.boot = null; boot().then(function () { refreshMailChip(S.boot.settings.mailMode); }); drawSettings(main, r); }).catch(fail);
  };
  $('#tpl').onclick = function () { confirmBox('สร้างแม่แบบใบเซอร์ใหม่', 'ระบบจะสร้างไฟล์ Google Slides ใหม่ (A4 แนวนอน · พื้นหลังจาก cert-bg.png บนหน้าเว็บ) และเปลี่ยนไปใช้แม่แบบใหม่ทันที · แม่แบบเดิมยังอยู่ใน Drive', 'สร้าง').then(function (ok) { if (ok) busy($('#tpl'), api('rebuildCertTemplate')).then(function (r) { toast('สร้างแม่แบบแล้ว', 'ok'); window.open(r.url, '_blank'); render(); }).catch(fail); }); };
  $('#prev').onclick = function () { busy($('#prev'), api('previewCert')).then(downloadB64).catch(fail); };
  $('#tm').onclick = function () { var to = prompt('ส่งอีเมลทดสอบไปที่ (ใช้โหมดที่บันทึกไว้)', S.me.email); if (to) busy($('#tm'), api('testMail', { to: to })).then(function (r) { toast('ผล: ' + r.status + (r.note ? ' · ' + r.note : ''), r.status === 'FAILED' ? 'bad' : 'ok'); }).catch(fail); };
  $('#nj').onclick = function () { busy($('#nj'), api('runNightly')).then(function (r) { modal({ title: 'ผลงานกลางคืน', body: '<pre class="small" style="white-space:pre-wrap">' + esc(JSON.stringify(r, null, 2)) + '</pre>' }); }).catch(fail); };
}

/* ---------------------------------------------------------------- บันทึกการใช้งาน */
route('/admin/audit', function (main) {
  loading(main);
  api('listAudit', { limit: 400 }).then(function (rows) {
    main.innerHTML = '<div class="ph"><div class="t"><h1>บันทึกการใช้งาน</h1><p>400 รายการล่าสุด (เก็บถาวรในชีท AuditLog)</p></div></div><div class="card pad0"><div class="toolbar"><input type="search" id="q" placeholder="ค้นหา"></div><div class="tw" id="tb"></div></div>';
    function draw() { var q = $('#q').value.toLowerCase(); $('#tb').innerHTML = '<table class="t"><tr><th>เวลา</th><th>ผู้กระทำ</th><th>การกระทำ</th><th>เป้าหมาย</th><th>รายละเอียด</th></tr>' + rows.filter(function (r) { return !q || JSON.stringify(r).toLowerCase().indexOf(q) >= 0; }).map(function (r) { return '<tr><td class="small nowrap">' + thDate(r.ts, true) + '</td><td class="small">' + esc(r.actor) + '</td><td><span class="badge">' + esc(r.action) + '</span></td><td class="small">' + esc(r.target) + '</td><td class="small mut">' + esc(r.detail) + '</td></tr>'; }).join('') + '</table>'; }
    $('#q').oninput = debounce(draw, 200); draw();
  }).catch(fail);
});

/* ทุกหน้าที่ขึ้นต้น /admin ต้องเป็นผู้ดูแล (หลังบ้านตรวจซ้ำทุกคำสั่งอยู่แล้ว) */
Object.keys(ROUTES).forEach(function (k) { if (/^\/admin/.test(k)) ROUTES[k].opt.admin = true; });
