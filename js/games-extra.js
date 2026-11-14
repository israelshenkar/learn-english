// Extra mini-games: ABC / days / months order, and the short-sentences games.
// Same contract as games.js: each game is `(root, unit, api)` and calls api.finish(result).
// games.js imports this module and this module imports helpers back from games.js; that cycle is
// safe because the helpers are only used when a game runs, never while the modules load.
import { LETTERS } from './data.js';
import { h, en, shuffle, sample, sfx } from './ui.js';
import { speak, speakLetter } from './speech.js';
import { scorer, hud, mcq, speakerBtn, starsFor, choose, rec } from './games.js';

const finishWith = (api, s, total, extra = {}) => api.finish({
  correct: s.correct, wrong: s.wrong, total, points: s.points, best: s.best,
  stars: starsFor((total - s.wrong) / total), ...extra });

const sentenceText = item => `${item.en}.`;

// ---------------------------------------------------------------------------
// ORDER: "what comes after M?", "which one is missing?", and tap items into order.
// Works on the alphabet (letters unit) and on ordered word units (days, months).
const ORDER_WORDS = {
  letters: { which: 'איזו אות', comes: 'באה', plural: 'האותיות', abc: 'לפי סדר ה-ABC' },
  days:    { which: 'איזה יום', comes: 'בא',  plural: 'הימים',   abc: 'לפי הסדר בשבוע' },
  months:  { which: 'איזה חודש', comes: 'בא', plural: 'החודשים', abc: 'לפי הסדר בשנה' },
};

function sequenceOf(unit) {
  if (unit.kind === 'letters') return LETTERS.map(L => ({ key: L.u, label: L.u, say: () => speakLetter(L.u), letter: true }));
  return unit.items.map(w => ({ key: w.en, label: w.en, he: w.he, say: () => speak(w.en), letter: false }));
}

const nearby = (seq, idx, exclude, n) => {
  // distractors close to the answer in the sequence, so the child has to really know the order
  const pool = seq.map((x, k) => ({ x, d: Math.abs(k - idx) })).filter(o => !exclude.includes(o.x));
  return shuffle(pool).sort((a, b) => a.d - b.d).slice(0, n + 2).sort(() => Math.random() - 0.5).slice(0, n).map(o => o.x);
};

function order(root, unit, api) {
  const seq = sequenceOf(unit);
  const words = ORDER_WORDS[unit.id] || ORDER_WORDS.letters;
  const isLetters = seq[0].letter;
  const kinds = ['after', 'missing', 'before', 'sort', 'after', 'missing', 'before', 'sort'];
  const total = kinds.length;
  const s = scorer();
  const bar = hud(total);
  const stage = h('div', { class: 'stage' });
  root.append(bar.el, stage);
  let i = 0;

  const cell = (item, cls = '') => h('span', { class: `seq-cell ${isLetters ? 'is-letter' : 'is-word'} ${cls}` },
    item ? en(item.label, isLetters ? 'glyph' : 'word') : '?');
  const seqRow = (...cells) => h('div', { class: 'seq-row', dir: 'ltr' }, cells);
  const arrow = () => h('span', { class: 'seq-arrow', 'aria-hidden': 'true' }, '→');
  const sayAll = items => speak(items.map(x => x.label).join(', '), { rate: 0.75 });

  function done(correct, firstTry) {
    if (correct && firstTry) s.hit();
    else if (correct) { s.correct++; s.points += 5; }
    bar.set(i + 1, s);
  }

  // Multiple choice task: prompt row + 4 big option buttons.
  function choice(promptNodes, answer, options, afterReveal) {
    let locked = false;
    const btns = options.map(o => {
      const b = h('button', { class: `option ${isLetters ? 'letters' : ''}`, type: 'button' },
        en(o.label, isLetters ? 'glyph' : 'word'));
      b.addEventListener('click', () => {
        if (locked) return;
        locked = true;
        const ok = o === answer;
        if (ok) { sfx.good(); b.classList.add('right'); done(true, true); }
        else { s.miss(); sfx.bad(); b.classList.add('wrong'); btns[options.indexOf(answer)].classList.add('right'); bar.set(i + 1, s); }
        api.later(afterReveal, 250);
        api.later(next, ok ? 1300 : 2200);
      });
      return b;
    });
    stage.replaceChildren(h('div', { class: 'prompt card-pop' }, promptNodes),
      h('div', { class: `options ${isLetters ? 'letters' : ''}` }, btns));
  }

  function after(before) {
    const k = before ? 1 + Math.floor(Math.random() * (seq.length - 1)) : Math.floor(Math.random() * (seq.length - 1));
    const shown = seq[k], answer = seq[before ? k - 1 : k + 1];
    const options = shuffle([answer, ...nearby(seq, seq.indexOf(answer), [answer, shown], 3)]);
    choice([
      h('p', { class: 'ask' }, `${words.which} ${words.comes} ${before ? 'לפני' : 'אחרי'} `, en(shown.label, isLetters ? 'glyph inline' : ''), '?'),
      before ? seqRow(cell(null, 'blank'), arrow(), cell(shown)) : seqRow(cell(shown), arrow(), cell(null, 'blank')),
      speakerBtn(shown.say),
    ], answer, options, () => sayAll(before ? [answer, shown] : [shown, answer]));
    shown.say();
  }

  function missing() {
    const len = Math.min(isLetters ? 5 : 4, seq.length);
    const start = Math.floor(Math.random() * (seq.length - len + 1));
    const win = seq.slice(start, start + len);
    const gap = 1 + Math.floor(Math.random() * (len - 2)); // never the first or last – those have two answers
    const answer = win[gap];
    const options = shuffle([answer, ...nearby(seq, start + gap, [answer, ...win.filter(x => x !== answer)], 3)]);
    choice([
      h('p', { class: 'ask' }, `${words.which} חסר${words.which.startsWith('איזו') ? 'ה' : ''} בשורה?`),
      seqRow(win.map(x => cell(x === answer ? null : x, x === answer ? 'blank' : ''))),
    ], answer, options, () => sayAll(win));
  }

  function sort() {
    const n = 4;
    let picked;
    if (isLetters && i < 4) { // first sort task: letters from a short stretch of the alphabet
      const start = Math.floor(Math.random() * (seq.length - 8));
      picked = sample(seq.slice(start, start + 8), n);
    } else picked = sample(seq, n);
    const sorted = [...picked].sort((a, b) => seq.indexOf(a) - seq.indexOf(b));
    let tiles = shuffle(picked);
    while (tiles.every((x, k) => x === sorted[k])) tiles = shuffle(picked);

    let tries = 0, locked = false;
    const slotRow = h('div', { class: 'slots sort-slots', dir: 'ltr' });
    const tileRow = h('div', { class: 'tiles', dir: 'ltr' });
    const kind = isLetters ? '' : 'wide';
    const slots = sorted.map(() => {
      const sl = h('button', { class: `slot ${kind}`, type: 'button', lang: 'en', 'aria-label': 'משבצת ריקה' });
      sl.addEventListener('click', () => unfill(sl));
      slotRow.append(sl);
      return sl;
    });
    const tileEls = tiles.map((x, k) => {
      const t = h('button', { class: `ltile ${kind}`, type: 'button', lang: 'en' }, x.label);
      t.dataset.k = k;
      t.addEventListener('click', () => fill(t));
      tileRow.append(t);
      return t;
    });
    stage.replaceChildren(
      h('div', { class: 'prompt card-pop' },
        h('p', { class: 'ask' }, `סדרו את ${words.plural} ${words.abc}`),
        h('p', { class: 'hint small' }, 'לחצו על מה שבא ראשון, אחר כך על מה שבא אחריו… לחיצה על משבצת מחזירה.')),
      slotRow, tileRow);

    function fill(t) {
      if (locked || t.disabled) return;
      const sl = slots.find(x => !x.dataset.tile);
      if (!sl) return;
      sfx.flip();
      sl.textContent = t.textContent; sl.dataset.tile = t.dataset.k; sl.classList.add('filled');
      sl.setAttribute('aria-label', t.textContent);
      t.disabled = true;
      if (slots.every(x => x.dataset.tile)) check();
    }
    function unfill(sl) {
      if (locked || !sl.dataset.tile) return;
      tileEls[+sl.dataset.tile].disabled = false;
      sl.textContent = ''; delete sl.dataset.tile; sl.classList.remove('filled'); sl.setAttribute('aria-label', 'משבצת ריקה');
    }
    function check() {
      locked = true;
      const guess = slots.map(x => tiles[+x.dataset.tile]);
      if (guess.every((x, k) => x === sorted[k])) {
        sfx.good(); slots.forEach(x => x.classList.add('right'));
        done(true, tries === 0);
        sayAll(sorted);
        api.later(next, 1500);
        return;
      }
      tries++;
      if (tries === 1) s.miss();
      sfx.bad();
      slots.forEach((x, k) => x.classList.add(guess[k] === sorted[k] ? 'right' : 'wrong'));
      api.later(() => {
        if (tries >= 2) { // show the right order and move on
          slots.forEach((x, k) => { x.textContent = sorted[k].label; x.className = `slot ${kind} filled reveal`; });
          sayAll(sorted);
          bar.set(i + 1, s);
          api.later(next, 2000);
        } else {
          locked = false;
          slots.forEach(x => { x.classList.remove('right', 'wrong'); unfill(x); });
        }
      }, 900);
    }
  }

  function show() {
    const k = kinds[i];
    if (k === 'after') after(false);
    else if (k === 'before') after(true);
    else if (k === 'missing') missing();
    else sort();
  }
  function next() {
    i++;
    if (i < total) show(); else finishWith(api, s, total);
  }
  bar.set(0, s);
  show();
}

// ---------------------------------------------------------------------------
// SENTENCES

// Learn card: the picture, the sentence with tappable words, the Hebrew meaning.
export function sentenceCard(item) {
  const ws = item.en.split(' ');
  return h('div', { class: 'word-card sentence-card card-pop' },
    h('span', { class: 'emoji huge' }, item.emoji),
    h('div', { class: 'sentence-words', dir: 'ltr', lang: 'en' }, ws.map((w, k) =>
      h('button', { class: 'word-chip', type: 'button', 'aria-label': w, onclick: () => speak(w, { rate: 0.7 }) },
        k === ws.length - 1 ? `${w}.` : w))),
    h('div', { class: 'he' }, item.he),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn', type: 'button', onclick: () => speak(item.en, { rate: 0.55 }) }, '🐢 לאט'),
      h('button', { class: 'btn', type: 'button', onclick: () => speak(item.en, { rate: 0.85 }) }, '🔊 רגיל')),
    h('p', { class: 'hint small' }, 'לחצו על מילה כדי לשמוע אותה לבד.'));
}

const wordsOf = item => item.en.toLowerCase().split(' ');
const overlap = (a, b) => { const B = new Set(wordsOf(b)); return wordsOf(a).filter(w => B.has(w)).length; };

// Distractor pictures: mostly sentences that share words with the target (This is my mom / dad),
// so the child has to read the key word. Pictures are unique by emoji string.
function sentenceOptions(items, target) {
  const others = shuffle(items.filter(x => x !== target && x.emoji !== target.emoji))
    .sort((a, b) => overlap(b, target) - overlap(a, target));
  const close = others.slice(0, 2);
  const rest = sample(others.slice(2), 1);
  return shuffle([target, ...close, ...rest]);
}

// Read a sentence (no audio until answered), pick the matching picture.
function sentpic(root, unit, api) {
  const qs = choose(api, unit.items, Math.min(8, unit.items.length), 'recog').map(item => ({
    layout: 'pictures', key: item.en, skill: 'recog',
    prompt: () => [h('p', { class: 'ask' }, 'קראו את המשפט ובחרו את התמונה'),
                   en(sentenceText(item), 'sentence-text')],
    reveal: () => speak(item.en),
    options: sentenceOptions(unit.items, item).map(x => ({
      label: h('span', { class: 'emoji', role: 'img', 'aria-label': x.he }, x.emoji), correct: x === item })),
  }));
  mcq(root, api, qs);
}

// Build the sentence from word tiles, in LTR order.
function build(root, unit, api) {
  const list = choose(api, unit.items, Math.min(6, unit.items.length), 'recog');
  const s = scorer();
  const bar = hud(list.length);
  const stage = h('div', { class: 'stage' });
  root.append(bar.el, stage);
  let i = 0;

  function show() {
    const item = list[i];
    const target = item.en.split(' ');
    let order = shuffle(target.map((w, k) => ({ w, k })));
    while (order.every((o, k) => o.w === target[k])) order = shuffle(order);
    let tries = 0, locked = false;

    const slotRow = h('div', { class: 'build-slots', dir: 'ltr', lang: 'en' });
    const tileRow = h('div', { class: 'build-tiles', dir: 'ltr', lang: 'en' });
    const slots = target.map(() => {
      const sl = h('button', { class: 'wslot', type: 'button', 'aria-label': 'מקום ריק' });
      sl.addEventListener('click', () => unfill(sl));
      slotRow.append(sl);
      return sl;
    });
    slotRow.append(h('span', { class: 'build-dot', 'aria-hidden': 'true' }, '.'));
    const tiles = order.map((o, k) => {
      const t = h('button', { class: 'wtile', type: 'button' }, o.w);
      t.dataset.k = k;
      t.addEventListener('click', () => fill(t));
      tileRow.append(t);
      return t;
    });
    stage.replaceChildren(
      h('div', { class: 'prompt card-pop' },
        h('span', { class: 'emoji huge' }, item.emoji),
        h('p', { class: 'ask' }, `בנו את המשפט: "${item.he}"`),
        speakerBtn(() => speak(item.en, { rate: 0.7 }))),
      slotRow, tileRow,
      h('p', { class: 'hint small' }, 'לחצו על המילים לפי הסדר (משמאל לימין). לחיצה על מילה במשפט מחזירה אותה.'));
    speak(item.en, { rate: 0.7 });

    function fill(t) {
      if (locked || t.disabled) return;
      const sl = slots.find(x => !x.dataset.tile);
      if (!sl) return;
      sfx.flip();
      sl.textContent = t.textContent; sl.dataset.tile = t.dataset.k; sl.classList.add('filled');
      sl.setAttribute('aria-label', t.textContent);
      t.disabled = true;
      if (slots.every(x => x.dataset.tile)) check();
    }
    function unfill(sl) {
      if (locked || !sl.dataset.tile) return;
      tiles[+sl.dataset.tile].disabled = false;
      sl.textContent = ''; delete sl.dataset.tile; sl.classList.remove('filled'); sl.setAttribute('aria-label', 'מקום ריק');
    }
    function check() {
      locked = true;
      const guess = slots.map(x => x.textContent);
      if (tries === 0) rec(api, item.en, guess.join(' ') === item.en, 'recog'); // first attempt only
      if (guess.join(' ') === item.en) {
        if (tries === 0) s.hit(); else { s.correct++; s.points += 5; }
        sfx.good(); speak(item.en);
        slots.forEach(x => x.classList.add('right'));
        bar.set(i + 1, s);
        api.later(next, 1500);
        return;
      }
      tries++;
      if (tries === 1) s.miss();
      sfx.bad();
      slots.forEach((x, k) => x.classList.add(guess[k] === target[k] ? 'right' : 'wrong'));
      api.later(() => {
        if (tries >= 2) {
          slots.forEach((x, k) => { x.textContent = target[k]; x.className = 'wslot filled reveal'; });
          speak(item.en);
          bar.set(i + 1, s);
          api.later(next, 2200);
        } else {
          locked = false;
          slots.forEach(x => { x.classList.remove('right', 'wrong'); unfill(x); });
        }
      }, 900);
    }
  }
  function next() {
    i++;
    if (i < list.length) show(); else finishWith(api, s, list.length);
  }
  bar.set(0, s);
  show();
}

export const EXTRA_GAME_FNS = { order, sentpic, build };
