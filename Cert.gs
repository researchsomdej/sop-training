/**
 * Cert.gs : ใบประกาศนียบัตร (ใบเซอร์)
 *  - เลขที่: <certPrefix><ปี พ.ศ.>/<ลำดับ 3 หลัก> เช่น SOP-2569/001 · อายุ certYears ปี (นับรวมวันออก)
 *  - ไฟล์ PDF สร้างจากแม่แบบ Google Slides (certTemplateId) → แทนข้อความ {{…}} → ส่งออก PDF เก็บในโฟลเดอร์ส่วนตัว
 *  - แม่แบบสร้างได้ด้วยปุ่ม "สร้างแม่แบบใหม่" (พื้นหลังจาก <siteUrl>/cert-bg.png) แล้วเปิดไปแก้ข้อความ/ตำแหน่งเองได้
 *  - ข้อความแทนที่: {{ชื่อ}} {{วันที่}} {{เลขที่}} {{วันหมดอายุ}} {{หลักสูตร}} {{หน่วยงาน}} {{สำนักงาน}}
 *                  {{ผู้ลงนาม}} {{ตำแหน่งผู้ลงนาม}} {{ลิงก์ตรวจสอบ}} {{ลายเซ็น}} (กล่องนี้ถูกแทนด้วยภาพลายเซ็น)
 *  - เมื่อออกใบใหม่ อัปเดต Users.sop_train_date / sop_expire_date / sop_cert_no (ระบบ Submission ในอนาคตอ่านช่องนี้)
 */
var CERT_ST_TH = { VALID: 'ใช้ได้', SOON: 'ใกล้หมดอายุ', EXPIRED: 'หมดอายุ', REPLACED: 'มีฉบับใหม่แทนแล้ว', REVOKED: 'ยกเลิก' };

function certFolder_() {
  var id = prop_('CERT_FOLDER_ID');
  if (id) try { return DriveApp.getFolderById(id); } catch (e) { }
  var f = DriveApp.createFolder('QSMH-IRB-Training_ใบเซอร์ (ห้ามแชร์)');
  PropertiesService.getScriptProperties().setProperty('CERT_FOLDER_ID', f.getId());
  return f;
}
function verifyUrl_(no) { return siteUrl_() + '#/verify?no=' + encodeURIComponent(no); }

/** สร้างแถวใบเซอร์ (เรียกภายใต้ withLock_) */
function issueCertRow_(u, attemptId, ymd, by, note) {
  var t = T_('Certs'), yearBE = +String(ymd).slice(0, 4) + 543, prefix = str_(setting_('certPrefix')) + yearBE + '/';
  var n = t.all().filter(function (r) { return String(r.cert_no).indexOf(prefix) === 0; }).length + 1, no;
  do { no = prefix + ('00' + n).slice(-3); n++; } while (t.get(no));
  t.all().filter(function (r) { return r.user_id === u.user_id && r.status === 'VALID'; }).forEach(function (r) { t.upsert({ cert_no: r.cert_no, status: 'REPLACED' }); });
  var row = { cert_no: no, user_id: u.user_id, full_name: fullName_(u), issued_date: ymd, expire_date: addYears_(ymd, num_(setting_('certYears'), 2)), attempt_id: attemptId, file_id: '', status: 'VALID', created_at: nowIso_(), note: note || '' };
  t.upsert(row);
  T_('Users').upsert({ user_id: u.user_id, sop_train_date: row.issued_date, sop_expire_date: row.expire_date, sop_cert_no: no, updated_at: nowIso_() });
  audit_(by, 'CERT_ISSUE', no, row.full_name + ' ' + attemptId);
  return row;
}

/** สร้างไฟล์ PDF จากแม่แบบ (ไม่บันทึกตาราง) */
function renderCertPdf_(data, fileName) {
  var tid = str_(setting_('certTemplateId'));
  if (!tid) throw new Error('ยังไม่มีแม่แบบใบเซอร์ ให้ผู้ดูแลกด "สร้างแม่แบบใหม่" ในหน้าตั้งค่า › ใบเซอร์');
  var s = settings_(), folder = certFolder_(), copy = DriveApp.getFileById(tid).makeCopy('tmp_' + fileName, folder);
  try {
    var pres = SlidesApp.openById(copy.getId());
    var map = {
      '{{ชื่อ}}': data.name, '{{วันที่}}': thDate_(data.issued), '{{เลขที่}}': data.no, '{{วันหมดอายุ}}': thDate_(data.expire),
      '{{หลักสูตร}}': s.courseName, '{{หน่วยงาน}}': s.orgName, '{{สำนักงาน}}': s.officeName,
      '{{ผู้ลงนาม}}': s.signerName, '{{ตำแหน่งผู้ลงนาม}}': s.signerTitle, '{{ลิงก์ตรวจสอบ}}': verifyUrl_(data.no)
    };
    Object.keys(map).forEach(function (k) { pres.replaceAllText(k, String(map[k] || '')); });
    var sig = str_(s.signatureFileId);
    pres.getSlides().forEach(function (sl) {
      sl.getShapes().forEach(function (sh) {
        var txt = ''; try { txt = sh.getText().asString(); } catch (e) { return; }
        if (txt.indexOf('{{ลายเซ็น}}') < 0) return;
        if (sig) { try { sh.replaceWithImage(DriveApp.getFileById(sig).getBlob()); return; } catch (e) { console.warn('signature ' + e.message); } }
        sh.getText().setText('');
      });
    });
    pres.saveAndClose();
    var pdf = copy.getAs('application/pdf').setName(fileName + '.pdf');
    return folder.createFile(pdf);
  } finally { copy.setTrashed(true); }
}
function certFileName_(cert) { return 'ใบเซอร์_' + String(cert.cert_no).replace(/\//g, '-') + '_' + cert.full_name; }
/** คืนไฟล์ PDF ของใบเซอร์ (สร้างใหม่ถ้ายังไม่มี) */
function ensureCertFile_(cert) {
  if (cert.file_id) try { var f = DriveApp.getFileById(cert.file_id); return f; } catch (e) { }
  var file = renderCertPdf_({ name: cert.full_name, issued: cert.issued_date, expire: cert.expire_date, no: cert.cert_no }, certFileName_(cert));
  withLock_(function () { T_('Certs').upsert({ cert_no: cert.cert_no, file_id: file.getId() }); });
  return file;
}
function certStatus_(r) { if (r.status !== 'VALID') return r.status; var d = daysTo_(r.expire_date); return d < 0 ? 'EXPIRED' : d <= 60 ? 'SOON' : 'VALID'; }

/** ดาวน์โหลด: เจ้าของ หรือ ผู้ดูแล */
function downloadCert_(c, p) {
  var no = str_(p.no) || c.user.sop_cert_no, cert = T_('Certs').get(no);
  if (!cert) throw new Error('ไม่พบใบประกาศนียบัตร');
  if (cert.user_id !== c.uid && !isAdmin_(c)) throw new Error('ท่านไม่มีสิทธิ์ดาวน์โหลดใบประกาศนียบัตรนี้');
  if (cert.status === 'REVOKED') throw new Error('ใบประกาศนียบัตรนี้ถูกยกเลิกแล้ว');
  var f = ensureCertFile_(cert), b = f.getBlob();
  audit_(c.user.email, 'CERT_DOWNLOAD', no, '');
  // ชื่อไฟล์ดาวน์โหลดเป็นอักษรอังกฤษ (บางเบราว์เซอร์ไม่รับชื่อไฟล์ภาษาไทยจากลิงก์ดาวน์โหลด)
  return { name: 'Certificate_' + String(cert.cert_no).replace(/[^\w-]/g, '-') + '.pdf', mime: 'application/pdf', b64: Utilities.base64Encode(b.getBytes()) };
}
/** ตรวจสอบใบเซอร์ (สาธารณะ · แสดงเฉพาะชื่อ วันที่ และสถานะ) */
function verifyCert_(p) {
  var r = T_('Certs').get(str_(p.no));
  if (!r) return { found: false };
  var st = certStatus_(r);
  return { found: true, no: r.cert_no, name: r.full_name, issued: r.issued_date, expire: r.expire_date, status: st, statusTh: CERT_ST_TH[st], course: setting_('courseName'), org: setting_('orgName') };
}

/* ---------------------------------------------------------------- ผู้ดูแล */
function listCerts_() {
  return T_('Certs').all().map(function (r) { var st = certStatus_(r); return { no: r.cert_no, userId: r.user_id, name: r.full_name, issued: r.issued_date, expire: r.expire_date, status: st, statusTh: CERT_ST_TH[st], hasFile: !!r.file_id, attempt: r.attempt_id, note: r.note }; }).reverse();
}
function regenCert_(c, p) {
  var r = T_('Certs').get(p.no); if (!r) throw new Error('ไม่พบใบเซอร์');
  if (r.file_id) { try { DriveApp.getFileById(r.file_id).setTrashed(true); } catch (e) { } }
  withLock_(function () { T_('Certs').upsert({ cert_no: r.cert_no, file_id: '', full_name: fullName_(T_('Users').get(r.user_id) || { first_name: r.full_name }) }); });
  ensureCertFile_(T_('Certs').get(r.cert_no));
  audit_(c.user.email, 'CERT_REGEN', r.cert_no, '');
  return listCerts_();
}
function revokeCert_(c, p) {
  if (!str_(p.reason)) throw new Error('กรุณาระบุเหตุผลการยกเลิก');
  return withLock_(function () {
    var r = T_('Certs').get(p.no); if (!r) throw new Error('ไม่พบใบเซอร์');
    T_('Certs').upsert({ cert_no: r.cert_no, status: 'REVOKED', note: 'ยกเลิก: ' + str_(p.reason) });
    var u = T_('Users').get(r.user_id);
    if (u && u.sop_cert_no === r.cert_no) T_('Users').upsert({ user_id: u.user_id, sop_train_date: '', sop_expire_date: '', sop_cert_no: '' });
    audit_(c.user.email, 'CERT_REVOKE', r.cert_no, p.reason);
    return listCerts_();
  });
}
/** ออกใบเซอร์ให้โดยผู้ดูแล (เช่น อบรมแบบ onsite) */
function issueCertManual_(c, p) {
  var ymd = str_(p.date) || todayYmd_();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error('รูปแบบวันที่ไม่ถูกต้อง');
  var cert = withLock_(function () {
    var u = T_('Users').get(p.userId); if (!u) throw new Error('ไม่พบผู้เรียน');
    return issueCertRow_(u, 'MANUAL', ymd, c.user.email, 'ออกโดยผู้ดูแล: ' + str_(p.note));
  });
  try { ensureCertFile_(cert); } catch (e) { console.warn(e.message); }
  return listCerts_();
}
function previewCert_(c) {
  var f = renderCertPdf_({ name: 'นายแพทย์ตัวอย่าง ทดสอบระบบ', issued: todayYmd_(), expire: addYears_(todayYmd_(), num_(setting_('certYears'), 2)), no: str_(setting_('certPrefix')) + (new Date().getFullYear() + 543) + '/000' }, 'ตัวอย่างใบเซอร์');
  var b = f.getBlob(); f.setTrashed(true);
  return { name: 'Certificate_preview.pdf', mime: 'application/pdf', b64: Utilities.base64Encode(b.getBytes()) };
}

/**
 * สร้างแม่แบบใบเซอร์ใหม่ (Google Slides ขนาด A4 แนวนอน) ตามดีไซน์ Canva เดิม
 * ต้องเปิด Advanced Service "Google Slides API" (ระบุใน appsscript.json แล้ว) · พื้นหลังจาก <siteUrl>/cert-bg.png
 */
function rebuildCertTemplate_(c) {
  var W = 841.89, H = 595.28, presId;
  try {
    presId = Slides.Presentations.create({ title: 'แม่แบบใบเซอร์ SOP Training', pageSize: { width: { magnitude: W, unit: 'PT' }, height: { magnitude: H, unit: 'PT' } } }).presentationId;
  } catch (e) { throw new Error('สร้างไฟล์ Slides ไม่สำเร็จ (ตรวจว่าเปิด Services › Google Slides API แล้ว): ' + e.message); }
  var file = DriveApp.getFileById(presId); file.moveTo(certFolder_());
  var pres = SlidesApp.openById(presId), sl = pres.getSlides()[0];
  sl.getPageElements().forEach(function (e) { e.remove(); });
  try { sl.getBackground().setPictureFill(UrlFetchApp.fetch(siteUrl_() + 'cert-bg.png').getBlob()); } catch (e) { console.warn('bg ' + e.message); }
  function box(text, top, size, o) {
    o = o || {};
    var left = o.left != null ? o.left : 90, w = o.w || (W - 180), sh = sl.insertTextBox(text, left, top, w, o.h || size * 1.9);
    var tr = sh.getText(), st = tr.getTextStyle();
    st.setFontFamily(o.font || 'Sarabun').setFontSize(size).setBold(!!o.bold).setForegroundColor(o.color || '#2b2b2b');
    tr.getParagraphStyle().setParagraphAlignment(o.align === 'L' ? SlidesApp.ParagraphAlignment.START : SlidesApp.ParagraphAlignment.CENTER);
    if (o.lh) tr.getParagraphStyle().setLineSpacing(o.lh);
    return sh;
  }
  function line(x1, y, x2, color, wt) { var l = sl.insertLine(SlidesApp.LineCategory.STRAIGHT, x1, y, x2, y); l.getLineFill().setSolidFill(color); l.setWeight(wt || 1); }
  box('{{หน่วยงาน}}', 92, 22, { bold: true, font: 'Taviraj' });
  box('สภากาชาดไทย', 124, 18, { font: 'Taviraj', color: '#C8102E', bold: true });
  box('ขอมอบประกาศนียบัตรฉบับนี้เพื่อแสดงว่า', 152, 15, { font: 'Taviraj' });
  box('{{ชื่อ}}', 176, 38, { font: 'Taviraj', bold: true, color: '#A8792A', h: 62 });
  line(205, 242, W - 205, '#B8892B', 1.2);
  box('ผ่านการเข้าร่วมโครงการฝึกอบรมออนไลน์ในรูปแบบ E-Learning\n“{{หลักสูตร}}”\nจัดทำโดย {{สำนักงาน}} {{หน่วยงาน}}\nให้ไว้ ณ วันที่ {{วันที่}}', 250, 13.5, { font: 'Sarabun', left: 130, w: W - 260, h: 118, lh: 115 });
  box('{{ลายเซ็น}}', 378, 10, { left: W / 2 - 80, w: 160, h: 48, color: '#999999' });
  line(W / 2 - 110, 430, W / 2 + 110, '#555555', 0.6);
  box('{{ผู้ลงนาม}}\n{{ตำแหน่งผู้ลงนาม}}', 433, 11.5, { font: 'Sarabun', left: W / 2 - 200, w: 400, h: 64 });
  box('เลขที่ {{เลขที่}}   ·   ใช้ได้ถึงวันที่ {{วันหมดอายุ}}\nตรวจสอบความถูกต้อง: {{ลิงก์ตรวจสอบ}}', 532, 8, { align: 'L', left: 46, w: 520, h: 30, color: '#6b6b6b' });
  pres.saveAndClose();
  withLock_(function () { T_('Settings').upsert({ key: 'certTemplateId', value: presId, updated_at: nowIso_(), updated_by: c ? c.user.email : 'setup' }); });
  _SET = null;
  audit_(c ? c.user.email : 'setup', 'CERT_TEMPLATE', presId, '');
  return { id: presId, url: 'https://docs.google.com/presentation/d/' + presId + '/edit' };
}
