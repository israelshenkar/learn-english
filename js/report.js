// Progress metrics for adults: the parent report page and the small per-group summaries.
// Pure functions over a progress object; nothing here touches the network or the DOM.
import { UNITS, GAMES, LETTERS } from './data.js';
import { countedGames, unitStars, unitMaxStars, dayStreak } from './store.js';

const KEEP_DAYS = 60;          // per-day log is pruned to this many days
const MAX_ROUND_SECS = 15 * 60; // a round left open longer than this counts as 15 minutes

export const dayKey = (d = new Date()) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD, local time

// Called inside store.update() when a round ends: progress.dayLog[date] = { r, c, w, s }.
export function logRound(p, res, secs) {
  const daily = (p.dayLog && typeof p.dayLog === 'object') ? p.dayLog : (p.dayLog = {});
  const e = daily[dayKey()] ||= { r: 0, c: 0, w: 0, s: 0 };
  e.r += 1;
  if (!res.learn) { // "learn" rounds count cards viewed, not answers
    e.c += res.correct || 0;
    e.w += res.wrong || 0;
  }
  e.s += Math.round(Math.min(Math.max(secs || 0, 0), MAX_ROUND_SECS));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - KEEP_DAYS);
  const ck = dayKey(cutoff);
  for (const d of Object.keys(daily)) if (d < ck) delete daily[d];
}

const dailyLog = p => (p.dayLog && typeof p.dayLog === 'object' ? p.dayLog : {});

// Days with play. Before the per-day log existed we only know which days the app was opened (p.days).
export function activeDaySet(p) {
  const log = dailyLog(p);
  const logged = Object.keys(log).filter(d => log[d]?.r > 0);
  const first = Object.keys(log).sort()[0];
  // p.days also gets "today" just for opening the app, so only trust it for an account that has played.
  const older = (p.stats?.rounds ? p.days || [] : []).filter(d => !first || d < first);
  return new Set([...logged, ...older]);
}

export function lastActive(p) {
  return [...activeDaySet(p)].sort().pop() || null;
}

// One entry per day, oldest first.
export function lastDays(p, n = 14) {
  const log = dailyLog(p);
  const active = activeDaySet(p);
  const out = [];
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    const key = dayKey(d);
    const e = log[key];
    out.push({
      date: key, weekday: d.toLocaleDateString('he-IL', { weekday: 'short' }).replace(/^יום /, ''), dayNum: d.getDate(), month: d.getMonth() + 1,
      played: active.has(key), detailed: !!e, rounds: e?.r || 0, correct: e?.c || 0, wrong: e?.w || 0, secs: e?.s || 0,
    });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export const unitTotal = unit => (unit.kind === 'letters' ? LETTERS.length : unit.items?.length || 0);

// progress.items[unitId][itemKey] = { right, wrong, last, skills: {...} } (written by the smart-practice feature).
// Mastered = every recorded skill is true. If items are missing we fall back to `seen` + stars.
const isMastered = it => {
  const s = it?.skills;
  if (!s || typeof s !== 'object') return false;
  const v = Object.values(s);
  return v.length > 0 && v.every(x => x === true);
};

function itemLabel(unit, key) {
  if (unit.kind === 'letters') {
    const L = LETTERS.find(l => l.u === key || l.l === key || l.word === key);
    return { en: L ? `${L.u}${L.l}` : String(key), he: L ? L.name : '' };
  }
  const w = unit.items?.find(i => i.en === key);
  return { en: String(key), he: w?.he || '', emoji: w?.emoji || '' };
}

export function unitReport(p) {
  const items = (p.items && typeof p.items === 'object') ? p.items : null;
  return UNITS.map((u, i) => {
    const games = countedGames(u);
    const stars = unitStars(p, u), max = unitMaxStars(u);
    const played = games.filter(g => `${u.id}/${g}` in p.stars).length;
    const status = stars >= max ? 'excellent'
      : games.every(g => (p.stars[`${u.id}/${g}`] || 0) >= 1) ? 'done'
      : (played || p.seen[u.id]?.length) ? 'started' : 'none';
    const ui = items?.[u.id] && typeof items[u.id] === 'object' ? items[u.id] : null;
    return {
      unit: u, index: i, stars, max, status,
      seen: p.seen[u.id]?.length || 0, total: unitTotal(u),
      mastered: ui ? Object.values(ui).filter(isMastered).length : null,
    };
  });
}

export const STATUS_HE = { none: 'עוד לא התחיל', started: 'בתהליך', done: 'הושלם', excellent: 'הושלם בהצטיינות' };

export function weakSpots(p, limit = 8) {
  const items = (p.items && typeof p.items === 'object') ? p.items : null;
  const out = [];
  if (items) {
    for (const u of UNITS) {
      for (const [key, it] of Object.entries(items[u.id] || {})) {
        const right = it?.right || 0, wrong = it?.wrong || 0;
        if (wrong >= 2 && wrong >= right && !isMastered(it)) {
          out.push({ kind: 'item', unit: u, label: itemLabel(u, key), right, wrong, score: wrong / (right + wrong) + wrong / 100 });
        }
      }
    }
  }
  // Games that were played but scored 0–1 stars (best result so far).
  UNITS.forEach(u => countedGames(u).forEach(g => {
    const k = `${u.id}/${g}`;
    if (k in p.stars && p.stars[k] <= 1) out.push({ kind: 'game', unit: u, game: GAMES[g], stars: p.stars[k], score: 0.5 - p.stars[k] / 10 });
  }));
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function overview(p) {
  const days = lastDays(p, 14);
  const units = unitReport(p);
  const hasItems = units.some(r => r.mastered !== null);
  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const c14 = sum(days, d => d.correct), w14 = sum(days, d => d.wrong);
  const letters = units.find(r => r.unit.kind === 'letters');
  const wordUnits = units.filter(r => r.unit.kind !== 'letters');
  return {
    days, units, hasItems,
    activeDays14: days.filter(d => d.played).length,
    rounds14: sum(days, d => d.rounds),
    minutes14: Math.round(sum(days, d => d.secs) / 60),
    accuracy14: c14 + w14 ? Math.round((100 * c14) / (c14 + w14)) : null,
    accuracyAll: p.stats.correct + p.stats.wrong ? Math.round((100 * p.stats.correct) / (p.stats.correct + p.stats.wrong)) : null,
    streak: dayStreak(p),
    unitsDone: units.filter(r => r.status === 'done' || r.status === 'excellent').length,
    lettersSeen: letters?.seen || 0, lettersTotal: letters?.total || 26, lettersMastered: letters?.mastered,
    wordsSeen: sum(wordUnits, r => r.seen), wordsTotal: sum(wordUnits, r => r.total),
    wordsMastered: hasItems ? sum(wordUnits, r => r.mastered || 0) : null,
    weak: weakSpots(p),
    lastActive: lastActive(p),
  };
}

// The small summary a player shares with their groups (see firestore.rules → members).
export function groupSummary(user) {
  const p = user.progress;
  const units = unitReport(p);
  const hasItems = units.some(r => r.mastered !== null);
  const active = activeDaySet(p);
  const d = new Date();
  let active7 = 0;
  for (let i = 0; i < 7; i++) { if (active.has(dayKey(d))) active7++; d.setDate(d.getDate() - 1); }
  const s = {
    nick: String(user.nick).slice(0, 16),
    avatar: String(user.avatar).slice(0, 16),
    points: Math.max(0, Math.round(p.points) || 0),
    stars: Object.fromEntries(units.slice(0, 40).map(r => [r.unit.id, r.stars])),
    learned: units.reduce((n, r) => n + r.seen, 0),
    rounds: p.stats.rounds || 0,
    active7,
  };
  if (hasItems) s.mastered = units.reduce((n, r) => n + (r.mastered || 0), 0);
  const la = lastActive(p);
  if (la) s.lastActive = la;
  return s;
}
