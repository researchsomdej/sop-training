/* QSMH IRB · SOP Training — pages-learn.js : หน้าผู้เรียน (หน้าหลัก · บทเรียน · เครื่องเล่นวิดีโอ · แบบทดสอบ · ใบประกาศนียบัตร · บัญชีของฉัน) */

function loadCourse(force) {
  if (S.cache.course && !force) return Promise.resolve(S.cache.course);
  return api('myCourse').then(function (d) { S.cache.course = d; return d; });
}
var TYPE_IC = { YOUTUBE: 'play', DRIVE: 'video', NONE: 'book' };

/* ---------------------------------------------------------------- หน้าหลัก */
route('/home', function (main) {
  loading(main);
  loadCourse(true).then(function (d) {
    var s = d.summary, st = S.boot.settings, pct = s.reqTotal ? Math.round(s.reqDone / s.reqTotal * 100) : 0, cs = s.cert.status, passed = cs === 'VALID' || cs === 'SOON';
    var next = d.modules.filter(function (m) { return !m.done && !m.locked; })[0];
    var stepNow = passed ? 4 : s.learnDone ? 2 : 1;
    main.innerHTML =
      (st.announce ? '<div class="note">' + ic('info') + '<div>' + esc(st.announce).replace(/\n/g, '<br>') + '</div></div>' : '') +
      '<section class="hero"><h1>สวัสดี ' + esc(S.me.name) + '</h1><p>' + esc(st.courseName) + '</p>' +
      '<div class="prog"><div class="bar"><i style="width:' + pct + '%"></i></div><div><b style="font-size:20px">' + s.reqDone + '/' + s.reqTotal + '</b> บท</div>' +
      (passed ? '<a class="btn gold" href="#/cert">' + ic('cert') + ' ใบประกาศนียบัตรของฉัน</a>' : next ? '<a class="btn gold" href="#/learn/' + next.id + '">' + ic('play') + (s.done ? ' เรียนต่อ' : ' เริ่มเรียน') + '</a>' : '<a class="btn gold" href="#/exam">' + ic('exam') + ' ทำแบบทดสอบ</a>') + '</div></section>' +
      '<div class="steps">' +
      step(1, 'เรียนวิดีโอ SOP ให้ครบ', 'ดูอย่างน้อย ' + st.watchPercent + '% ของแต่ละบท · ' + s.reqDone + '/' + s.reqTotal + ' บท', stepNow) +
      step(2, 'ทำแบบทดสอบ', 'ผ่านเกณฑ์ ' + st.passPercent + '% ขึ้นไป' + (d.attempts.length ? ' · สอบแล้ว ' + d.attempts.length + ' ครั้ง' : ''), stepNow) +
      step(3, 'รับใบประกาศนียบัตร', passed ? 'เลขที่ ' + s.cert.no + ' · ถึง ' + thDate(s.cert.expire) : 'ออกให้อัตโนมัติเมื่อสอบผ่าน (อายุ 2 ปี)', stepNow) + '</div>' +
      (cs === 'SOON' ? '<div class="note warn">' + ic('clock') + '<div>ใบประกาศนียบัตรของท่านจะหมดอายุใน ' + s.cert.daysLeft + ' วัน สามารถทบทวนบทเรียนและสอบต่ออายุได้แล้ว</div></div>' : '') +
      (cs === 'EXPIRED' ? '<div class="note bad">' + ic('alert') + '<div>ใบประกาศนียบัตรหมดอายุแล้วเมื่อ ' + thDateFull(s.cert.expire) + ' กรุณาสอบต่ออายุ</div></div>' : '') +
      '<div class="ph" style="margin-top:6px"><div class="t"><h2>บทเรียน SOP</h2><p>' + s.done + ' จาก ' + s.total + ' บทเรียนแล้ว</p></div><a class="btn" href="#/learn">ดูทั้งหมด</a></div>' + modGrid(d.modules);
    function step(n, t, sub, now) { var cls = n < now || (n === 3 && passed) ? 'done' : n === now ? 'now' : ''; return '<div class="step ' + cls + '"><div class="no">' + (cls === 'done' ? ic('check') : n) + '</div><div><b>' + t + '</b><span>' + esc(sub) + '</span></div></div>'; }
  }).catch(fail);
});
function modGrid(mods) {
  return '<div class="mods">' + mods.map(function (m) {
    return '<a class="mod ' + (m.done ? 'done' : '') + (m.locked ? ' locked' : '') + '" href="#/learn/' + m.id + '"><div class="h"><span class="code">' + esc(m.code) + '</span>' +
      (m.done ? '<span class="badge ok">' + ic('check') + ' เรียนแล้ว</span>' : m.locked ? '<span class="badge">' + ic('lock') + ' รอบทก่อนหน้า</span>' : m.percent ? '<span class="badge info">' + m.percent + '%</span>' : '') +
      (!m.required ? '<span class="badge">ไม่บังคับ</span>' : '') + '</div><div class="ti">' + esc(m.title) + '</div>' +
      '<div class="row small mut">' + ic(TYPE_IC[m.type] || 'play') + (m.duration ? mmss(m.duration) + ' นาที' : 'วิดีโอ') + '</div>' +
      '<div class="bar ' + (m.done ? 'ok' : '') + '"><i style="width:' + (m.done ? 100 : m.percent) + '%"></i></div></a>';
  }).join('') + '</div>';
}

/* ---------------------------------------------------------------- รายการบทเรียน */
route('/learn', function (main, parts) {
  if (parts[1]) return player(main, parts[1]);
  loading(main);
  loadCourse(true).then(function (d) {
    var s = d.summary;
    main.innerHTML = '<div class="ph"><div class="t"><h1>บทเรียน SOP</h1><p>เรียนแล้ว ' + s.done + ' จาก ' + s.total + ' บท · ต้องดูวิดีโออย่างน้อย ' + S.boot.settings.watchPercent + '% ของแต่ละบท' + (S.boot.settings.sequential ? ' · เรียนตามลำดับ' : '') + '</p></div>' +
      (d.exam.ok ? '<a class="btn pri" href="#/exam">' + ic('exam') + ' ไปทำแบบทดสอบ</a>' : '') + '</div>' + modGrid(d.modules);
  }).catch(fail);
});

/* ---------------------------------------------------------------- เครื่องเล่นวิดีโอ + heartbeat */
var YT_READY = null;
function loadYT() {
  if (YT_READY) return YT_READY;
  YT_READY = new Promise(function (ok, no) {
    if (window.YT && window.YT.Player) return ok();
    window.onYouTubeIframeAPIReady = function () { ok(); };
    var s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = function () { YT_READY = null; no(new Error('โหลดเครื่องเล่น YouTube ไม่ได้')); }; document.head.appendChild(s);
  });
  return YT_READY;
}
function player(main, id) {
  loading(main);
  api('getModule', { id: id }).then(function (m) {
    var st = S.boot.settings, need = st.watchPercent;
    main.innerHTML = '<div class="row small mut" style="margin-bottom:10px"><a href="#/learn">บทเรียน SOP</a> › บทที่ ' + m.index + ' จาก ' + m.count + '</div>' +
      '<div class="ph"><div class="t"><span class="badge info">' + esc(m.code) + '</span><h1 style="margin-top:8px">' + esc(m.title) + '</h1></div></div>' +
      (m.type === 'NONE' ? '<div class="card">' + (m.docUrl ? '<p><a class="btn" target="_blank" rel="noopener" href="' + esc(m.docUrl) + '">' + ic('book') + ' เปิดเอกสาร</a></p>' : '') + '<p>' + esc(m.note || 'บทนี้เป็นการอ่านเอกสาร') + '</p><button class="btn pri" id="readBtn" ' + (m.done ? 'disabled' : '') + '>' + ic('check') + (m.done ? ' เรียนบทนี้แล้ว' : ' ฉันอ่านบทนี้แล้ว') + '</button></div>'
        : '<div class="player" id="pl"></div>') +
      '<div class="card" style="margin-top:14px"><div class="watch"><div class="pct" id="pct">' + (m.done ? 100 : m.percent) + '%</div><div class="bar ' + (m.done ? 'ok' : '') + '" id="pbar"><i style="width:' + (m.done ? 100 : m.percent) + '%"></i></div><div id="pst">' + statusText(m) + '</div></div>' +
      '<p class="small mut" id="phelp" style="margin:10px 0 0">' + helpText(m) + '</p></div>' +
      (m.docUrl && m.type !== 'NONE' ? '<p><a target="_blank" rel="noopener" href="' + esc(m.docUrl) + '">' + ic('book') + ' เอกสาร SOP ประกอบบทเรียน</a></p>' : '') +
      '<div class="row" style="justify-content:space-between;margin-top:8px">' + (m.prev ? '<a class="btn" href="#/learn/' + m.prev + '">' + ic('left') + ' บทก่อนหน้า</a>' : '<span></span>') +
      (m.next ? '<a class="btn" href="#/learn/' + m.next + '" id="nextBtn">บทถัดไป ' + ic('right') + '</a>' : '<a class="btn pri" href="#/exam">ไปทำแบบทดสอบ ' + ic('right') + '</a>') + '</div>';
    function statusText(x) { return x.done ? '<span class="badge ok">' + ic('check') + ' เรียนบทนี้แล้ว</span>' : '<span class="badge">ต้องการ ' + need + '%</span>'; }
    function helpText(x) {
      if (x.type === 'YOUTUBE') return 'ระบบนับเวลาที่ดูวิดีโอจริง' + (st.noSkip ? ' · ยังกดข้ามไปข้างหน้าส่วนที่ไม่เคยดูไม่ได้' : '') + ' · ปิดหน้านี้แล้วกลับมาดูต่อจากเดิมได้';
      if (x.type === 'DRIVE') return 'กดเล่นวิดีโอแล้วเปิดหน้านี้ค้างไว้ ระบบนับเวลาขณะหน้านี้เปิดอยู่ (ต้องการประมาณ ' + mmss(x.duration * need / 100) + ' นาที) · หากวิดีโอไม่แสดง กรุณาแจ้งผู้ดูแล';
      return '';
    }
    var cur = { done: m.done };
    function apply(r) {
      var p = cur.done || r.done ? 100 : r.percent; $('#pct').textContent = p + '%'; $('#pbar').firstChild.style.width = p + '%';
      if (r.done && !cur.done) { cur.done = true; $('#pbar').classList.add('ok'); $('#pst').innerHTML = statusText({ done: true }); toast('เรียนบท ' + m.code + ' ครบแล้ว', 'ok'); S.cache.course = null; }
    }
    if (m.type === 'NONE') {
      var rb = $('#readBtn'); if (rb && !m.done) rb.onclick = function () { busy(rb, api('markRead', { id: m.id })).then(function () { apply({ done: true }); rb.disabled = true; rb.innerHTML = ic('check') + ' เรียนบทนี้แล้ว'; }).catch(fail); };
      return;
    }
    var pending = 0, sending = false, alive = true, BEAT = 20;
    function send(extra) {
      if (sending && !(extra && extra.ended)) return; if (!pending && !(extra && extra.ended)) return;
      var payload = Object.assign({ id: m.id, delta: Math.round(pending * 10) / 10 }, extra || {}); pending = 0; sending = true;
      api('beat', payload).then(function (r) { if (alive) apply(r); }).catch(function (e) { pending += payload.delta; if (e.message !== 'SESSION_EXPIRED') console.warn(e); }).finally(function () { sending = false; });
    }
    if (m.type === 'DRIVE') {
      $('#pl').innerHTML = '<iframe src="https://drive.google.com/file/d/' + encodeURIComponent(m.ref) + '/preview" allow="autoplay; fullscreen" allowfullscreen></iframe>';
      var t = setInterval(function () { if (document.visibilityState === 'visible') pending += 1; }, 1000);
      var b = setInterval(function () { send({ pos: 0 }); }, BEAT * 1000);
      onLeave(function () { alive = false; clearInterval(t); clearInterval(b); send({ pos: 0 }); });
      return;
    }
    // YouTube
    var ytp, lastT = null, maxOk = m.maxPos, ticker, beater, warned = 0;
    loadYT().then(function () {
      if (!alive) return;
      $('#pl').innerHTML = '<div id="ytp"></div>';
      ytp = new YT.Player('ytp', {
        videoId: m.ref, playerVars: { rel: 0, modestbranding: 1, playsinline: 1, start: m.done ? 0 : Math.max(0, Math.floor(m.maxPos) - 3) },
        events: {
          onStateChange: function (e) { if (e.data === YT.PlayerState.ENDED) { var d = ytp.getDuration(); send({ pos: d, dur: d, ended: true }); } if (e.data === YT.PlayerState.PAUSED) send({ pos: maxOk, dur: ytp.getDuration() }); },
          onPlaybackRateChange: function () { if (ytp.getPlaybackRate() > st.allowSpeed) { ytp.setPlaybackRate(st.allowSpeed); toast('ความเร็วสูงสุดที่นับเวลาเรียนคือ ' + st.allowSpeed + ' เท่า'); } }
        }
      });
      ticker = setInterval(function () {
        if (!ytp || !ytp.getPlayerState || ytp.getPlayerState() !== 1) { lastT = null; return; }
        var t = ytp.getCurrentTime(), rate = ytp.getPlaybackRate() || 1;
        if (st.noSkip && !cur.done && t > maxOk + 3) { ytp.seekTo(maxOk, true); if (Date.now() - warned > 4000) { toast('ยังข้ามไปข้างหน้าไม่ได้ กรุณาดูต่อจากจุดเดิม'); warned = Date.now(); } lastT = maxOk; return; }
        if (lastT != null) { var d = t - lastT; if (d > 0 && d <= 1.6 * rate + .3) { pending += d; if (t > maxOk) maxOk = t; } }
        lastT = t;
      }, 1000);
      beater = setInterval(function () { if (ytp && ytp.getDuration) send({ pos: maxOk, dur: ytp.getDuration() }); }, BEAT * 1000);
    }).catch(function (e) { $('#pl').innerHTML = '<div style="color:#fff;padding:30px">' + esc(e.message) + '</div>'; });
    function flush() { if (ytp && ytp.getDuration) send({ pos: maxOk, dur: ytp.getDuration() }); }
    var vis = function () { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', vis);
    onLeave(function () { alive = false; clearInterval(ticker); clearInterval(beater); document.removeEventListener('visibilitychange', vis); flush(); try { ytp && ytp.destroy(); } catch (e) { } });
  }).catch(function (e) { fail(e); main.innerHTML = '<div class="card"><p>' + esc(e.message) + '</p><a class="btn" href="#/learn">กลับไปหน้าบทเรียน</a></div>'; });
}

/* ---------------------------------------------------------------- แบบทดสอบ */
route('/exam', function (main) {
  loading(main);
  loadCourse(true).then(function (d) {
    var e = d.exam, st = S.boot.settings;
    var hist = d.attempts.length ? '<div class="card pad0"><div class="toolbar"><b>ประวัติการสอบ</b></div><div class="tw"><table class="t"><tr><th>วันเวลา</th><th class="num">คะแนน</th><th class="num">ร้อยละ</th><th>ผล</th></tr>' +
      d.attempts.map(function (a) { return '<tr><td>' + thDate(a.at, true) + '</td><td class="num">' + a.score + '/' + a.total + '</td><td class="num">' + a.percent + '%</td><td>' + (a.passed ? '<span class="badge ok">ผ่าน</span> ' + esc(a.certNo || '') : '<span class="badge bad">ไม่ผ่าน</span>') + '</td></tr>'; }).join('') + '</table></div></div>' : '';
    if (!e.ok) {
      main.innerHTML = '<div class="ph"><div class="t"><h1>แบบทดสอบ</h1></div></div><div class="card"><div class="note ' + (e.passed ? 'ok' : 'warn') + '">' + ic(e.passed ? 'check' : 'info') + '<div>' + esc(e.reason) + '</div></div>' +
        (e.passed ? '<a class="btn gold" href="#/cert">' + ic('cert') + ' ดูใบประกาศนียบัตร</a>' : '<a class="btn pri" href="#/learn">' + ic('play') + ' ไปที่บทเรียน</a>') + '</div>' + hist;
      return;
    }
    main.innerHTML = '<div class="ph"><div class="t"><h1>แบบทดสอบหลังเรียน' + (e.renew ? ' (ต่ออายุ)' : '') + '</h1><p>' + esc(st.courseName) + '</p></div></div>' +
      '<div class="card"><div class="grid g3" style="margin-bottom:16px"><div class="stat nv"><div class="n">' + e.count + '</div><div class="l">จำนวนข้อ (ปรนัย)</div></div><div class="stat nv"><div class="n">' + e.passPercent + '%</div><div class="l">เกณฑ์ผ่าน</div></div><div class="stat nv"><div class="n">' + (e.timeLimitMin ? e.timeLimitMin + ' นาที' : 'ไม่จำกัด') + '</div><div class="l">เวลา</div></div></div>' +
      '<ul class="small mut" style="margin-top:0"><li>ข้อสอบและตัวเลือกสลับลำดับทุกครั้ง</li><li>ระบบบันทึกคำตอบไว้ในเครื่อง หากหลุดจากหน้าจอสามารถกลับมาทำต่อได้</li><li>' + (e.maxAttempts ? 'สอบได้ไม่เกิน ' + e.maxAttempts + ' ครั้ง (ใช้ไปแล้ว ' + e.attemptsUsed + ')' : 'หากไม่ผ่านสามารถสอบใหม่ได้') + '</li><li>เมื่อผ่านเกณฑ์ ระบบออกใบประกาศนียบัตรให้ทันที</li></ul>' +
      '<button class="btn pri lg" id="go" data-busy="กำลังเตรียมข้อสอบ…">' + ic('exam') + ' เริ่มทำแบบทดสอบ</button></div>' + hist;
    $('#go').onclick = function () { busy($('#go'), api('startExam')).then(function (x) { takeExam(main, x); }).catch(fail); };
  }).catch(fail);
});
function takeExam(main, x) {
  var key = 'qsmhirb.ans.' + x.attemptId, ans = []; try { ans = JSON.parse(store(key) || '[]'); } catch (e) { }
  var L = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ', 'ช', 'ซ'];
  main.innerHTML = '<div class="ph"><div class="t"><h1>แบบทดสอบ</h1><p>ตอบให้ครบทุกข้อแล้วกด "ส่งคำตอบ" · เกณฑ์ผ่าน ' + x.passPercent + '%</p></div><div id="timer" class="badge info" style="font-size:15px;padding:6px 14px"></div></div>' +
    x.questions.map(function (q, i) {
      return '<div class="q" id="q' + i + '"><div class="qt"><span class="qn">' + q.n + '</span><div>' + esc(q.text) + (q.sop ? ' <span class="tiny mut">(SOP ' + esc(q.sop) + ')</span>' : '') + '</div></div>' +
        q.options.map(function (o, k) { return '<label class="opt"><input type="radio" name="a' + i + '" value="' + k + '"><span class="lb">' + L[k] + '.</span><span>' + esc(o) + '</span></label>'; }).join('') + '</div>';
    }).join('') +
    '<div class="sticky-foot"><div class="b" id="cnt"></div><div style="flex:1"></div><button class="btn pri lg" id="sub" data-busy="กำลังตรวจคำตอบ…">' + ic('send') + ' ส่งคำตอบ</button></div>';
  function upd() {
    var n = 0; x.questions.forEach(function (q, i) { var on = ans[i] != null && ans[i] >= 0; if (on) n++; $('#q' + i).classList.toggle('answered', on); $$('#q' + i + ' .opt').forEach(function (o, k) { o.classList.toggle('sel', ans[i] === k); }); });
    $('#cnt').textContent = 'ตอบแล้ว ' + n + ' / ' + x.questions.length + ' ข้อ'; return n;
  }
  x.questions.forEach(function (q, i) { if (ans[i] != null && ans[i] >= 0) { var r = main.querySelector('input[name=a' + i + '][value="' + ans[i] + '"]'); if (r) r.checked = true; } });
  main.addEventListener('change', function (e) { var m = e.target.name && e.target.name.match(/^a(\d+)$/); if (!m) return; ans[+m[1]] = +e.target.value; store(key, JSON.stringify(ans)); upd(); });
  upd();
  var tm;
  if (x.secondsLeft != null) {
    var end = Date.now() + x.secondsLeft * 1000;
    tm = setInterval(function () { var s = Math.round((end - Date.now()) / 1000); $('#timer').textContent = 'เหลือเวลา ' + mmss(s); if (s <= 0) { clearInterval(tm); toast('หมดเวลา ระบบส่งคำตอบอัตโนมัติ'); submit(true); } }, 1000);
    onLeave(function () { clearInterval(tm); });
  } else $('#timer').remove();
  function submit(force) {
    var n = upd(), miss = x.questions.length - n;
    var go = force || !miss ? Promise.resolve(true) : confirmBox('ยังตอบไม่ครบ', 'ยังไม่ได้ตอบ <b>' + miss + '</b> ข้อ ข้อที่ไม่ตอบจะนับเป็นตอบผิด ต้องการส่งคำตอบหรือไม่', 'ส่งคำตอบ');
    go.then(function (ok) {
      if (!ok) { var first = x.questions.findIndex(function (q, i) { return !(ans[i] >= 0); }); if (first >= 0) $('#q' + first).scrollIntoView({ behavior: 'smooth' }); return; }
      busy($('#sub'), api('submitExam', { attemptId: x.attemptId, answers: x.questions.map(function (q, i) { return ans[i] == null ? -1 : ans[i]; }) })).then(function (r) {
        if (tm) clearInterval(tm); store(key, null); S.cache.course = null; showResult(main, r);
      }).catch(fail);
    });
  }
  $('#sub').onclick = function () { submit(false); };
}
function showResult(main, r) {
  window.scrollTo(0, 0);
  var col = r.passed ? 'var(--ok)' : 'var(--bad)', L = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ', 'ช', 'ซ'];
  main.innerHTML = '<div class="card" style="text-align:center;max-width:640px;margin:0 auto 16px"><div class="ring" style="background:conic-gradient(' + col + ' ' + r.percent * 3.6 + 'deg,#ece9e1 0)"><div><div><b>' + r.percent + '%</b><span class="small mut">' + r.score + '/' + r.total + ' ข้อ</span></div></div></div>' +
    (r.passed ? '<h2 style="color:var(--ok)">ยินดีด้วย ท่านผ่านเกณฑ์</h2><p>ใบประกาศนียบัตรเลขที่ <b>' + esc(r.cert.no) + '</b><br>ใช้ได้ถึง ' + thDateFull(r.cert.expire) + '</p><button class="btn gold lg" id="dl" data-busy="กำลังสร้างไฟล์…">' + ic('download') + ' ดาวน์โหลดใบประกาศนียบัตร (PDF)</button>'
      : '<h2 style="color:var(--bad)">ยังไม่ผ่านเกณฑ์ (' + r.passPercent + '%)</h2><p class="mut">ทบทวนบทเรียนแล้วสอบใหม่ได้</p><div class="row" style="justify-content:center"><a class="btn" href="#/learn">ทบทวนบทเรียน</a><a class="btn pri" href="#/exam">สอบใหม่</a></div>') + '</div>' +
    (r.review ? '<h2>เฉลยรายข้อ</h2>' + r.review.map(function (q) {
      return '<div class="q"><div class="qt"><span class="qn" style="background:' + (q.right ? 'var(--ok-l);color:var(--ok)' : 'var(--bad-l);color:var(--bad)') + '">' + q.n + '</span><div>' + esc(q.text) + '</div></div>' +
        q.options.map(function (o, k) { return '<div class="opt ' + (k === q.correct ? 'right' : k === q.your ? 'wrong' : '') + '"><span class="lb">' + L[k] + '.</span><span>' + esc(o) + '</span></div>'; }).join('') + (q.explain ? '<p class="small mut">' + esc(q.explain) + '</p>' : '') + '</div>';
    }).join('') : '');
  var dl = $('#dl'); if (dl) dl.onclick = function () { busy(dl, api('downloadCert', { no: r.cert.no })).then(downloadB64).catch(fail); };
}

/* ---------------------------------------------------------------- ใบประกาศนียบัตร */
route('/cert', function (main) {
  loading(main);
  loadCourse(true).then(function (d) {
    var c = d.summary.cert, has = c.status !== 'NONE';
    main.innerHTML = '<div class="ph"><div class="t"><h1>ใบประกาศนียบัตร</h1><p>การอบรม SOP คณะกรรมการจริยธรรมการวิจัยในมนุษย์</p></div></div>' +
      (has ? '<div class="certcard"><div class="row" style="justify-content:space-between"><div><div class="small mut">เลขที่</div><div class="no">' + esc(c.no) + '</div></div>' + certBadge(c.status) + '</div>' +
        '<dl class="kv" style="margin:16px 0"><dt>ชื่อ</dt><dd><b>' + esc(S.me.name) + '</b></dd><dt>วันที่ผ่านการอบรม</dt><dd>' + thDateFull(c.issued) + '</dd><dt>ใช้ได้ถึง</dt><dd>' + thDateFull(c.expire) + (c.daysLeft >= 0 ? ' (อีก ' + nf(c.daysLeft) + ' วัน)' : '') + '</dd></dl>' +
        '<div class="row"><button class="btn gold" id="dl" data-busy="กำลังสร้างไฟล์…">' + ic('download') + ' ดาวน์โหลด PDF</button><button class="btn" id="cp">' + ic('link') + ' คัดลอกลิงก์ตรวจสอบ</button></div></div>'
        : '<div class="card"><div class="note">' + ic('info') + '<div>ท่านยังไม่มีใบประกาศนียบัตร เมื่อเรียนครบและสอบผ่านเกณฑ์ ระบบจะออกให้ทันที</div></div><a class="btn pri" href="' + (d.exam.ok ? '#/exam' : '#/learn') + '">' + (d.exam.ok ? 'ไปทำแบบทดสอบ' : 'ไปที่บทเรียน') + '</a></div>');
    if (has) {
      $('#dl').onclick = function () { busy($('#dl'), api('downloadCert', { no: c.no })).then(downloadB64).catch(fail); };
      $('#cp').onclick = function () { copyText(location.href.split('#')[0] + '#/verify?no=' + encodeURIComponent(c.no)); };
    }
  }).catch(fail);
});

/* ---------------------------------------------------------------- บัญชีของฉัน */
route('/me', function (main) {
  var m = S.me;
  main.innerHTML = '<div class="ph"><div class="t"><h1>บัญชีของฉัน</h1><p>บัญชีกลางของระบบคณะกรรมการจริยธรรมการวิจัย (ใช้รหัสผ่านเดียวกันทุกระบบ)</p></div></div><div class="grid g2">' +
    '<div class="card"><h2>' + ic('user') + ' ข้อมูลของฉัน</h2><dl class="kv"><dt>ชื่อ</dt><dd>' + esc(m.name) + '</dd><dt>อีเมล</dt><dd>' + esc(m.email) + '</dd><dt>กลุ่ม</dt><dd>' + esc(m.groupTh || '-') + '</dd><dt>ตำแหน่งในคณะกรรมการ</dt><dd>' + esc(m.boardRole || '-') + '</dd><dt>ตำแหน่ง/หน่วยงาน</dt><dd>' + esc([m.position, m.department].filter(Boolean).join(' · ') || '-') + '</dd></dl>' +
    '<p class="small mut" style="margin-top:14px">หากข้อมูลไม่ถูกต้อง กรุณาแจ้ง' + esc(S.boot.settings.officeName) + '</p></div>' +
    '<div class="card"><h2>' + ic('lock') + ' เปลี่ยนรหัสผ่าน</h2><form id="f"><label class="f"><span>รหัสผ่านเดิม</span>' + pwInput('o') + '</label><label class="f"><span>รหัสผ่านใหม่</span>' + pwInput('n1', '', 'new-password') + '<small>อย่างน้อย 8 ตัวอักษร มีทั้งตัวอักษรภาษาอังกฤษและตัวเลข · เปลี่ยนแล้วเครื่องอื่นจะออกจากระบบ</small></label><label class="f"><span>ยืนยันรหัสผ่านใหม่</span>' + pwInput('n2', '', 'new-password') + '</label><button class="btn pri">บันทึกรหัสผ่านใหม่</button></form>' +
    '<hr style="border:none;border-top:1px solid var(--line);margin:18px 0"><button class="btn danger" id="outAll">' + ic('logout') + ' ออกจากระบบทุกเครื่อง</button></div></div>';
  $('#f').onsubmit = function (e) {
    e.preventDefault(); var f = e.target; if (f.n1.value !== f.n2.value) { toast('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน', 'bad'); return; }
    busy(f.querySelector('button'), api('changePassword', { oldPassword: f.o.value, newPassword: f.n1.value })).then(function (r) { S.token = r.token; store(TOKEN_KEY, r.token); f.reset(); toast('เปลี่ยนรหัสผ่านเรียบร้อย', 'ok'); }).catch(fail);
  };
  $('#outAll').onclick = function () { confirmBox('ออกจากระบบทุกเครื่อง', 'ทุกอุปกรณ์ที่เข้าสู่ระบบด้วยบัญชีนี้จะต้องเข้าสู่ระบบใหม่', 'ออกจากระบบ', true).then(function (ok) { if (!ok) return; api('logout', { all: true }).finally(function () { logoutLocal(); location.hash = '#/login'; location.reload(); }); }); };
});
