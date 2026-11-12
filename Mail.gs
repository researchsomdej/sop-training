/**
 * Mail.gs : ส่งอีเมล + สวิตช์เปิด/ปิด (กันอีเมลหลุดไปถึงกรรมการระหว่างทดลองระบบ)
 *  mailMode = OFF  → ไม่ส่งเลย บันทึกใน MailLog สถานะ "ไม่ส่ง (ปิดอีเมล)"  ← ค่าเริ่มต้น
 *  mailMode = TEST → ส่งทุกฉบับไปที่ mailTestTo เท่านั้น (หัวเรื่องบอกผู้รับจริง)
 *  mailMode = ON   → ส่งถึงผู้รับจริง
 * MailLog ไม่เก็บลิงก์ตั้งรหัสผ่าน (กันลิงก์รั่ว)
 */
function mailTemplates_(kind, d) {
  var s = settings_(), course = s.courseName, office = s.officeName + ' ' + s.orgName, site = siteUrl_();
  var btn = function (url, text) { return '<p style="margin:22px 0"><a href="' + url + '" style="background:#1d3a6e;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">' + text + '</a></p>'; };
  var T = {
    INVITE: ['เชิญเข้าร่วมการอบรม SOP ออนไลน์ คณะกรรมการจริยธรรมการวิจัยในมนุษย์',
      '<p>เรียน ' + d.name + '</p><p>' + office + ' ขอเชิญท่านเข้าร่วมการอบรมออนไลน์ (E-Learning) หลักสูตร “' + course + '”</p>' +
      '<p>บัญชีของท่านคือ <b>' + d.email + '</b> กรุณากดปุ่มด้านล่างเพื่อตั้งรหัสผ่านของท่านเอง (ลิงก์มีอายุ ' + d.days + ' วัน และใช้ได้ครั้งเดียว)</p>' + btn(d.link, 'ตั้งรหัสผ่านและเริ่มเรียน') +
      '<p>บัญชีนี้เป็นบัญชีกลางของระบบสารสนเทศคณะกรรมการจริยธรรมการวิจัย ใช้รหัสผ่านเดียวกันกับระบบอื่นของคณะกรรมการฯ ในอนาคต</p>'],
    RESET: ['ลิงก์ตั้งรหัสผ่านใหม่ · ระบบอบรม SOP ออนไลน์',
      '<p>เรียน ' + d.name + '</p><p>มีการขอตั้งรหัสผ่านใหม่สำหรับบัญชีของท่าน กรุณากดปุ่มด้านล่าง (ลิงก์มีอายุ ' + d.days + ' วัน ใช้ได้ครั้งเดียว)</p>' + btn(d.link, 'ตั้งรหัสผ่านใหม่') +
      '<p>หากท่านไม่ได้เป็นผู้ขอ ไม่ต้องดำเนินการใด ๆ รหัสผ่านเดิมยังใช้ได้ตามปกติ</p>'],
    PASSED: ['ผลการอบรม SOP: ผ่านเกณฑ์ · ใบประกาศนียบัตรเลขที่ ' + d.certNo,
      '<p>เรียน ' + d.name + '</p><p>ขอแสดงความยินดี ท่านผ่านการอบรมออนไลน์หลักสูตร “' + course + '” ด้วยคะแนน <b>' + d.score + '</b></p>' +
      '<p>ใบประกาศนียบัตรเลขที่ <b>' + d.certNo + '</b> ใช้ได้ถึงวันที่ <b>' + d.expire + '</b>' + (d.attached ? ' (แนบไฟล์มากับอีเมลนี้)' : '') + '</p>' + btn(site, 'เปิดระบบเพื่อดาวน์โหลดใบประกาศนียบัตร')],
    REMIND_COURSE: ['แจ้งเตือน: การอบรม SOP ออนไลน์ของท่านยังไม่เสร็จสิ้น',
      '<p>เรียน ' + d.name + '</p><p>ขณะนี้ท่านเรียนไปแล้ว ' + d.done + ' จาก ' + d.total + ' บท' + (d.examReady ? ' และพร้อมทำแบบทดสอบแล้ว' : '') + '</p>' +
      '<p>กรรมการทุกท่านต้องผ่านการอบรม SOP ตามข้อกำหนดของคณะกรรมการฯ กรุณาเข้าเรียนให้ครบและทำแบบทดสอบให้ผ่านเกณฑ์</p>' + btn(site, 'เข้าเรียนต่อ')],
    REMIND_EXPIRE: ['แจ้งเตือน: ใบประกาศนียบัตรการอบรม SOP จะหมดอายุใน ' + d.days + ' วัน',
      '<p>เรียน ' + d.name + '</p><p>ใบประกาศนียบัตรเลขที่ ' + d.certNo + ' ของท่านจะหมดอายุวันที่ <b>' + d.expire + '</b></p><p>ท่านสามารถเข้าระบบเพื่อทบทวนบทเรียนและสอบต่ออายุได้แล้ว</p>' + btn(site, 'เข้าสู่ระบบ')],
    TEST: ['ทดสอบการส่งอีเมล · ระบบอบรม SOP ออนไลน์', '<p>อีเมลฉบับนี้ส่งจากปุ่ม "ทดสอบส่งอีเมล" ในหน้าตั้งค่า เวลา ' + nowIso_() + '</p>']
  };
  var t = T[kind]; if (!t) throw new Error('ไม่มีแม่แบบอีเมล ' + kind);
  var html = '<div style="font-family:Sarabun,Tahoma,sans-serif;font-size:15px;line-height:1.7;color:#1f2937;max-width:620px">' + t[1] +
    '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"><p style="font-size:13px;color:#6b7280">' + office + '<br>อีเมลนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ</p></div>';
  return { subject: t[0], html: html };
}

/** ส่งอีเมล 1 ฉบับ ตามโหมด · คืน {status:'SENT'|'SKIPPED'|'FAILED', note} */
function sendMail_(to, kind, data, attachments) {
  var mode = String(setting_('mailMode') || 'OFF').toUpperCase(), m = mailTemplates_(kind, data || {}), real = str_(to), dest = real, subject = m.subject, status, note = '';
  if (!emailOk_(real)) { status = 'FAILED'; note = 'ไม่มีอีเมล/อีเมลไม่ถูกต้อง'; }
  else if (mode === 'OFF') { status = 'SKIPPED'; note = 'ไม่ส่ง (ปิดอีเมล)'; }
  else {
    if (mode === 'TEST') {
      dest = str_(setting_('mailTestTo'));
      if (!emailOk_(dest)) { status = 'FAILED'; note = 'โหมดทดสอบ แต่ยังไม่ได้ตั้งอีเมลทดสอบ'; }
      subject = '[ทดสอบ → ' + real + '] ' + subject;
    }
    if (!status) {
      try {
        var o = { to: dest, subject: subject, htmlBody: m.html, name: setting_('mailSender') };
        if (attachments && attachments.length) o.attachments = attachments;
        MailApp.sendEmail(o);
        status = 'SENT'; note = mode === 'TEST' ? 'ส่งไปอีเมลทดสอบ ' + dest : '';
      } catch (e) { status = 'FAILED'; note = e.message; }
    }
  }
  try { T_('MailLog').append({ ts: nowIso_(), to: real, subject: m.subject, kind: kind, status: status, detail: note }); } catch (e) { }
  return { status: status, note: note };
}
var MAIL_STATUS_TH = { SENT: 'ส่งแล้ว', SKIPPED: 'ไม่ส่ง (ปิดอีเมล)', FAILED: 'ส่งไม่สำเร็จ' };

function testMail_(c, p) {
  var to = str_(p.to) || c.user.email;
  var r = sendMail_(to, 'TEST', {});
  audit_(c.user.email, 'TEST_MAIL', to, r.status);
  return r;
}
function listMailLog_(c, p) { return T_('MailLog').tail(num_(p.limit, 300)); }
