// Every letter in play, every day:
//   • "Letters of the day" – a daily task on the home screen. Two letters a day; the pair moves on once it's
//     done, so all 26 come round every 13 practice days. The letters the stages' words hardly use come first.
//   • The letters warm-up – a bonus game in every word stage, on the letters that stage's words don't use,
//     rotating day by day, so every stage meets the whole ABC over time.
// Both record their answers under the letters unit, so they feed the ABC mastery grid and the daily review.
//
// progress.abc = { i: pair index 0..12, done: 'YYYY-MM-DD' the pair was finished, rounds: pairs finished so far }
import { LETTERS } from './data.js';
import { h, en, shuffle, sample } from './ui.js';
import { speak, speakLetter } from './speech.js';
import { mcq, speakerBtn } from './games.js';
import { dateStr } from './mastery.js';

const byU = Object.fromEntries(LETTERS.map(L => [L.u, L]));
const LETTERS_UNIT = 'letters';

// 13 pairs = the whole alphabet. Each pair puts a letter the stages' words rarely use (Q, Z, J, X…) with a common one.
export const ABC_PAIRS = ['QA', 'ZE', 'JS', 'XT', 'VR', 'WN', 'KO', 'YI', 'PL', 'BD', 'FH', 'GC', 'MU']
  .map(s => [...s].map(c => byU[c]));

// Pseudo unit for the play screen (like the daily review): no stars, no unlocking.
export const ABC_UNIT = { id: 'abc', title: 'אותיות היום', icon: '✨', color: '#ff9f43', games: ['abc'], review: true };
export const ABC_GAME = { title: 'אותיות היום', icon: '✨' };

// Today's pair. A pair stays until it's done; the day after, the next pair comes up.
export function abcToday(p, today = dateStr()) {
  const s = p.abc || {};
  let i = Number.isInteger(s.i) ? s.i : 0;
  if (s.done && s.done < today) i = (i + 1) % ABC_PAIRS.length;
  return { i, letters: ABC_PAIRS[i], doneToday: s.done === today, rounds: s.rounds || 0 };
}

// Call inside store.update when today's round ends. Replaying the same day changes nothing.
export function markAbcDone(p, today = dateStr()) {
  const t = abcToday(p, today);
  if (t.doneToday) return;
  p.abc = { i: t.i, done: today, rounds: t.rounds + 1 };
}

// Home-screen card for the daily task. Stays as a replay link once today's pair is done.
export function abcCard(p) {
  const { i, letters, doneToday } = abcToday(p);
  const finished = i + (doneToday ? 1 : 0); // pairs finished in this round of the alphabet
  return h('a', { class: `review-card abc-card ${doneToday ? 'done' : ''}`, href: '#/abc' },
    h('span', { class: 'abc-pair', 'aria-hidden': 'true' }, letters.map(L => en(`${L.u}${L.l}`, 'glyph'))),
    h('span', { class: 'review-text' },
      h('b', {}, 'אותיות היום: ', en(letters.map(L => L.u).join(' · '))),
      h('small', {}, doneToday ? 'סיימתם להיום! מחר מחכה זוג חדש 🌙' : 'סבב קצר: שומעים, מזהים ומוצאים מילה'),
      h('span', { class: 'abc-dots', role: 'img', 'aria-label': `${finished} מתוך ${ABC_PAIRS.length} זוגות של ה-ABC` },
        ABC_PAIRS.map((_, k) => h('i', { class: k < finished ? 'on' : k === i ? 'now' : '' })))),
    doneToday ? null : h('span', { class: 'btn primary small-btn', 'aria-hidden': 'true' }, 'מתחילים'));
}

// --- Questions (all record `recog` under the letters unit) ----------------------------------------------
const base = L => ({ key: L.u, skill: 'recog', unitId: LETTERS_UNIT });
const glyphs = (list, show) => list.map(x => ({ x, label: en(show(x), 'glyph') }));

function hearQ(L, api, upper = Math.random() < 0.5) {
  const show = x => upper ? x.u : x.l;
  return { ...base(L), layout: 'letters',
    prompt: () => [h('p', { class: 'ask' }, `הקשיבו ובחרו את האות ${upper ? 'הגדולה' : 'הקטנה'}`),
                   speakerBtn(() => speakLetter(L.u))],
    onShow: () => speakLetter(L.u),
    reveal: () => api.later(() => speak(`${L.u}, ${L.word}`), 250),
    options: shuffle(glyphs([L, ...sample(LETTERS.filter(x => x !== L), 3)], show))
      .map(o => ({ label: o.label, correct: o.x === L })) };
}

function matchQ(L, api) {
  return { ...base(L), layout: 'letters',
    prompt: () => [en(L.u, 'glyph huge-glyph'), h('p', { class: 'ask' }, 'מה האות הקטנה של האות הזאת?')],
    reveal: () => api.later(() => speakLetter(L.u), 250),
    options: shuffle(glyphs([L, ...sample(LETTERS.filter(x => x !== L), 3)], x => x.l))
      .map(o => ({ label: o.label, correct: o.x === L })) };
}

// "Which word has the letter …?" – not "starts with", since X's word is fox. Wrong options never contain it.
function wordQ(L, api) {
  const others = sample(LETTERS.filter(x => x !== L && !x.word.includes(L.l)), 3);
  return { ...base(L), layout: 'pictures',
    prompt: () => [h('p', { class: 'ask' }, 'באיזו מילה יש את האות ', en(`${L.u} ${L.l}`, 'glyph inline'), '?'),
                   speakerBtn(() => speakLetter(L.u))],
    reveal: () => api.later(() => speak(L.word), 250),
    options: shuffle([L, ...others]).map(x => ({
      label: [h('span', { class: 'emoji' }, x.emoji), en(x.word, 'word small-word')], correct: x === L })) };
}

// Tap-to-hear cards for the round's letters, above the questions.
function introStrip(letters) {
  return h('div', { class: 'abc-intro' }, letters.map(L =>
    h('button', { class: 'abc-chip', type: 'button', 'aria-label': `האות ${L.u}`,
      onclick: () => { speakLetter(L.u); setTimeout(() => speak(L.word), 900); } },
      en(`${L.u}${L.l}`, 'glyph'),
      h('span', { class: 'abc-chip-text' }, h('b', {}, L.name), h('small', {}, `${L.emoji} `, en(L.word))))));
}

// Daily task round: 4 questions per letter (hear big, hear small, big→small, find the word).
export function runAbc(root, api, progress) {
  const { letters } = abcToday(progress);
  root.append(h('p', { class: 'hint' }, 'אותיות היום – לחצו על כרטיס כדי לשמוע, ואז ענו על השאלות.'),
    introStrip(letters));
  mcq(root, api, shuffle(letters.flatMap(L => [hearQ(L, api, true), hearQ(L, api, false), matchQ(L, api), wordQ(L, api)])));
}

// --- Warm-up inside a word stage -------------------------------------------------------------------------
const lettersInWords = unit => new Set((unit.items || []).map(i => i.en || '').join('').toUpperCase().replace(/[^A-Z]/g, ''));

// The stage's missing letters, n at a time, moving on every day (all of them come up within ceil(len / n) days).
export function warmupLetters(unit, today = dateStr(), n = 3) {
  const used = lettersInWords(unit);
  const missing = LETTERS.filter(L => !used.has(L.u));
  const pool = missing.length >= n ? missing : LETTERS; // a stage that uses (almost) every letter rotates the whole ABC
  const day = Math.floor(Date.parse(today) / 864e5);
  const start = (day * n) % pool.length;
  return Array.from({ length: Math.min(n, pool.length) }, (_, k) => pool[(start + k) % pool.length]);
}

export function runWarmup(root, unit, api) {
  const letters = warmupLetters(unit);
  root.append(h('p', { class: 'hint' }, 'חימום: אותיות שלא מופיעות במילים של השלב הזה.'), introStrip(letters));
  mcq(root, api, shuffle(letters.flatMap(L => [hearQ(L, api), wordQ(L, api)])));
}
