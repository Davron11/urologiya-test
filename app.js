(function () {
  'use strict';

  var QUESTIONS = window.QUESTIONS || [];
  var STORE_SESSION = 'uro.session.v1';
  var STORE_MISTAKES = 'uro.mistakes.v1';
  var STORE_LAST = 'uro.last.v1';
  var STORE_LANG = 'uro.lang';
  var COUNT_OPTIONS = [10, 20, 30, 50, 100, 0]; // 0 = all
  var LETTERS = 'ABCDEFGHIJ';
  var PASS_GOOD = 85;
  var PASS_OK = 60;

  var I18N = {
    uz: {
      eyebrow: 'Urologiya · 2024', title: 'Bilimingizni sinab ko‘ring',
      lead: 'Rasmiy test bazasi asosida mashq qiling: darhol tekshiruv, xatolar ustida ishlash va natijalar tahlili.',
      statTotal: 'savol', statLast: 'oxirgi natija', statMist: 'xatolar',
      count: 'Savollar soni', all_: 'Barchasi', range: 'Savollar oralig‘i',
      shuffleQ: 'Savollarni aralashtirish', shuffleA: 'Javoblarni aralashtirish',
      instant: 'Javobni darhol ko‘rsatish', start: 'Testni boshlash',
      resume: 'Davom ettirish · {a}/{b}', mistakes: 'Xatolar · {n}',
      check: 'Tasdiqlash', next: 'Keyingi', finishBtn: 'Yakunlash', all: 'Savollar',
      finish: 'Yakunlash', result: 'Natija', reviewWrong: 'Xatolarni ko‘rish',
      retryWrong: 'Xatolarni qayta yechish', home: 'Bosh sahifa',
      qOf: 'Savol {a} / {b}', orig: 'Baza № {n}',
      one: 'Bitta javobni tanlang', many: 'Bir nechta javob tanlash mumkin',
      ok: 'To‘g‘ri javob!', bad: 'Noto‘g‘ri. To‘g‘ri javob yashil rangda ko‘rsatilgan',
      part: 'Qisman to‘g‘ri. Barcha to‘g‘ri javoblar yashil rangda',
      tagOk: '✓ To‘g‘ri', tagBad: '✕ Noto‘g‘ri', tagMissed: 'To‘g‘ri javob',
      lgOk: 'to‘g‘ri', lgBad: 'noto‘g‘ri', lgSel: 'tanlangan', unanswered: 'javobsiz',
      confirmFinish: 'Testni yakunlaysizmi? Javob berilmagan savollar: {n}',
      noWrong: 'Xatolar yo‘q — ajoyib natija!',
      emptyRange: 'Tanlangan oraliqda savollar yo‘q',
      tGood: 'A’lo natija!', tOk: 'Yaxshi, lekin yana mashq qiling', tBad: 'Ko‘proq tayyorlanish kerak'
    },
    ru: {
      eyebrow: 'Урология · 2024', title: 'Проверьте свои знания',
      lead: 'Тренируйтесь по официальной базе тестов: мгновенная проверка, работа над ошибками и разбор результатов.',
      statTotal: 'вопросов', statLast: 'последний результат', statMist: 'ошибок',
      count: 'Количество вопросов', all_: 'Все', range: 'Диапазон вопросов',
      shuffleQ: 'Перемешать вопросы', shuffleA: 'Перемешать ответы',
      instant: 'Сразу показывать ответ', start: 'Начать тест',
      resume: 'Продолжить · {a}/{b}', mistakes: 'Ошибки · {n}',
      check: 'Подтвердить', next: 'Далее', finishBtn: 'Завершить', all: 'Вопросы',
      finish: 'Завершить', result: 'Результат', reviewWrong: 'Разбор ошибок',
      retryWrong: 'Перерешать ошибки', home: 'На главную',
      qOf: 'Вопрос {a} / {b}', orig: 'В базе № {n}',
      one: 'Выберите один ответ', many: 'Можно выбрать несколько ответов',
      ok: 'Правильно!', bad: 'Неверно. Правильный ответ выделен зелёным',
      part: 'Частично верно. Все правильные ответы выделены зелёным',
      tagOk: '✓ Верно', tagBad: '✕ Неверно', tagMissed: 'Правильный ответ',
      lgOk: 'верно', lgBad: 'неверно', lgSel: 'выбрано', unanswered: 'без ответа',
      confirmFinish: 'Завершить тест? Вопросов без ответа: {n}',
      noWrong: 'Ошибок нет — отличный результат!',
      emptyRange: 'В выбранном диапазоне нет вопросов',
      tGood: 'Отличный результат!', tOk: 'Неплохо, но стоит потренироваться', tBad: 'Нужно больше подготовки'
    }
  };

  var lang = readStore(STORE_LANG) === 'ru' ? 'ru' : 'uz';
  var countChoice = 20;
  var session = null;
  var lastFinished = null;

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function t(key, vars) {
    var s = I18N[lang][key] || key;
    Object.keys(vars || {}).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function readStore(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStore(key, val) {
    try {
      if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val);
    } catch (e) { /* storage unavailable: app still works without persistence */ }
  }
  function readJSON(key) {
    try { return JSON.parse(readStore(key)); } catch (e) { return null; }
  }
  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
  function range(n) { var r = []; for (var i = 0; i < n; i++) r.push(i); return r; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function show(id) {
    ['start', 'quiz', 'result'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
    window.scrollTo(0, 0);
  }
  function applyStaticText() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-t]').forEach(function (n) { n.textContent = t(n.getAttribute('data-t')); });
    $('langBtn').textContent = lang === 'uz' ? 'RU' : 'UZ';
  }

  /* ---------- grading ---------- */
  function sameSet(a, b) {
    return a.length === b.length && a.every(function (x) { return b.indexOf(x) !== -1; });
  }
  function statusOf(s, i) {
    var sel = s.selected[i];
    if (!sel || !sel.length) return 'none';
    return sameSet(sel, QUESTIONS[s.ids[i]].c) ? 'ok' : 'bad';
  }
  function tally(s, onlyChecked) {
    var r = { ok: 0, bad: 0, none: 0 };
    s.ids.forEach(function (_, i) {
      if (onlyChecked && !s.checked[i]) return;
      r[statusOf(s, i)]++;
    });
    return r;
  }

  /* ---------- persistence ---------- */
  function newSession(ids, opts) {
    var order = opts.shuffleQ ? shuffled(ids) : ids.slice();
    return {
      ids: order,
      ansOrder: order.map(function (q) {
        var idx = range(QUESTIONS[q].a.length);
        return opts.shuffleA ? shuffled(idx) : idx;
      }),
      selected: order.map(function () { return []; }),
      checked: order.map(function () { return false; }),
      cur: 0,
      instant: opts.instant
    };
  }
  function save() { writeStore(STORE_SESSION, session ? JSON.stringify(session) : null); }
  function loadSession() {
    var s = readJSON(STORE_SESSION);
    if (!s || !Array.isArray(s.ids) || !s.ids.length) return null;
    return s.ids.every(function (q) { return QUESTIONS[q]; }) ? s : null;
  }
  function getMistakes() {
    var m = readJSON(STORE_MISTAKES);
    return Array.isArray(m) ? m.filter(function (q) { return QUESTIONS[q]; }) : [];
  }
  function recordOutcome(qid, ok) {
    var m = getMistakes().filter(function (x) { return x !== qid; });
    if (!ok) m.push(qid);
    writeStore(STORE_MISTAKES, JSON.stringify(m));
  }

  /* ---------- start screen ---------- */
  function renderStart() {
    applyStaticText();
    $('statTotal').textContent = QUESTIONS.length;
    var last = readJSON(STORE_LAST);
    $('statLast').textContent = typeof last === 'number' ? last + '%' : '—';
    var m = getMistakes();
    $('statMist').textContent = m.length;

    var chips = $('countChips');
    chips.textContent = '';
    COUNT_OPTIONS.forEach(function (n) {
      var b = el('button', n === countChoice ? 'on' : '', n === 0 ? t('all_') : String(n));
      b.type = 'button';
      b.addEventListener('click', function () { countChoice = n; renderStart(); });
      chips.appendChild(b);
    });

    var existing = loadSession();
    $('resumeBtn').classList.toggle('hidden', !existing);
    if (existing) {
      var done = existing.selected.filter(function (x) { return x.length; }).length;
      $('resumeBtn').textContent = t('resume', { a: done, b: existing.ids.length });
    }
    $('mistakesBtn').classList.toggle('hidden', !m.length);
    $('mistakesBtn').textContent = t('mistakes', { n: m.length });
  }

  function readOptions() {
    return {
      shuffleQ: $('optShuffleQ').checked,
      shuffleA: true, // always: source file lists correct answers first
      instant: $('optInstant').checked
    };
  }

  function startNew() {
    var from = Math.max(1, parseInt($('rangeFrom').value, 10) || 1);
    var to = Math.min(QUESTIONS.length, parseInt($('rangeTo').value, 10) || QUESTIONS.length);
    var pool = range(QUESTIONS.length).slice(from - 1, to);
    if (!pool.length) { alert(t('emptyRange')); return; }
    var opts = readOptions();
    if (countChoice && countChoice < pool.length) {
      pool = opts.shuffleQ ? shuffled(pool).slice(0, countChoice) : pool.slice(0, countChoice);
    }
    beginSession(newSession(pool, opts));
  }

  function beginSession(s) {
    session = s;
    save();
    $('side').classList.remove('open');
    show('quiz');
    renderQuiz();
  }

  /* ---------- quiz screen ---------- */
  function answerState(q, ai, sel, locked) {
    var isSel = sel.indexOf(ai) !== -1;
    var isCorrect = q.c.indexOf(ai) !== -1;
    if (!locked) return { cls: isSel ? 'sel' : '', tag: '' };
    if (isCorrect && isSel) return { cls: 'correct', tag: t('tagOk') };
    if (isCorrect) return { cls: 'correct missed', tag: t('tagMissed') };
    if (isSel) return { cls: 'wrong', tag: t('tagBad') };
    return { cls: 'dim', tag: '' };
  }

  function buildAnswer(tag, q, ai, pos, sel, locked, multi) {
    var st = answerState(q, ai, sel, locked);
    var node = el(tag, 'answer' + (multi ? ' multi' : '') + (st.cls ? ' ' + st.cls : ''));
    var icon = st.cls.indexOf('wrong') !== -1 ? '✕' : (st.cls === 'correct' ? '✓' : (multi ? '✓' : ''));
    var ctl = el('span', 'ctl', icon);
    ctl.setAttribute('aria-hidden', 'true');
    node.appendChild(ctl);
    node.appendChild(el('span', 'atext', q.a[ai]));
    node.setAttribute('data-key', LETTERS[pos]);
    if (st.tag) node.appendChild(el('span', 'tag', st.tag));
    return node;
  }

  function renderQuiz() {
    applyStaticText();
    var s = session, i = s.cur, q = QUESTIONS[s.ids[i]];
    var multi = q.c.length > 1;
    var locked = s.checked[i];
    var sel = s.selected[i];
    var counts = tally(s, true);

    $('qNum').textContent = t('qOf', { a: i + 1, b: s.ids.length });
    $('scoreOk').textContent = counts.ok;
    $('scoreBad').textContent = counts.bad;
    $('scoreOk').parentNode.classList.toggle('hidden', !s.instant);
    $('barFill').style.transform = 'scaleX(' + ((i + 1) / s.ids.length) + ')';
    $('qOrig').textContent = t('orig', { n: s.ids[i] + 1 });
    $('qHint').textContent = multi ? t('many') : t('one');
    $('qHint').className = 'hint ' + (multi ? 'hint-multi' : 'hint-single');
    $('qCard').classList.toggle('is-multi', multi);
    $('qText').textContent = q.q;

    var box = $('answers');
    box.textContent = '';
    box.classList.toggle('locked', locked);
    s.ansOrder[i].forEach(function (ai, pos) {
      var b = buildAnswer('button', q, ai, pos, sel, locked, multi);
      b.type = 'button';
      b.setAttribute('role', multi ? 'checkbox' : 'radio');
      b.setAttribute('aria-checked', String(sel.indexOf(ai) !== -1));
      if (!locked) b.addEventListener('click', function () { toggleAnswer(ai, multi); });
      box.appendChild(b);
    });

    renderFeedback(s, i, q, locked, sel);

    var isLast = i === s.ids.length - 1;
    var needCheck = s.instant && !locked;
    $('prevBtn').disabled = i === 0;
    $('checkBtn').classList.toggle('hidden', !needCheck);
    $('checkBtn').disabled = !sel.length;
    $('nextBtn').classList.toggle('hidden', needCheck);
    $('nextBtn').textContent = (isLast ? t('finishBtn') : t('next')) + ' →';
    renderGrid();
  }

  function renderFeedback(s, i, q, locked, sel) {
    var fb = $('feedback');
    fb.classList.toggle('hidden', !locked);
    if (!locked) return;
    var st = statusOf(s, i);
    var partial = st === 'bad' && sel.some(function (x) { return q.c.indexOf(x) !== -1; });
    fb.className = 'feedback ' + (st === 'ok' ? 'ok' : partial ? 'part' : 'bad');
    fb.textContent = st === 'ok' ? t('ok') : partial ? t('part') : t('bad');
  }

  function toggleAnswer(ai, multi) {
    var s = session, i = s.cur;
    var sel = s.selected[i];
    // answers are only graded when the user presses the confirm button
    var next = !multi ? [ai]
      : sel.indexOf(ai) !== -1 ? sel.filter(function (x) { return x !== ai; })
      : sel.concat([ai]);
    s.selected = s.selected.map(function (v, k) { return k === i ? next : v; });
    save();
    renderQuiz();
  }

  function checkCurrent() {
    var s = session, i = s.cur;
    if (!s.selected[i].length) return;
    s.checked = s.checked.map(function (v, k) { return k === i ? true : v; });
    recordOutcome(s.ids[i], statusOf(s, i) === 'ok');
    save();
    renderQuiz();
  }

  function go(delta) {
    var n = session.cur + delta;
    if (n < 0) return;
    if (n >= session.ids.length) { finish(true); return; }
    session.cur = n;
    save();
    renderQuiz();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderGrid() {
    var g = $('grid');
    g.textContent = '';
    session.ids.forEach(function (_, i) {
      var b = el('button', '', String(i + 1));
      b.type = 'button';
      var st = statusOf(session, i);
      if (session.checked[i] && st !== 'none') b.classList.add(st);
      else if (session.selected[i].length) b.classList.add('sel');
      if (i === session.cur) b.classList.add('cur');
      b.addEventListener('click', function () {
        session.cur = i; save(); renderQuiz();
        $('side').classList.remove('open');
      });
      g.appendChild(b);
    });
  }

  function finish(ask) {
    var s = session;
    var unanswered = s.selected.filter(function (x) { return !x.length; }).length;
    if (ask && unanswered && !confirm(t('confirmFinish', { n: unanswered }))) return;
    s.ids.forEach(function (qid, i) {
      if (!s.checked[i] && s.selected[i].length) recordOutcome(qid, statusOf(s, i) === 'ok');
    });
    var r = tally(s, false);
    writeStore(STORE_LAST, JSON.stringify(Math.round(r.ok / s.ids.length * 100)));
    lastFinished = s;
    session = null;
    save();
    show('result');
    renderResult();
  }

  /* ---------- result screen ---------- */
  function renderResult() {
    applyStaticText();
    var s = lastFinished, r = tally(s, false);
    var pct = Math.round(r.ok / s.ids.length * 100);
    var ring = $('ring');
    ring.style.setProperty('--p', pct);
    ring.style.setProperty('--c', pct >= PASS_GOOD ? 'var(--ok)' : pct >= PASS_OK ? 'var(--warn)' : 'var(--bad)');
    $('resPercent').textContent = pct + '%';
    $('resTitle').textContent = pct >= PASS_GOOD ? t('tGood') : pct >= PASS_OK ? t('tOk') : t('tBad');
    $('resOk').textContent = r.ok;
    $('resBad').textContent = r.bad;
    $('resNone').textContent = r.none;
    var hasWrong = r.bad + r.none > 0;
    $('reviewBtn').classList.toggle('hidden', !hasWrong);
    $('retryWrongBtn').classList.toggle('hidden', !hasWrong);
    var box = $('review');
    box.textContent = '';
    if (!hasWrong) box.appendChild(el('p', 'panel', t('noWrong')));
  }

  function renderReview() {
    var s = lastFinished, box = $('review');
    box.textContent = '';
    s.ids.forEach(function (qid, i) {
      if (statusOf(s, i) === 'ok') return;
      var q = QUESTIONS[qid], sel = s.selected[i], multi = q.c.length > 1;
      var card = el('div', 'panel');
      card.appendChild(el('div', 'qmeta', t('orig', { n: qid + 1 }) + (sel.length ? '' : ' · ' + t('unanswered'))));
      card.appendChild(el('h3', '', q.q));
      var list = el('div', 'answers locked');
      s.ansOrder[i].forEach(function (ai, pos) { list.appendChild(buildAnswer('div', q, ai, pos, sel, true, multi)); });
      card.appendChild(list);
      box.appendChild(card);
    });
    box.scrollIntoView({ behavior: 'smooth' });
  }

  function retryWrong() {
    var s = lastFinished;
    var ids = s.ids.filter(function (_, i) { return statusOf(s, i) !== 'ok'; });
    beginSession(newSession(ids, readOptions()));
  }

  /* ---------- wiring ---------- */
  $('rangeFrom').value = 1;
  $('rangeTo').value = QUESTIONS.length;
  $('rangeFrom').max = $('rangeTo').max = QUESTIONS.length;

  $('langBtn').addEventListener('click', function () {
    lang = lang === 'uz' ? 'ru' : 'uz';
    writeStore(STORE_LANG, lang);
    if (!$('quiz').classList.contains('hidden') && session) renderQuiz();
    else if (!$('result').classList.contains('hidden') && lastFinished) renderResult();
    else renderStart();
  });
  $('startBtn').addEventListener('click', startNew);
  $('resumeBtn').addEventListener('click', function () {
    var s = loadSession();
    if (s) { session = s; show('quiz'); renderQuiz(); }
  });
  $('mistakesBtn').addEventListener('click', function () {
    var m = getMistakes();
    if (m.length) beginSession(newSession(m, readOptions()));
  });
  $('prevBtn').addEventListener('click', function () { go(-1); });
  $('nextBtn').addEventListener('click', function () { go(1); });
  $('checkBtn').addEventListener('click', checkCurrent);
  $('finishBtn').addEventListener('click', function () { finish(true); });
  $('gridBtn').addEventListener('click', function () { $('side').classList.toggle('open'); });
  $('reviewBtn').addEventListener('click', renderReview);
  $('retryWrongBtn').addEventListener('click', retryWrong);
  $('homeBtn').addEventListener('click', function () { show('start'); renderStart(); });

  document.addEventListener('keydown', function (e) {
    if (!session || $('quiz').classList.contains('hidden')) return;
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'Enter' && !$('checkBtn').classList.contains('hidden')) checkCurrent();
    else {
      var pos = LETTERS.indexOf(e.key.toUpperCase());
      var btn = pos >= 0 ? $('answers').children[pos] : null;
      if (btn && btn.tagName === 'BUTTON') btn.click();
    }
  });

  renderStart();
})();
