/* ระบบสอบออนไลน์ GitHub Pages (ไม่ใช้ framework / ไม่ต้อง build) */
(() => {
  'use strict';
  const cfg = window.EXAM_CONFIG;
  const questions = window.EXAM_QUESTIONS;
  if (!cfg || !Array.isArray(questions) || !questions.length) {
    document.body.textContent = 'ไม่สามารถโหลดข้อสอบได้ กรุณาตรวจสอบไฟล์ config.js และ questions.js';
    return;
  }
  const VERSION = 'programming-basics-lesson1-v1';
  const KEY_ACTIVE = VERSION + '-active';
  const KEY_DONE = VERSION + '-completed';
  const qById = Object.fromEntries(questions.map(q => [q.id, q]));
  let attempt = null;
  let result = null;
  let timerId = null;
  let isSubmitting = false;
  const $ = id => document.getElementById(id);
  const n = Math.max(1, Number(cfg.durationMinutes) || 30);
  const passPercent = Math.max(0, Math.min(100, Number(cfg.passPercent) || 60));

  function shuffle(items) {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) { console.warn('localStorage unavailable', error); return false; }
  }
  function safeGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (_) { return null; }
  }
  function safeRemove(key) { try { localStorage.removeItem(key); } catch (_) {} }
  function newId() {
    return (crypto.randomUUID ? crypto.randomUUID() : ('attempt-' + Date.now() + '-' + Math.random().toString(36).slice(2)));
  }
  function showScreen(id) {
    ['introScreen', 'examScreen', 'resultScreen'].forEach(name => $(name).classList.toggle('hidden', name !== id));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function formatClock(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  function countAnswered() { return Object.keys(attempt.answers).filter(id => attempt.answers[id]).length; }
  function saveAttempt() { if (attempt) safeSet(KEY_ACTIVE, attempt); }

  function initialize() {
    $('schoolName').textContent = cfg.collegeName || '';
    $('departmentName').textContent = cfg.department || '';
    $('footerCourse').textContent = cfg.courseCode || '';
    $('introCount').textContent = questions.length + ' ข้อ';
    $('introDuration').textContent = n + ' นาที';
    $('introPass').textContent = passPercent + '%';
    document.title = (cfg.title || 'แบบทดสอบออนไลน์') + ' | ' + (cfg.subtitle || '');
    $('startForm').addEventListener('submit', startAttempt);
    $('resumeBtn').addEventListener('click', resumeAttempt);
    $('restartBtn').addEventListener('click', () => { if (confirm('ต้องการลบคำตอบเดิมและเริ่มสอบใหม่ใช่หรือไม่?')) { safeRemove(KEY_ACTIVE); $('resumeBar').classList.add('hidden'); } });
    $('prevBtn').addEventListener('click', () => jumpTo(attempt.activeIndex - 1));
    $('nextBtn').addEventListener('click', () => {
      if (attempt.activeIndex === questions.length - 1) confirmSubmission();
      else jumpTo(attempt.activeIndex + 1);
    });
    $('asideSubmit').addEventListener('click', confirmSubmission);
    $('cancelSubmit').addEventListener('click', () => $('confirmDialog').close());
    $('confirmSubmit').addEventListener('click', () => { $('confirmDialog').close(); finishAttempt(false); });
    $('printBtn').addEventListener('click', () => window.print());
    $('downloadBtn').addEventListener('click', downloadReceipt);
    $('retrySendBtn').addEventListener('click', sendToSheets);
    $('retakeBtn').addEventListener('click', () => {
      result = null;
      $('startForm').reset();
      $('resumeBar').classList.add('hidden');
      showScreen('introScreen');
    });
    $('confirmDialog').addEventListener('click', e => { if (e.target === $('confirmDialog')) $('confirmDialog').close(); });
    const saved = safeGet(KEY_ACTIVE);
    if (validateAttempt(saved)) $('resumeBar').classList.remove('hidden');
  }

  function validateAttempt(item) {
    return item && item.version === VERSION && item.profile && Array.isArray(item.order) &&
      item.order.length === questions.length && new Set(item.order).size === questions.length &&
      item.order.every(id => qById[id]) && item.optionOrder && item.answers &&
      Number.isFinite(item.deadlineAt) && Number.isInteger(item.activeIndex);
  }
  function startAttempt(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    if (!cfg.allowRetakeOnSameBrowser && safeGet(KEY_DONE)) {
      alert('อุปกรณ์นี้เคยส่งข้อสอบแล้ว กรุณาติดต่อครูผู้สอนหากต้องการทำใหม่ (การจำกัดนี้เป็นเพียงการจำกัดระดับเบราว์เซอร์)');
      return;
    }
    if (validateAttempt(safeGet(KEY_ACTIVE)) && !confirm('มีข้อสอบที่ยังไม่เสร็จอยู่ ต้องการเริ่มใหม่และลบคำตอบเดิมใช่หรือไม่?')) return;
    const now = Date.now();
    const order = cfg.shuffleQuestions ? shuffle(questions.map(q => q.id)) : questions.map(q => q.id);
    const optionOrder = {};
    for (const q of questions) optionOrder[q.id] = cfg.shuffleOptions ? shuffle(Object.keys(q.options)) : Object.keys(q.options);
    attempt = {
      version: VERSION,
      id: newId(),
      profile: {
        name: $('studentName').value.trim(),
        studentId: $('studentId').value.trim(),
        studentClass: $('studentClass').value.trim(),
        number: $('studentNumber').value.trim()
      },
      startedAt: now,
      deadlineAt: now + n * 60 * 1000,
      activeIndex: 0,
      order, optionOrder, answers: {}
    };
    if (!attempt.profile.name || !attempt.profile.studentId || !attempt.profile.studentClass) return;
    saveAttempt();
    openExam();
  }
  function resumeAttempt() {
    const saved = safeGet(KEY_ACTIVE);
    if (!validateAttempt(saved)) { alert('ไม่พบข้อมูลการทำข้อสอบที่ทำต่อได้'); return; }
    attempt = saved;
    openExam();
  }
  function openExam() {
    showScreen('examScreen');
    $('examPerson').textContent = attempt.profile.name + ' · ' + attempt.profile.studentClass;
    renderQuestion();
    clearInterval(timerId);
    updateTimer();
    timerId = setInterval(updateTimer, 1000);
    document.addEventListener('visibilitychange', updateTimer);
  }
  function updateTimer() {
    if (!attempt || isSubmitting) return;
    const remaining = Math.max(0, Math.ceil((attempt.deadlineAt - Date.now()) / 1000));
    $('timerText').textContent = formatClock(remaining);
    $('clockFill').style.width = (100 * remaining / (n * 60)).toFixed(2) + '%';
    $('clockFill').parentElement.parentElement.classList.toggle('warning', remaining <= 300);
    if (remaining === 0) finishAttempt(true);
  }
  function jumpTo(index) {
    if (!attempt || isSubmitting || index < 0 || index >= attempt.order.length) return;
    attempt.activeIndex = index;
    saveAttempt();
    renderQuestion();
    if (window.innerWidth < 700) window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function renderQuestion() {
    if (!attempt || isSubmitting) return;
    const i = attempt.activeIndex;
    const q = qById[attempt.order[i]];
    $('questionCounter').textContent = `ข้อที่ ${i + 1} จาก ${questions.length}`;
    $('questionText').textContent = q.text;
    $('topicBadge').textContent = q.topic;
    $('prevBtn').disabled = i === 0;
    $('nextBtn').textContent = i === questions.length - 1 ? 'ส่งข้อสอบ ✓' : 'ข้อถัดไป →';
    const answerArea = $('answersList');
    answerArea.replaceChildren();
    const letters = ['ก', 'ข', 'ค', 'ง'];
    attempt.optionOrder[q.id].forEach((key, displayIdx) => {
      const label = document.createElement('label');
      label.className = 'answer-option' + (attempt.answers[q.id] === key ? ' selected' : '');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'answer';
      radio.value = key;
      radio.checked = attempt.answers[q.id] === key;
      radio.className = 'sr-only';
      radio.setAttribute('aria-label', `ตัวเลือก ${letters[displayIdx]}: ${q.options[key]}`);
      const optKey = document.createElement('span');
      optKey.className = 'option-key';
      optKey.textContent = letters[displayIdx];
      const text = document.createElement('span');
      text.className = 'option-text';
      text.textContent = q.options[key];
      label.append(radio, optKey, text);
      if (radio.checked) { const check = document.createElement('span'); check.className = 'choice-check'; check.textContent = '✓'; label.append(check); }
      radio.addEventListener('change', () => {
        if (isSubmitting) return;
        attempt.answers[q.id] = key;
        saveAttempt();
        renderQuestion();
      });
      answerArea.appendChild(label);
    });
    updateQuestionNav();
  }
  function updateQuestionNav() {
    const nav = $('questionNav');
    nav.replaceChildren();
    attempt.order.forEach((id, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-number' + (attempt.answers[id] ? ' answered' : '') + (i === attempt.activeIndex ? ' current' : '');
      btn.textContent = String(i + 1);
      btn.setAttribute('aria-label', `ข้อที่ ${i+1} ${attempt.answers[id] ? 'ตอบแล้ว' : 'ยังไม่ตอบ'}`);
      if (i === attempt.activeIndex) btn.setAttribute('aria-current', 'step');
      btn.addEventListener('click', () => jumpTo(i));
      nav.appendChild(btn);
    });
    const count = countAnswered();
    $('progressCount').textContent = `${count} / ${questions.length} ข้อ`;
    $('progressFill').style.width = (100 * count / questions.length) + '%';
  }
  function confirmSubmission() {
    if (!attempt || isSubmitting) return;
    if (Date.now() >= attempt.deadlineAt) { finishAttempt(true); return; }
    const unanswered = questions.length - countAnswered();
    $('confirmText').textContent = unanswered
      ? `คุณยังไม่ได้ตอบ ${unanswered} ข้อ หากยืนยันส่งข้อสอบ ระบบจะคิดข้อที่เว้นว่างเป็น 0 คะแนน ต้องการส่งเลยหรือไม่?`
      : 'ตอบครบทุกข้อแล้ว หากยืนยันจะไม่สามารถกลับมาแก้คำตอบได้ ต้องการส่งข้อสอบหรือไม่?';
    $('confirmDialog').showModal();
  }
  function finishAttempt(timedOut) {
    if (!attempt || isSubmitting) return;
    isSubmitting = true;
    clearInterval(timerId);
    document.removeEventListener('visibilitychange', updateTimer);
    const finishedAt = Date.now();
    const correct = questions.filter(q => attempt.answers[q.id] === q.answer).length;
    const percent = Math.round(correct * 10000 / questions.length) / 100;
    result = {
      attemptId: attempt.id,
      profile: { ...attempt.profile },
      answers: { ...attempt.answers },
      startedAt: attempt.startedAt,
      finishedAt,
      durationSeconds: Math.max(0, Math.round((finishedAt - attempt.startedAt) / 1000)),
      score: correct,
      total: questions.length,
      percentage: percent,
      passed: percent >= passPercent,
      timedOut: !!timedOut
    };
    safeRemove(KEY_ACTIVE);
    if (!cfg.allowRetakeOnSameBrowser) safeSet(KEY_DONE, {at: finishedAt, attemptId: result.attemptId});
    attempt = null;
    isSubmitting = false;
    renderResult();
    sendToSheets();
  }
  function renderResult() {
    showScreen('resultScreen');
    $('resultIdentity').textContent = `${result.profile.name} · ${result.profile.studentClass} · รหัส ${result.profile.studentId}`;
    $('scoreValue').replaceChildren(document.createTextNode(String(result.score)));
    const small = document.createElement('span'); small.textContent = '/' + result.total; $('scoreValue').appendChild(small);
    $('scorePercent').textContent = result.percentage + '%';
    $('scoreRing').style.setProperty('--score-angle', (360 * result.score / result.total) + 'deg');
    $('passBadge').textContent = result.passed ? 'ผ่านเกณฑ์การประเมิน' : 'ยังไม่ผ่านเกณฑ์';
    $('passBadge').classList.toggle('failed', !result.passed);
    $('resultDescription').textContent = `${result.timedOut ? 'หมดเวลาสอบ · ' : ''}เกณฑ์ผ่าน ${passPercent}% (${Math.ceil(result.total*passPercent/100)} คะแนนขึ้นไป)`;
    $('correctNum').textContent = result.score + ' ข้อ';
    $('wrongNum').textContent = (result.total - result.score) + ' ข้อ';
    $('usedTime').textContent = formatClock(result.durationSeconds);
    $('retrySendBtn').classList.add('hidden');
    $('sheetStatus').textContent = '';
    $('reviewBox').classList.add('hidden');
    if (cfg.showReviewAfterSubmit) {
      const review = $('reviewBox'); review.replaceChildren();
      for (const [idx, q] of questions.entries()) {
        const item = document.createElement('div');
        item.className = 'review-item';
        const own = result.answers[q.id];
        const right = own === q.answer;
        const head = document.createElement('strong'); head.className = right ? 'review-ok' : 'review-no';
        head.textContent = `${idx+1}. ${right ? '✓ ถูกต้อง' : '✗ ไม่ถูกต้อง'} · ${q.text}`;
        const detail = document.createElement('div');
        detail.textContent = `คำตอบ: ${own ? q.options[own] : 'ไม่ได้ตอบ'} | เฉลย: ${q.options[q.answer]}`;
        item.append(head, detail); review.appendChild(item);
      }
      review.classList.remove('hidden');
    }
  }
  async function sendToSheets() {
    if (!result) return;
    const endpoint = (cfg.sheetEndpoint || '').trim();
    const status = $('sheetStatus');
    if (!endpoint) {
      status.textContent = 'ยังไม่ได้ตั้งค่ารับคะแนนอัตโนมัติ: โปรดดาวน์โหลดสลิปผลสอบส่งให้ครูผู้สอน หรือให้ครูเชื่อม Google Sheets ตามคู่มือ README.md';
      return;
    }
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(endpoint)) {
      status.textContent = 'การตั้งค่า Google Sheets URL ไม่ถูกต้อง โปรดแจ้งครูผู้สอนให้ตรวจสอบไฟล์ config.js';
      return;
    }
    $('retrySendBtn').classList.add('hidden');
    status.textContent = 'กำลังส่งผลสอบไปยัง Google Sheets ...';
    // โหมด no-cors ส่ง POST ได้ แต่ไม่สามารถอ่านการตอบกลับจากบริการภายนอก (opaque response)
    try {
      const body = new URLSearchParams({ payload: JSON.stringify({
        examVersion: VERSION,
        attemptId: result.attemptId,
        ...result
      }) });
      await fetch(endpoint, { method: 'POST', mode: 'no-cors', body, redirect: 'follow' });
      status.textContent = 'ส่งคำขอบันทึกผลสอบแล้ว กรุณาให้ครูตรวจสอบข้อมูลใน Google Sheets เพื่อยืนยันว่าได้รับคะแนน (เว็บไซต์ไม่สามารถตรวจสอบผลตอบกลับจาก Google Apps Script ได้โดยตรง)';
    } catch (err) {
      console.error('Score submit error:', err);
      status.textContent = 'อุปกรณ์นี้ยังส่งผลสอบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต แล้วกด “ส่งคะแนนอีกครั้ง” หรือดาวน์โหลดสลิปส่งครู';
      $('retrySendBtn').classList.remove('hidden');
    }
  }
  function downloadReceipt() {
    if (!result) return;
    const safeCsv = value => {
      let v = String(value ?? '').replace(/\r?\n/g, ' ');
      if (/^[\s]*[=+@\-]/.test(v)) v = "'" + v; // ลดความเสี่ยง CSV formula injection
      return '"' + v.replace(/"/g, '""') + '"';
    };
    const headers = ['วันเวลาส่ง','ชื่อ-นามสกุล','รหัสนักเรียน','ชั้น/กลุ่ม','เลขที่','วิชา','คะแนน','คะแนนเต็ม','ร้อยละ','ผ่านเกณฑ์','เวลาใช้ (วินาที)','รหัสการสอบ'];
    const cells = [new Date(result.finishedAt).toLocaleString('th-TH'),result.profile.name,result.profile.studentId,result.profile.studentClass,result.profile.number,cfg.courseName,result.score,result.total,result.percentage,result.passed?'ผ่าน':'ไม่ผ่าน',result.durationSeconds,result.attemptId];
    const content = '\uFEFF' + headers.map(safeCsv).join(',') + '\r\n' + cells.map(safeCsv).join(',') + '\r\n';
    const blob = new Blob([content], { type:'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `result-${result.profile.studentId.replace(/[^a-zA-Z0-9_-]/g,'_') || 'student'}.csv`;
    document.body.appendChild(link);
    link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 3000);
  }
  initialize();
})();
