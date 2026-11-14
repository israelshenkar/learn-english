// All mini-games. Each game is `(root, unit, api)`; it calls api.finish(result) when the round ends.
// result = { correct, wrong, total, points, best, stars, traced?, said?, learn? }
import { LETTERS, CVC, LOOKALIKES } from './data.js';
import { h, en, shuffle, sample, sfx } from './ui.js';
import { speak, speakLetter, canListen, listenOnce } from './speech.js';
import { playLetterSound, blendWord, stopSounds } from './phonics.js';
import { EXTRA_GAME_FNS, sentenceCard } from './games-extra.js';

export const itemKey = (unit, item) => unit.kind === 'letters' ? item.u : item.en;
const itemsOf = unit => unit.kind === 'letters' ? LETTERS : unit.items;

// Adaptive item choice + per-item results (see mastery.js); fall back to random when the api lacks them.
export const choose = (api, pool, n, skill) => api.pickItems ? api.pickItems(pool, n, skill) : sample(pool, n);
export const rec = (api, key, correct, skill, unitId) => api.recordItem?.(key, correct, skill, unitId);

export const starsFor = ratio => ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : ratio >= 0.4 ? 1 : 0;

export function scorer() {
  return {
    correct: 0, wrong: 0, streak: 0, best: 0, points: 0,
    hit() {
      this.correct++; this.streak++; this.best = Math.max(this.best, this.streak);
      const p = 10 + (this.streak >= 3 ? 5 : 0);
      this.points += p; return p;
    },
    miss() { this.wrong++; this.streak = 0; },
  };
}

// Progress bar + live score shown at the top of every round.
export function hud(total) {
  const fill = h('div', { class: 'hud-fill' });
  const pts = h('span', { class: 'hud-points' }, '0');
  const streak = h('span', { class: 'hud-streak' });
  const el = h('div', { class: 'hud' },
    h('div', { class: 'hud-track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total }, fill),
    streak, h('span', { class: 'hud-score' }, '⭐ ', pts));
  return {
    el,
    set(done, s) {
      fill.style.width = `${(done / total) * 100}%`;
      el.querySelector('.hud-track').setAttribute('aria-valuenow', done);
      pts.textContent = s.points;
      streak.textContent = s.streak >= 3 ? `🔥 ${s.streak}` : '';
      if (s.streak >= 3) { streak.classList.remove('pop'); void streak.offsetWidth; streak.classList.add('pop'); }
    },
  };
}

export const speakerBtn = (onclick, label = 'השמיעו שוב') =>
  h('button', { class: 'speaker', type: 'button', 'aria-label': label, onclick }, '🔊');

// ---------------------------------------------------------------------------
// Generic multiple-choice runner
// question = { prompt: () => Node, options: [{ label: Node, correct: bool }], onShow?, reveal? , layout?,
//              key?, skill?, unitId? }  – key/skill record the answer for that item
export function mcq(root, api, questions) {
  const s = scorer();
  const bar = hud(questions.length);
  const stage = h('div', { class: 'stage' });
  root.append(bar.el, stage);
  let i = 0;

  function show() {
    const q = questions[i];
    let locked = false;
    const opts = q.options.map(o => {
      const b = h('button', { class: `option ${q.layout || ''}`, type: 'button' }, o.label);
      b.addEventListener('click', () => {
        if (locked) return;
        locked = true;
        const correctBtn = opts.find((_, k) => q.options[k].correct);
        if (q.key != null) rec(api, q.key, o.correct, q.skill || 'recog', q.unitId);
        if (o.correct) {
          s.hit(); sfx.good(); b.classList.add('right');
        } else {
          s.miss(); sfx.bad(); b.classList.add('wrong'); correctBtn.classList.add('right');
        }
        q.reveal?.();
        bar.set(i + 1, s);
        api.later(next, o.correct ? 1000 : 1900);
      });
      return b;
    });
    stage.replaceChildren(
      h('div', { class: 'prompt card-pop' }, q.prompt()),
      h('div', { class: `options ${q.layout || ''}` }, opts));
    q.onShow?.();
  }
  function next() {
    i++;
    if (i < questions.length) show();
    else api.finish({ correct: s.correct, wrong: s.wrong, total: questions.length, points: s.points,
                      best: s.best, stars: starsFor(s.correct / questions.length) });
  }
  bar.set(0, s);
  show();
}

export function distractors(pool, target, n, keyFn) {
  return sample(pool.filter(x => keyFn(x) !== keyFn(target)), n);
}

// ---------------------------------------------------------------------------
// LEARN: browse all items, tap to hear. Completing = seeing every item.
function learn(root, unit, api) {
  const items = itemsOf(unit);
  const seen = new Set(api.seen());
  api.onCleanup(stopSounds);
  const detail = h('div', { class: 'detail' });
  const counter = h('div', { class: 'learn-count' });
  const grid = h('div', { class: `learn-grid ${unit.kind}` });
  const doneBtn = h('button', { class: 'btn primary', type: 'button', hidden: true,
    onclick: () => api.finish({ learn: true, correct: items.length, wrong: 0, total: items.length,
                                points: 0, best: 0, stars: 3 }) }, 'סיימתי! קבלו 3 כוכבים');
  root.append(h('p', { class: 'hint' }, unit.kind === 'letters'
    ? 'לחצו על כל אות כדי לשמוע את השם שלה ולהכיר מילה שמתחילה בה.'
    : 'לחצו על כל כרטיס כדי לשמוע איך אומרים את המילה.'), detail, counter, grid, doneBtn);

  const tiles = items.map(item => {
    const key = itemKey(unit, item);
    const t = h('button', { class: 'tile', type: 'button' },
      unit.kind === 'letters'
        ? en(`${item.u}${item.l}`, 'glyph')
        : [h('span', { class: 'emoji' }, item.emoji), en(item.en, 'tile-word')]);
    t.addEventListener('click', () => open(item, t));
    if (seen.has(key)) t.classList.add('seen');
    return t;
  });
  grid.append(...tiles);

  function refresh() {
    counter.textContent = `הכרתם ${seen.size} מתוך ${items.length}`;
    doneBtn.hidden = !(seen.size === items.length && !api.alreadyCompleted());
  }

  function open(item, tile) {
    const key = itemKey(unit, item);
    tiles.forEach(t => t.classList.remove('active'));
    tile.classList.add('active', 'seen');
    if (!seen.has(key)) { seen.add(key); api.markSeen(key); }
    refresh();
    if (unit.kind === 'letters') {
      speakLetter(item.u);
      detail.replaceChildren(h('div', { class: 'letter-card card-pop' },
        h('div', { class: 'copy-lines big' }, en(`${item.u}${item.l}`, 'glyph')),
        h('div', { class: 'facts' },
          h('div', { class: 'fact' }, h('b', {}, 'שם האות: '), item.name,
            speakerBtn(() => speakLetter(item.u), 'השמיעו את שם האות')),
          h('div', { class: 'fact' }, h('b', {}, 'הצליל: '), item.sound,
            h('button', { class: 'btn sound-btn', type: 'button', 'aria-label': 'השמיעו את הצליל של האות',
              onclick: () => playLetterSound(item.l, item.word) }, '🔉 הצליל')),
          h('div', { class: 'fact example' }, h('span', { class: 'emoji' }, item.emoji), ' ',
            en(item.word, 'word'), ` – ${item.he}`,
            speakerBtn(() => speak(item.word), 'השמיעו את המילה')))));
    } else if (unit.kind === 'reading') {
      speak(item.en, { rate: 0.7 });
      detail.replaceChildren(h('div', { class: 'word-card card-pop' },
        h('span', { class: 'emoji huge' }, item.emoji),
        h('div', { class: 'spelled', dir: 'ltr' }, [...item.en].map(c =>
          h('button', { class: 'letter-chip', type: 'button', lang: 'en', 'aria-label': `הצליל של ${c}`,
            onclick: () => playLetterSound(c).then(ok => ok || speakLetter(c)) }, c))),
        h('div', { class: 'he' }, item.he),
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: e => {
            const chips = [...e.currentTarget.closest('.word-card').querySelectorAll('.letter-chip')];
            blendWord(item.en, i => chips.forEach((c, k) => c.classList.toggle('blending', k === i)));
          } }, '🧩 צליל אחרי צליל'),
          h('button', { class: 'btn', type: 'button', onclick: () => speak(item.en, { rate: 0.55 }) }, '🐢 לאט'),
          h('button', { class: 'btn', type: 'button', onclick: () => speak(item.en) }, '🔊 רגיל'))));
    } else if (unit.kind === 'sentences') {
      speak(item.en, { rate: 0.75 });
      detail.replaceChildren(sentenceCard(item));
    } else {
      speak(item.en);
      detail.replaceChildren(h('div', { class: 'word-card card-pop' },
        h('span', { class: 'emoji huge' }, item.emoji),
        en(item.en, 'word big'), h('div', { class: 'he' }, item.he),
        speakerBtn(() => speak(item.en))));
    }
    detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  open(items.find(it => !seen.has(itemKey(unit, it))) || items[0],
       tiles[Math.max(0, items.findIndex(it => !seen.has(itemKey(unit, it))))]);
}

// ---------------------------------------------------------------------------
// LETTERS: listen to a letter name, pick it.
function listenLetters(root, unit, api) {
  const qs = choose(api, LETTERS, 10, 'recog').map(L => {
    const upper = Math.random() < 0.5;
    const show = x => upper ? x.u : x.l;
    const options = shuffle([L, ...distractors(LETTERS, L, 3, x => x.u)])
      .map(x => ({ label: en(show(x), 'glyph'), correct: x === L }));
    return {
      key: L.u, skill: 'recog',
      layout: 'letters',
      prompt: () => [h('p', { class: 'ask' }, `הקשיבו ובחרו את האות ${upper ? 'הגדולה' : 'הקטנה'}`),
                     speakerBtn(() => speakLetter(L.u))],
      onShow: () => speakLetter(L.u),
      reveal: () => api.later(() => speak(`${L.u}, ${L.word}`), 250),
      options,
    };
  });
  mcq(root, api, qs);
}

// WORDS: hear the English word, pick the picture.
function listenWords(root, unit, api) {
  const qs = choose(api, unit.items, Math.min(8, unit.items.length), 'recog').map(w => ({
    key: w.en, skill: 'recog',
    layout: 'pictures',
    prompt: () => [h('p', { class: 'ask' }, 'הקשיבו – מה שמעתם?'), speakerBtn(() => speak(w.en))],
    onShow: () => speak(w.en),
    reveal: () => {},
    options: shuffle([w, ...distractors(unit.items, w, 3, x => x.en)])
      .map(x => ({ label: [h('span', { class: 'emoji' }, x.emoji), h('span', { class: 'he small' }, x.he)], correct: x === w })),
  }));
  mcq(root, api, qs);
}

// WORDS: see the picture + Hebrew, pick the English word.
function pick(root, unit, api) {
  const qs = choose(api, unit.items, Math.min(8, unit.items.length), 'recog').map(w => ({
    key: w.en, skill: 'recog',
    prompt: () => [h('span', { class: 'emoji huge' }, w.emoji),
                   h('p', { class: 'ask' }, `איך אומרים באנגלית "${w.he}"?`)],
    reveal: () => speak(w.en),
    options: shuffle([w, ...distractors(unit.items, w, 3, x => x.en)])
      .map(x => ({ label: en(x.en, 'word'), correct: x === w })),
  }));
  mcq(root, api, qs);
}

// READING: read a written word, pick the picture (no audio until answered – real reading!).
function read(root, unit, api) {
  const qs = choose(api, CVC, 8, 'recog').map(w => ({
    key: w.en, skill: 'recog',
    layout: 'pictures',
    prompt: () => [h('p', { class: 'ask' }, 'קראו את המילה ובחרו את התמונה'), en(w.en, 'word reading')],
    reveal: () => speak(w.en),
    options: shuffle([w, ...distractors(CVC, w, 3, x => x.en)])
      .map(x => ({ label: h('span', { class: 'emoji' }, x.emoji), correct: x === w })),
  }));
  mcq(root, api, qs);
}

const oneLetterOff = (a, b) => a.length === b.length && a !== b && [...a].filter((c, i) => c !== b[i]).length === 1;

// READING: hear a word, choose how it is written among look-alikes (cat / hat / cut / cap).
function sounds(root, unit, api) {
  const pool = [...new Set([...CVC.map(w => w.en), ...LOOKALIKES])];
  const qs = choose(api, CVC, 8, 'recog').map(w => {
    let wrong = sample(pool.filter(x => oneLetterOff(x, w.en)), 3);
    if (wrong.length < 3) wrong = [...wrong, ...sample(pool.filter(x => x !== w.en && !wrong.includes(x)), 3 - wrong.length)];
    return {
      key: w.en, skill: 'recog',
      prompt: () => [h('p', { class: 'ask' }, 'הקשיבו – איזו מילה שמעתם?'), speakerBtn(() => speak(w.en, { rate: 0.7 }))],
      onShow: () => speak(w.en, { rate: 0.7 }),
      reveal: () => {},
      options: shuffle([w.en, ...wrong]).map(x => ({
        label: en(x, 'word'), correct: x === w.en })),
    };
  });
  mcq(root, api, qs);
}

// ---------------------------------------------------------------------------
// LETTERS: memory game matching uppercase with lowercase.
function memory(root, unit, api) {
  const letters = choose(api, LETTERS, 6, 'recog');
  const cards = shuffle(letters.flatMap(L => [{ L, ch: L.u, kind: 'up' }, { L, ch: L.l, kind: 'low' }]));
  let open = [], matched = 0, moves = 0, misses = 0, points = 0, busy = false;
  const info = h('div', { class: 'memory-info' });
  const grid = h('div', { class: 'memory-grid' });
  const setInfo = () => info.replaceChildren(`ניסיונות: ${moves}`, h('span', {}, `זוגות: ${matched} / 6`));
  root.append(h('p', { class: 'hint' }, 'הפכו שני קלפים: מצאו אות גדולה ואת האות הקטנה שלה.'), info, grid);
  setInfo();

  cards.forEach(card => {
    const el = h('button', { class: `mcard ${card.kind}`, type: 'button', 'aria-label': 'קלף סגור' },
      h('span', { class: 'mback' }, '?'), en(card.ch, 'mface glyph'));
    el.addEventListener('click', () => {
      if (busy || el.classList.contains('flipped')) return;
      sfx.flip();
      el.classList.add('flipped');
      el.setAttribute('aria-label', `האות ${card.ch}`);
      open.push({ card, el });
      if (open.length < 2) return;
      moves++;
      const [a, b] = open;
      open = [];
      if (a.card.L === b.card.L && a.card.kind !== b.card.kind) {
        matched++; points += 10;
        sfx.good(); speakLetter(a.card.L.u);
        rec(api, a.card.L.u, true, 'recog');
        a.el.classList.add('matched'); b.el.classList.add('matched');
        setInfo();
        if (matched === 6) {
          const stars = moves <= 10 ? 3 : moves <= 14 ? 2 : 1;
          api.later(() => api.finish({ correct: 6, wrong: misses, total: 6, points: points + stars * 10, best: 0, stars }), 900);
        }
      } else {
        misses++;
        busy = true;
        api.later(() => {
          a.el.classList.remove('flipped'); b.el.classList.remove('flipped');
          a.el.setAttribute('aria-label', 'קלף סגור'); b.el.setAttribute('aria-label', 'קלף סגור');
          busy = false;
        }, 900);
        setInfo();
      }
    });
    grid.append(el);
  });
}

// ---------------------------------------------------------------------------
// LETTERS: trace the letter with a finger / mouse. Scored by how well the ink covers the guide.
async function trace(root, unit, api) {
  try { await document.fonts.load('700 100px Andika'); } catch {}
  const items = choose(api, LETTERS, 6, 'write').map(L => ({ L, ch: Math.random() < 0.5 ? L.u : L.l }));
  const s = scorer();
  const bar = hud(items.length);
  const SIZE = 300, G = 100, BRUSH = 24;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);

  const guide = h('canvas', { class: 'trace-guide', width: SIZE * dpr, height: SIZE * dpr, 'aria-hidden': 'true' });
  const ink = h('canvas', { class: 'trace-ink', width: SIZE * dpr, height: SIZE * dpr,
    'aria-label': 'משטח כתיבה – עקבו באצבע אחרי האות', role: 'img' });
  const small = document.createElement('canvas'); small.width = small.height = G;
  const gctx = guide.getContext('2d'), ictx = ink.getContext('2d'), sctx = small.getContext('2d', { willReadFrequently: true });
  gctx.scale(dpr, dpr); ictx.scale(dpr, dpr);

  const title = h('p', { class: 'ask' });
  const feedback = h('p', { class: 'feedback', 'aria-live': 'polite' });
  const checkBtn = h('button', { class: 'btn primary', type: 'button' }, '✔ בדיקה');
  const clearBtn = h('button', { class: 'btn', type: 'button' }, '🧽 ניקוי');
  const skipBtn = h('button', { class: 'btn ghost', type: 'button', hidden: true }, 'דלגו ←');
  root.append(bar.el, h('div', { class: 'stage' }, title,
    h('div', { class: 'trace-stage' }, guide, ink), feedback, h('div', { class: 'row' }, clearBtn, checkBtn, skipBtn)));

  // Copybook metrics measured from the font so letters sit on the lines.
  gctx.font = '700 100px Andika';
  const capRatio = gctx.measureText('H').actualBoundingBoxAscent / 100 || 0.7;
  const xRatio = gctx.measureText('x').actualBoundingBoxAscent / 100 || 0.5;
  const FONT = 150 / capRatio, BASE = 205;
  const top = BASE - 150, mid = BASE - FONT * xRatio, desc = BASE + 60;

  let i = 0, attempts = 0, firstTryOk = true, mask, drawing = false, last = null, inked = 0;

  function drawGuide(ch) {
    gctx.clearRect(0, 0, SIZE, SIZE);
    gctx.lineWidth = 2;
    const line = (y, color, dash = []) => { gctx.setLineDash(dash); gctx.strokeStyle = color; gctx.beginPath(); gctx.moveTo(8, y); gctx.lineTo(SIZE - 8, y); gctx.stroke(); };
    line(top, '#9cc0e8'); line(mid, '#9cc0e8', [8, 8]); line(BASE, '#e2554b'); line(desc, '#9cc0e8');
    gctx.setLineDash([]);
    gctx.font = `700 ${FONT}px Andika`; gctx.textAlign = 'center'; gctx.textBaseline = 'alphabetic';
    gctx.fillStyle = 'rgba(74,163,223,0.22)'; gctx.fillText(ch, SIZE / 2, BASE);
    gctx.setLineDash([4, 6]); gctx.lineWidth = 2; gctx.strokeStyle = 'rgba(29,42,91,0.45)'; gctx.strokeText(ch, SIZE / 2, BASE);
    gctx.setLineDash([]);
    // low-res mask of the glyph
    sctx.clearRect(0, 0, G, G);
    sctx.font = `700 ${FONT * G / SIZE}px Andika`; sctx.textAlign = 'center'; sctx.textBaseline = 'alphabetic';
    sctx.fillStyle = '#000'; sctx.fillText(ch, G / 2, BASE * G / SIZE);
    mask = alphaMask();
    sctx.clearRect(0, 0, G, G);
  }
  const alphaMask = () => { const d = sctx.getImageData(0, 0, G, G).data; const m = new Uint8Array(G * G); for (let k = 0; k < m.length; k++) m[k] = d[k * 4 + 3] > 100 ? 1 : 0; return m; };
  function dilate(m, r) {
    const out = new Uint8Array(m.length);
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      if (!m[y * G + x]) continue;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < G && xx >= 0 && xx < G) out[yy * G + xx] = 1;
      }
    }
    return out;
  }

  function clearInk() { ictx.clearRect(0, 0, SIZE, SIZE); sctx.clearRect(0, 0, G, G); inked = 0; }
  function show() {
    const it = items[i];
    attempts = 0; firstTryOk = true; skipBtn.hidden = true; checkBtn.disabled = skipBtn.disabled = false; feedback.textContent = ''; feedback.className = 'feedback';
    title.replaceChildren(`כתבו את האות ${it.ch === it.L.u ? 'הגדולה' : 'הקטנה'} `, en(it.ch, 'glyph inline'),
      speakerBtn(() => speakLetter(it.L.u)));
    clearInk(); drawGuide(it.ch);
    speakLetter(it.L.u);
  }

  const pos = e => { const r = ink.getBoundingClientRect(); return { x: (e.clientX - r.left) * SIZE / r.width, y: (e.clientY - r.top) * SIZE / r.height }; };
  function stroke(a, b) {
    for (const [c, scale, w] of [[ictx, 1, BRUSH], [sctx, G / SIZE, BRUSH * G / SIZE]]) {
      c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = w; c.strokeStyle = '#1d2a5b';
      c.beginPath(); c.moveTo(a.x * scale, a.y * scale); c.lineTo(b.x * scale + 0.01, b.y * scale); c.stroke();
    }
    inked++;
  }
  ink.addEventListener('pointerdown', e => { e.preventDefault(); ink.setPointerCapture(e.pointerId); drawing = true; last = pos(e); stroke(last, last); });
  ink.addEventListener('pointermove', e => { if (!drawing) return; const p = pos(e); stroke(last, p); last = p; });
  const stop = () => { drawing = false; };
  ink.addEventListener('pointerup', stop); ink.addEventListener('pointercancel', stop);

  clearBtn.addEventListener('click', clearInk);
  checkBtn.addEventListener('click', () => {
    if (!inked) { feedback.textContent = 'עוד לא כתבתם כלום 🙂'; return; }
    const user = alphaMask();
    const userWide = dilate(user, 2), guideWide = dilate(mask, 4);
    let g = 0, gHit = 0, u = 0, uIn = 0;
    for (let k = 0; k < mask.length; k++) {
      if (mask[k]) { g++; if (userWide[k]) gHit++; }
      if (user[k]) { u++; if (guideWide[k]) uIn++; }
    }
    const coverage = gHit / g, precision = uIn / u;
    attempts++;
    if (coverage >= 0.6 && precision >= 0.72) {
      checkBtn.disabled = skipBtn.disabled = true; // no double scoring while the next letter loads
      if (firstTryOk) { s.hit(); rec(api, items[i].L.u, true, 'write'); } else { s.correct++; s.points += 5; }
      sfx.good(); speakLetter(items[i].L.u);
      feedback.textContent = ['מעולה! ✨', 'יפה מאוד! 👏', 'כל הכבוד! 🌟'][Math.floor(Math.random() * 3)];
      feedback.className = 'feedback good';
      bar.set(i + 1, s);
      api.later(advance, 1100);
    } else {
      if (firstTryOk) { firstTryOk = false; s.miss(); rec(api, items[i].L.u, false, 'write'); }
      sfx.bad();
      feedback.className = 'feedback bad';
      feedback.textContent = coverage < 0.6 ? 'כמעט! נסו לעבור על כל חלקי האות' : 'נסו לכתוב בדיוק על הקווים של האות';
      if (attempts >= 2) skipBtn.hidden = false;
      api.later(clearInk, 700);
    }
  });
  skipBtn.addEventListener('click', () => { checkBtn.disabled = skipBtn.disabled = true; bar.set(i + 1, s); advance(); });

  function advance() {
    i++;
    if (i < items.length) show();
    else {
      // every letter either passed on the first try (hit) or recorded exactly one miss
      api.finish({ correct: s.correct, wrong: s.wrong, total: items.length, points: s.points, best: s.best,
                   stars: starsFor((items.length - s.wrong) / items.length), traced: s.correct });
    }
  }
  bar.set(0, s);
  show();
}

// ---------------------------------------------------------------------------
// SPELL: build the word from letter tiles (tap or type).
function spell(root, unit, api) {
  const pool = (unit.kind === 'reading' ? CVC : unit.items).filter(w => /^[a-z]{2,8}$/.test(w.en));
  const words = choose(api, pool, Math.min(6, pool.length), 'spell');
  const s = scorer();
  const bar = hud(words.length);
  const stage = h('div', { class: 'stage' });
  root.append(bar.el, stage);
  let i = 0, slots = [], tiles = [], tries = 0, locked = false;

  function show() {
    const w = words[i];
    tries = 0; locked = false;
    const extra = sample('abcdefghijklmnoprstuvwy'.split('').filter(c => !w.en.includes(c)), w.en.length > 5 ? 2 : 3);
    const slotRow = h('div', { class: 'slots', dir: 'ltr' });
    const tileRow = h('div', { class: 'tiles', dir: 'ltr' });
    slots = [...w.en].map(() => {
      const sl = h('button', { class: 'slot', type: 'button', lang: 'en', 'aria-label': 'משבצת ריקה' });
      sl.addEventListener('click', () => unfill(sl));
      slotRow.append(sl);
      return sl;
    });
    tiles = shuffle([...w.en, ...extra]).map(c => {
      const t = h('button', { class: 'ltile', type: 'button', lang: 'en' }, c);
      t.addEventListener('click', () => fill(t));
      tileRow.append(t);
      return t;
    });
    stage.replaceChildren(
      h('div', { class: 'prompt card-pop' }, h('span', { class: 'emoji huge' }, w.emoji),
        h('p', { class: 'ask' }, `איך כותבים "${w.he}"?`), speakerBtn(() => speak(w.en, { rate: 0.7 }))),
      slotRow, tileRow,
      h('p', { class: 'hint small' }, 'אפשר גם להקליד במקלדת. לחיצה על משבצת מחזירה את האות.'));
    speak(w.en, { rate: 0.7 });
  }
  function fill(t) {
    if (locked || t.disabled) return;
    const sl = slots.find(x => !x.dataset.tile);
    if (!sl) return;
    sfx.flip();
    sl.textContent = t.textContent; sl.dataset.tile = tiles.indexOf(t); sl.classList.add('filled');
    sl.setAttribute('aria-label', t.textContent);
    t.disabled = true;
    if (slots.every(x => x.dataset.tile)) check();
  }
  function unfill(sl) {
    if (locked || !sl.dataset.tile) return;
    tiles[+sl.dataset.tile].disabled = false;
    sl.textContent = ''; delete sl.dataset.tile; sl.classList.remove('filled'); sl.setAttribute('aria-label', 'משבצת ריקה');
  }
  function check() {
    const w = words[i];
    const guess = slots.map(x => x.textContent).join('');
    locked = true;
    if (guess === w.en) {
      if (tries === 0) { s.hit(); rec(api, w.en, true, 'spell'); } else { s.correct++; s.points += 5; }
      sfx.good(); speak(w.en);
      slots.forEach(x => x.classList.add('right'));
      bar.set(i + 1, s);
      api.later(next, 1200);
    } else {
      tries++;
      if (tries === 1) { s.miss(); rec(api, w.en, false, 'spell'); }
      sfx.bad();
      slots.forEach((x, k) => x.classList.add(x.textContent === w.en[k] ? 'right' : 'wrong'));
      api.later(() => {
        if (tries >= 2) { // show the answer, move on
          slots.forEach((x, k) => { x.textContent = w.en[k]; x.className = 'slot filled reveal'; });
          speak(w.en);
          bar.set(i + 1, s);
          api.later(next, 1800);
        } else {
          locked = false;
          slots.forEach(x => { x.classList.remove('right', 'wrong'); if (x.textContent) unfill(x); });
        }
      }, 900);
    }
  }
  function next() {
    i++;
    if (i < words.length) show();
    else api.finish({ correct: s.correct, wrong: s.wrong, total: words.length, points: s.points, best: s.best,
                      stars: starsFor((words.length - s.wrong) / words.length) });
  }
  const onKey = e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Backspace') { const sl = [...slots].reverse().find(x => x.dataset.tile); if (sl) unfill(sl); return; }
    // Use the physical key so it works even when the keyboard layout is set to Hebrew.
    const k = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
    if (/^[a-z]$/.test(k)) { const t = tiles.find(x => !x.disabled && x.textContent === k); if (t) fill(t); }
  };
  document.addEventListener('keydown', onKey);
  api.onCleanup(() => document.removeEventListener('keydown', onKey));
  bar.set(0, s);
  show();
}

// ---------------------------------------------------------------------------
// SAY (bonus): pronounce the word into the microphone.
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function say(root, unit, api) {
  if (!canListen) {
    root.append(h('div', { class: 'stage' }, h('div', { class: 'prompt' },
      h('span', { class: 'emoji huge' }, '🎤'),
      h('p', { class: 'ask' }, 'הדפדפן הזה לא תומך בזיהוי דיבור.'),
      h('p', { class: 'hint' }, 'נסו בדפדפן Chrome או Edge במחשב או בטלפון אנדרואיד. זה משחק בונוס – הוא לא נדרש כדי להתקדם.'))));
    return;
  }
  const words = choose(api, unit.items, Math.min(6, unit.items.length), 'say');
  const s = scorer();
  const bar = hud(words.length);
  const stage = h('div', { class: 'stage' });
  root.append(bar.el, stage);
  let i = 0, tries = 0;

  function show() {
    const w = words[i];
    tries = 0;
    const fb = h('p', { class: 'feedback', 'aria-live': 'polite' });
    const mic = h('button', { class: 'mic', type: 'button', 'aria-label': 'הקליטו' }, '🎤');
    const skip = h('button', { class: 'btn ghost', type: 'button', hidden: true, onclick: () => { bar.set(i + 1, s); next(); } }, 'דלגו ←');
    mic.addEventListener('click', async () => {
      mic.classList.add('rec'); mic.disabled = true; fb.textContent = 'מקשיבים…'; fb.className = 'feedback';
      try {
        const alts = await listenOnce();
        const targets = [w.en, ...(w.alt || [])].map(t => t.toLowerCase());
        const ok = alts.some(a => targets.some(t => a === t || a.split(/\s+/).includes(t) ||
                                   (t.length >= 4 && (a.includes(t) || lev(a, t) <= 1))));
        if (ok) {
          if (tries === 0) { s.hit(); rec(api, w.en, true, 'say'); } else { s.correct++; s.points += 5; }
          sfx.good(); fb.textContent = 'מצוין! אמרתם את זה נכון 🎉'; fb.className = 'feedback good';
          bar.set(i + 1, s);
          api.later(next, 1300);
        } else {
          if (tries === 0) { s.miss(); rec(api, w.en, false, 'say'); }
          tries++;
          sfx.bad(); fb.className = 'feedback bad';
          fb.replaceChildren('שמענו: ', en(alts[0] || '…'), ' – הקשיבו ונסו שוב');
          if (tries >= 2) skip.hidden = false;
        }
      } catch (err) {
        fb.textContent = err.message; fb.className = 'feedback bad';
      } finally { mic.classList.remove('rec'); mic.disabled = false; }
    });
    stage.replaceChildren(
      h('div', { class: 'prompt card-pop' }, h('span', { class: 'emoji huge' }, w.emoji),
        en(w.en, 'word big'), h('div', { class: 'he' }, w.he),
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => speak(w.en) }, '🔊 הקשיבו'))),
      h('p', { class: 'ask' }, 'לחצו על המיקרופון ואמרו את המילה באנגלית'),
      mic, fb, skip);
  }
  function next() {
    i++;
    if (i < words.length) show();
    else api.finish({ correct: s.correct, wrong: s.wrong, total: words.length, points: s.points, best: s.best,
                      stars: starsFor(s.correct / words.length), said: s.correct });
  }
  bar.set(0, s);
  show();
}

export function runGame(gameId, root, unit, api) {
  const table = {
    learn, memory, trace, read, sounds, pick, spell, say, ...EXTRA_GAME_FNS,
    listen: unit.kind === 'letters' ? listenLetters : listenWords,
  };
  return table[gameId](root, unit, api);
}
