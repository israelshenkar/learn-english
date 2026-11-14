// Per-item practice tracking, adaptive item choice and spaced-repetition review.
// Pure helpers: pass the player's `progress` in (mutate it only inside store.update).
//
// progress.items[unitId][itemKey] = { right, wrong, last: 'YYYY-MM-DD', skills: { recog, write, spell, say },
//                                     box: 0..4, due: 'YYYY-MM-DD' }
// Every field may be missing (older accounts) – read through getItem().
import { LETTERS, GAMES } from './data.js';

export const GAME_SKILL = { listen: 'recog', pick: 'recog', read: 'recog', sounds: 'recog', memory: 'recog',
                            trace: 'write', spell: 'spell', say: 'say' };
const INTERVALS = [0, 1, 3, 7, 14]; // days until the next review, by box
const SPELLABLE = /^[a-z]{2,8}$/;  // same filter the spell game uses

export const itemKeyOf = (unit, item) => unit.kind === 'letters' ? item.u : item.en;
export const itemsOfUnit = unit => unit.kind === 'letters' ? LETTERS : (unit.items || []);

export const dateStr = (d = new Date()) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
export function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  return dateStr(new Date(y, m - 1, d + n));
}
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

export function getItem(progress, unitId, key) {
  const r = progress?.items?.[unitId]?.[key] || {};
  return {
    right: r.right || 0, wrong: r.wrong || 0, last: r.last || null,
    skills: { ...(r.skills || {}) }, box: r.box || 0, due: r.due || r.last || null,
  };
}
const practiced = r => r.right + r.wrong > 0;

// Skills an item needs for mastery: the skills of the unit's non-bonus games that can test it.
export function applicableSkills(unit, item) {
  const set = new Set();
  for (const g of unit.games || []) {
    const skill = GAME_SKILL[g];
    if (!skill || GAMES[g]?.bonus) continue;
    if (skill === 'spell' && unit.kind !== 'letters' && !SPELLABLE.test(item.en)) continue;
    set.add(skill);
  }
  return [...set];
}

export function itemState(progress, unit, item) {
  const r = getItem(progress, unit.id, itemKeyOf(unit, item));
  if (!practiced(r)) return 'new';
  const need = applicableSkills(unit, item);
  return need.length && need.every(s => r.skills[s] === true) ? 'mastered' : 'practicing';
}
export const isMastered = (progress, unit, item) => itemState(progress, unit, item) === 'mastered';

export function unitMastery(progress, unit) {
  const out = { mastered: 0, practicing: 0, new: 0, total: 0 };
  for (const item of itemsOfUnit(unit)) { out[itemState(progress, unit, item)]++; out.total++; }
  return out;
}

// Record one answer. A skill becomes true on a first-try success and false on a mistake.
// Spaced repetition: a correct answer moves the item up a box (at most once per due date),
// a mistake drops it to box 0 and makes it due today.
export function record(progress, unitId, key, correct, skill, today = dateStr()) {
  const unitItems = (progress.items ||= {})[unitId] ||= {};
  const r = getItem(progress, unitId, key);
  if (correct) {
    r.right++;
    if (!r.due || r.box === 0 || r.due <= today) {
      r.box = Math.min(r.box + 1, INTERVALS.length - 1);
      r.due = addDays(today, INTERVALS[r.box]);
    }
  } else {
    r.wrong++;
    r.box = 0;
    r.due = today;
  }
  if (skill) r.skills[skill] = !!correct;
  r.last = today;
  unitItems[key] = r;
  return r;
}

// How much an item needs practice right now (higher = sooner). Never-practiced first, then never tried
// with this skill, then missed at this skill, then recent mistakes, then the longest-unseen; with a bit
// of randomness (jitter < tier gap, so every item gets its first try within ceil(items / n) rounds).
export function weakness(progress, unit, item, skill, { today = dateStr(), rand = Math.random } = {}) {
  const r = getItem(progress, unit.id, itemKeyOf(unit, item));
  let score;
  if (!practiced(r)) score = 1000;
  else if (skill && r.skills[skill] === undefined) score = 850; // never tried with this skill
  else if (skill && r.skills[skill] !== true) score = 700;      // tried and missed
  else if (r.box === 0) score = 500;
  else {
    const age = r.last ? Math.max(0, daysBetween(r.last, today)) : 30;
    const overdue = r.due ? Math.max(0, daysBetween(r.due, today)) : 0;
    score = Math.min(300, age * 15 + overdue * 10) + (4 - r.box) * 20;
  }
  return score + rand() * 150;
}

// Adaptive replacement for sample(pool, n): the n neediest items, returned in random order.
export function pickItems(progress, unit, pool, n, skill, opts = {}) {
  const rand = opts.rand || Math.random;
  const chosen = pool
    .map(item => ({ item, w: weakness(progress, unit, item, skill, { ...opts, rand }) }))
    .sort((a, b) => b.w - a.w)
    .slice(0, n)
    .map(x => x.item);
  for (let i = chosen.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [chosen[i], chosen[j]] = [chosen[j], chosen[i]]; }
  return chosen;
}

// Practiced items (in the given units) whose review date has come, most overdue first.
export function dueItems(progress, units, today = dateStr(), rand = Math.random) {
  const out = [];
  for (const unit of units) {
    for (const item of itemsOfUnit(unit)) {
      const key = itemKeyOf(unit, item);
      const r = getItem(progress, unit.id, key);
      if (!practiced(r)) continue;
      const due = r.due || today;
      if (due <= today) out.push({ unit, item, key, due, box: r.box, j: rand() });
    }
  }
  return out.sort((a, b) => a.due.localeCompare(b.due) || a.box - b.box || a.j - b.j);
}

// The next review date among practiced items (for "come back on …"), or null.
export function nextDue(progress, units) {
  let best = null;
  for (const unit of units) for (const item of itemsOfUnit(unit)) {
    const r = getItem(progress, unit.id, itemKeyOf(unit, item));
    if (practiced(r) && r.due && (!best || r.due < best)) best = r.due;
  }
  return best;
}
