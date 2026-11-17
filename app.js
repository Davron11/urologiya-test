(function () {
  'use strict';

  var QUESTIONS = window.QUESTIONS || [];
  var STORE_SESSION = 'uro.session.v1';
  var STORE_MISTAKES = 'uro.mistakes.v1';
  var STORE_LANG = 'uro.lang';
  var COUNT_OPTIONS = [10, 20, 30, 50, 100, 0]; // 0 = all
  var LETTERS = 'ABCDEFGHIJ';

  var I18N = {
    uz: {
      title: 'Urologiya bo‘yicha test', total: 'Bazada {n} ta savol',
      count: 'Savollar soni', all_: 'Hammasi', range: 'Savollar oralig‘i (raqamlar)',
      shuffleQ: 'Savollarni aralashtirish', shuffleA: 'Javoblarni aralashtirish',
      instant: 'Javobni darhol ko‘rsatish', start: 'Testni boshlash',
      resume: 'Davom ettirish ({a}/{b})', mistakes: 'Xatolar ustida ishlash ({n})',
      prev: '← Orqaga', check: 'Tekshirish', next: 'Keyingi →', all: 'Barcha savollar',
      finish: 'Yakunlash', result: 'Natija', reviewWrong: 'Xatolarni ko‘rish',
      retryWrong: 'Xatolarni qayta yechish', home: 'Bosh sahifa',
      qOf: 'Savol {a} / {b}', score: '✔ {a}  ✘ {b}', orig: '№ {n}',
      one: '1 ta javob', many: '{n} ta javob tanlang',
      ok: 'To‘g‘ri!', bad: 'Noto‘g‘ri', part: 'Qisman to‘g‘ri — to‘g‘ri javoblar yashil rangda',
      resText: '{a} ta to‘g‘ri, {b} ta noto‘g‘ri, {c} ta javobsiz (jami {t})',
      confirmFinish: 'Testni yakunlaysizmi? Javob berilmagan savollar: {n}',
      noWrong: 'Xatolar yo‘q — ajoyib!', yourAns: 'Sizning javobingiz', unanswered: 'Javob berilmagan',
      emptyRange: 'Tanlangan oraliqda savollar yo‘q'
    },
    ru: {
      title: 'Тест по урологии', total: 'В базе {n} вопросов',
      count: 'Количество вопросов', all_: 'Все', range: 'Диапазон вопросов (номера)',
      shuffleQ: 'Перемешать вопросы', shuffleA: 'Перемешать ответы',
      instant: 'Сразу показывать правильный ответ', start: 'Начать тест',
      resume: 'Продолжить ({a}/{b})', mistakes: 'Работа над ошибками ({n})',
      prev: '← Назад', check: 'Проверить', next: 'Далее →', all: 'Все вопросы',
      finish: 'Завершить', result: 'Результат', reviewWrong: 'Посмотреть ошибки',
      retryWrong: 'Перерешать ошибки', home: 'На главную',
      qOf: 'Вопрос {a} / {b}', score: '✔ {a}  ✘ {b}', orig: '№ {n}',
      one: '1 ответ', many: 'Выберите {n} ответа',
      ok: 'Правильно!', bad: 'Неправильно', part: 'Частично верно — правильные ответы выделены зелёным',
      resText: '{a} верно, {b} неверно, {c} без ответа (всего {t})',
      confirmFinish: 'Завершить тест? Вопросов без ответа: {n}',
      noWrong: 'Ошибок нет — отлично!', yourAns: 'Ваш ответ', unanswered: 'Без ответа',
      emptyRange: 'В выбранном диапазоне нет вопросов'
    }
  };

  var lang = readStore(STORE_LANG) || 'uz';
  var countChoice = 20;
  var session = null;
  var lastFinished = null;

  function $(id) { return document.getElementById(id); }
  function t(key, vars) {
    var s = (I18N[lang] && I18N[lang][key]) || key;
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

  /* ---------- grading ---------- */
  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    return a.every(function (x) { return b.indexOf(x) !== -1; });
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

  /* ---------- session ---------- */
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
    var valid = s.ids.every(function (q) { return QUESTIONS[q]; });
    return valid ? s : null;
  }
  function getMistakes() {
    var m = readJSON(STORE_MISTAKES);
    return Array.isArray(m) ? m.filter(function (q) { return QUESTIONS[q]; }) : [];
  }
  function setMistakes(list) { writeStore(STORE_MISTAKES, JSON.stringify(list)); }
  function recordOutcome(qid, ok) {
    var m = getMistakes().filter(function (x) { return x !== qid; });
    if (!ok) m.push(qid);
    setMistakes(m);
  }

  /* ---------- start screen ---------- */
  function renderStart() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-t]').forEach(function (n) { n.textContent = t(n.getAttribute('data-t')); });
    $('langBtn').textContent = lang === 'uz' ? 'RU' : 'UZ';
    $('totalInfo').textContent = t('total', { n: QUESTIONS.length });

    var chips = $('countChips');
    chips.textContent = '';
    COUNT_OPTIONS.forEach(function (n) {
      var b = el('button', 'chip' + (n === countChoice ? ' on' : ''), n === 0 ? t('all_') : String(n));
      b.type = 'button';
      b.addEventListener('click', function () { countChoice = n; renderStart(); });
      chips.appendChild(b);
    });

    var existing = loadSession();
    var resume = $('resumeBtn');
    resume.classList.toggle('hidden', !existing);
    if (existing) {
      var done = existing.selected.filter(function (x) { return x.length; }).length;
      resume.textContent = t('resume', { a: done, b: existing.ids.length });
    }
    var m = getMistakes();
    $('mistakesBtn').classList.toggle('hidden', !m.length);
    $('mistakesBtn').textContent = t('mistakes', { n: m.length });
    if (session && !$('quiz').classList.contains('hidden')) renderQuiz();
  }

  function readOptions() {
    return {
      shuffleQ: $('optShuffleQ').checked,
      shuffleA: $('optShuffleA').checked,
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
    $('grid').classList.add('hidden');
    show('quiz');
    renderQuiz();
  }

  /* ---------- quiz screen ---------- */
  function renderQuiz() {
    var s = session, i = s.cur, q = QUESTIONS[s.ids[i]];
    var multi = q.c.length > 1;
    var locked = s.checked[i];
    var sel = s.selected[i];
    var counts = tally(s, true);

    $('qNum').textContent = t('qOf', { a: i + 1, b: s.ids.length });
    $('score').textContent = s.instant ? t('score', { a: counts.ok, b: counts.bad }) : '';
    $('barFill').style.width = ((i + 1) / s.ids.length * 100) + '%';
    $('qOrig').textContent = t('orig', { n: s.ids[i] + 1 });
    $('qHint').textContent = multi ? t('many', { n: q.c.length }) : t('one');
    $('qText').textContent = q.q;

    var box = $('answers');
    box.textContent = '';
    box.classList.toggle('locked', locked);
    s.ansOrder[i].forEach(function (ai, pos) {
      var b = el('button', 'answer' + (multi ? ' multi' : ''));
      b.type = 'button';
      var isSel = sel.indexOf(ai) !== -1;
      var isCorrect = q.c.indexOf(ai) !== -1;
      if (locked) {
        if (isCorrect && isSel) b.classList.add('correct');
        else if (isCorrect) b.classList.add('correct', 'missed');
        else if (isSel) b.classList.add('wrong');
      } else if (isSel) b.classList.add('sel');
      b.setAttribute('aria-pressed', String(isSel));
      b.appendChild(el('span', 'mark', LETTERS[pos]));
      b.appendChild(el('span', '', q.a[ai]));
      if (!locked) b.addEventListener('click', function () { toggleAnswer(ai, multi); });
      box.appendChild(b);
    });

    var fb = $('feedback');
    fb.classList.toggle('hidden', !locked);
    if (locked) {
      var st = statusOf(s, i);
      var partial = st === 'bad' && sel.some(function (x) { return q.c.indexOf(x) !== -1; });
      fb.className = 'feedback ' + (st === 'ok' ? 'ok' : partial ? 'part' : 'bad');
      fb.textContent = st === 'ok' ? t('ok') : partial ? t('part') : t('bad');
    }

    $('prevBtn').disabled = i === 0;
    var needCheck = s.instant && !locked;
    $('checkBtn').classList.toggle('hidden', !needCheck);
    $('checkBtn').disabled = !sel.length;
    $('nextBtn').classList.toggle('hidden', needCheck);
    $('nextBtn').textContent = i === s.ids.length - 1 ? t('finish') : t('next');
    if (!$('grid').classList.contains('hidden')) renderGrid();
  }

  function toggleAnswer(ai, multi) {
    var s = session, i = s.cur;
    var sel = s.selected[i];
    var next;
    if (multi) {
      next = sel.indexOf(ai) !== -1 ? sel.filter(function (x) { return x !== ai; }) : sel.concat([ai]);
    } else {
      next = [ai];
    }
    s.selected = s.selected.map(function (v, k) { return k === i ? next : v; });
    // single-answer in instant mode: check immediately on tap
    if (!multi && s.instant) { checkCurrent(); return; }
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
    if (n >= session.ids.length) { finish(false); return; }
    session.cur = n;
    save();
    renderQuiz();
    window.scrollTo(0, 0);
  }

  function renderGrid() {
    var g = $('grid');
    g.textContent = '';
    session.ids.forEach(function (_, i) {
      var b = el('button', '', String(i + 1));
      b.type = 'button';
      var st = statusOf(session, i);
      var reveal = session.checked[i];
      if (reveal && st !== 'none') b.classList.add(st);
      else if (session.selected[i].length) b.style.borderColor = 'var(--accent)';
      if (i === session.cur) b.classList.add('cur');
      b.addEventListener('click', function () { session.cur = i; save(); renderQuiz(); });
      g.appendChild(b);
    });
  }

  function finish(ask) {
    var s = session;
    var unanswered = s.selected.filter(function (x) { return !x.length; }).length;
    if (ask && !confirm(t('confirmFinish', { n: unanswered }))) return;
    s.ids.forEach(function (qid, i) {
      if (!s.checked[i] && s.selected[i].length) recordOutcome(qid, statusOf(s, i) === 'ok');
    });
    lastFinished = s;
    session = null;
    save();
    renderResult();
  }

  /* ---------- result screen ---------- */
  function renderResult() {
    var s = lastFinished, r = tally(s, false), total = s.ids.length;
    show('result');
    document.querySelectorAll('#result [data-t]').forEach(function (n) { n.textContent = t(n.getAttribute('data-t')); });
    $('resPercent').textContent = Math.round(r.ok / total * 100) + '%';
    $('resText').textContent = t('resText', { a: r.ok, b: r.bad, c: r.none, t: total });
    var hasWrong = r.bad + r.none > 0;
    $('reviewBtn').classList.toggle('hidden', !hasWrong);
    $('retryWrongBtn').classList.toggle('hidden', !hasWrong);
    $('review').textContent = '';
    if (!hasWrong) $('review').appendChild(el('p', 'card center', t('noWrong')));
  }

  function renderReview() {
    var s = lastFinished, box = $('review');
    box.textContent = '';
    s.ids.forEach(function (qid, i) {
      if (statusOf(s, i) === 'ok') return;
      var q = QUESTIONS[qid], sel = s.selected[i];
      var card = el('div', 'card review-item');
      card.appendChild(el('div', 'qmeta', t('orig', { n: qid + 1 }) + (sel.length ? '' : ' · ' + t('unanswered'))));
      card.appendChild(el('h3', '', q.q));
      s.ansOrder[i].forEach(function (ai, pos) {
        var isSel = sel.indexOf(ai) !== -1, isCorrect = q.c.indexOf(ai) !== -1;
        var cls = 'answer' + (q.c.length > 1 ? ' multi' : '');
        if (isCorrect) cls += isSel ? ' correct' : ' correct missed';
        else if (isSel) cls += ' wrong';
        var row = el('div', cls);
        row.appendChild(el('span', 'mark', LETTERS[pos]));
        row.appendChild(el('span', '', q.a[ai]));
        card.appendChild(row);
      });
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
    renderStart();
    if (!$('result').classList.contains('hidden') && lastFinished) renderResult();
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
  $('gridBtn').addEventListener('click', function () {
    $('grid').classList.toggle('hidden');
    if (!$('grid').classList.contains('hidden')) renderGrid();
  });
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
      var btn = $('answers').children[pos];
      if (pos >= 0 && btn) btn.click();
    }
  });

  renderStart();
})();
