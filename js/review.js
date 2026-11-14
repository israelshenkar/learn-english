// Daily review ("חזרה יומית") + the per-unit mastery grid.
// The review is a mixed multiple-choice round over items whose spaced-repetition date has come.
import { LETTERS, CVC, UNITS } from './data.js';
import { h, en, shuffle } from './ui.js';
import { speak, speakLetter } from './speech.js';
import { mcq, distractors, speakerBtn } from './games.js';
import { dueItems, nextDue, itemState, itemKeyOf, itemsOfUnit, unitMastery, dateStr, addDays } from './mastery.js';
import { unitUnlocked } from './store.js';

export const REVIEW_SIZE = 8;
// Pseudo unit for the play screen: no stars, no unlocking.
export const REVIEW_UNIT = { id: 'review', title: 'חזרה יומית', icon: '🔁', color: '#9b6bd6', games: ['review'], review: true };
export const REVIEW_GAME = { title: 'חזרה יומית', icon: '🔁' };

const openUnits = p => UNITS.filter((_, i) => unitUnlocked(p, i));
export const reviewQueue = p => dueItems(p, openUnits(p));

// One question per due item, in a style that fits its unit. Every answer records `recog` for that item.
function question(entry, api) {
  const { unit, item, key } = entry;
  const base = { key, skill: 'recog', unitId: unit.id };
  if (unit.kind === 'letters') {
    const upper = Math.random() < 0.5;
    const show = x => upper ? x.u : x.l;
    return { ...base, layout: 'letters',
      prompt: () => [h('p', { class: 'ask' }, `הקשיבו ובחרו את האות ${upper ? 'הגדולה' : 'הקטנה'}`),
                     speakerBtn(() => speakLetter(item.u))],
      onShow: () => speakLetter(item.u),
      reveal: () => api.later(() => speak(`${item.u}, ${item.word}`), 250),
      options: shuffle([item, ...distractors(LETTERS, item, 3, x => x.u)])
        .map(x => ({ label: en(show(x), 'glyph'), correct: x === item })) };
  }
  const pool = unit.kind === 'reading' ? CVC : unit.items;
  if (unit.kind === 'reading') {
    return { ...base, layout: 'pictures',
      prompt: () => [h('p', { class: 'ask' }, 'קראו את המילה ובחרו את התמונה'), en(item.en, 'word reading')],
      reveal: () => speak(item.en),
      options: shuffle([item, ...distractors(pool, item, 3, x => x.en)])
        .map(x => ({ label: h('span', { class: 'emoji' }, x.emoji), correct: x === item })) };
  }
  if (Math.random() < 0.5) { // hear → picture
    return { ...base, layout: 'pictures',
      prompt: () => [h('p', { class: 'ask' }, 'הקשיבו – מה שמעתם?'), speakerBtn(() => speak(item.en))],
      onShow: () => speak(item.en),
      options: shuffle([item, ...distractors(pool, item, 3, x => x.en)])
        .map(x => ({ label: [h('span', { class: 'emoji' }, x.emoji), h('span', { class: 'he small' }, x.he)], correct: x === item })) };
  }
  return { ...base, // picture → English word
    prompt: () => [h('span', { class: 'emoji huge' }, item.emoji), h('p', { class: 'ask' }, `איך אומרים באנגלית "${item.he}"?`)],
    reveal: () => speak(item.en),
    options: shuffle([item, ...distractors(pool, item, 3, x => x.en)])
      .map(x => ({ label: en(x.en, 'word'), correct: x === item })) };
}

export function runReview(root, api, progress) {
  const queue = reviewQueue(progress).slice(0, REVIEW_SIZE);
  if (!queue.length) {
    root.append(h('div', { class: 'stage' }, h('div', { class: 'prompt' },
      h('span', { class: 'emoji huge' }, '🎉'),
      h('p', { class: 'ask' }, 'אין מה לחזור עליו כרגע – כל הכבוד!'),
      h('a', { class: 'btn primary', href: '#/' }, 'חזרה למסלול'))));
    return;
  }
  root.append(h('p', { class: 'hint' }, 'מילים ואותיות שכבר תרגלתם – בדיוק בזמן לחזור עליהן.'));
  mcq(root, api, shuffle(queue).map(e => question(e, api)));
}

const prettyDate = ymd => {
  const t = dateStr();
  if (ymd <= t) return 'היום';
  if (ymd === addDays(t, 1)) return 'מחר';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' });
};

// Home-screen card. Hidden until the player has practiced something.
export function reviewCard(p) {
  const units = openUnits(p);
  const due = dueItems(p, units).length;
  const next = nextDue(p, units);
  if (!due && !next) return null;
  const n = Math.min(due, REVIEW_SIZE);
  const body = [
    h('span', { class: 'review-icon', 'aria-hidden': 'true' }, due ? '🔁' : '✅'),
    h('span', { class: 'review-text' },
      h('b', {}, 'חזרה יומית'),
      h('small', {}, due ? `${n} ${n === 1 ? 'פריט מחכה' : 'פריטים מחכים'} לחזרה – שומרים על הרצף 🔥`
                         : `סיימתם להיום! החזרה הבאה: ${prettyDate(next)}`)),
    due ? h('span', { class: 'btn primary small-btn', 'aria-hidden': 'true' }, 'מתחילים') : null,
  ];
  return due ? h('a', { class: 'review-card', href: '#/review' }, body)
             : h('div', { class: 'review-card done' }, body);
}

const STATE_LABEL = { new: 'עוד לא תרגלנו', practicing: 'בתרגול', mastered: 'נשלט' };

// Compact grid of a unit's items coloured by state; tapping an item says it.
export function masteryGrid(p, unit) {
  const items = itemsOfUnit(unit);
  if (!items.length) return null;
  const m = unitMastery(p, unit);
  const noun = unit.kind === 'letters' ? 'אותיות' : 'מילים';
  return h('section', { class: 'mastery sheet', 'aria-labelledby': 'mastery-title' },
    h('div', { class: 'mastery-head' },
      h('h2', { id: 'mastery-title' }, 'מה כבר שולטים?'),
      h('span', { class: 'mastery-count' }, `${m.mastered}/${m.total} ${noun} נשלטו`)),
    h('div', { class: `mastery-grid ${unit.kind}`, dir: 'ltr' }, items.map(item => {
      const key = itemKeyOf(unit, item);
      const state = itemState(p, unit, item);
      const label = unit.kind === 'letters' ? key : item.en;
      return h('button', { class: `mitem ${state}`, type: 'button', lang: 'en',
        title: `${label} – ${STATE_LABEL[state]}`, 'aria-label': `${label}: ${STATE_LABEL[state]}`,
        onclick: () => unit.kind === 'letters' ? speakLetter(item.u) : speak(item.en) },
        unit.kind === 'letters' ? en(`${item.u}${item.l}`, 'glyph')
          : [h('span', { class: 'memoji', 'aria-hidden': 'true' }, item.emoji), en(item.en, 'mword')]);
    })),
    h('div', { class: 'mastery-legend' },
      ['new', 'practicing', 'mastered'].map(s => h('span', { class: `legend ${s}` }, h('i', {}), STATE_LABEL[s]))));
}
