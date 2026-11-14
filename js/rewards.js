// Daily goal, day streak, coins (wallet) and the shop catalogue.
// State lives on the player's progress under its own keys; older accounts get safe defaults via ensure():
//   progress.daily  = { date: 'YYYY-MM-DD', rounds, celebrated }   rounds finished today
//   progress.wallet = coins to spend
//   progress.owned  = ['avatar:🐶', 'theme:mint', …]               bought items
//   progress.theme  = '' (classic) | theme key
//   progress.freezes = streak freezes held;  progress.frozen = dates covered by a freeze
//   progress.days   = dates the daily goal was met (that is what the 🔥 day streak counts)
import { AVATARS } from './data.js';
import { today, dayStreak, update } from './store.js';
import { h, toast, confetti, sfx } from './ui.js';

export const GOAL = 3;          // rounds per day
export const GOAL_BONUS = 10;   // coins for meeting the daily goal
export const FREEZE_PRICE = 25;
export const MAX_FREEZES = 2;

// Extra avatars (single-codepoint emoji only – the leaderboard row keeps the avatar as one short string).
export const SHOP_AVATARS = [
  ['🐶', 15], ['🐱', 15], ['🐰', 15], ['🐻', 15], ['🐧', 15], ['🐞', 15],
  ['🐝', 20], ['🦋', 20], ['🐬', 20], ['🦔', 20], ['🦩', 25], ['🦈', 25],
  ['🦖', 30], ['🐉', 40], ['🤖', 40], ['👽', 40], ['🚀', 50], ['👑', 60],
].map(([emoji, price]) => ({ id: `avatar:${emoji}`, kind: 'avatar', emoji, price }));

// Notebook themes = CSS custom-property overrides on [data-theme=…] (see the end of styles.css).
export const THEMES = [
  { key: '',       title: 'מחברת קלאסית', price: 0,  color: '#fbf6ea' },
  { key: 'mint',   title: 'מנטה רעננה',   price: 40, color: '#eaf7ef' },
  { key: 'sky',    title: 'שמיים כחולים', price: 40, color: '#ecf3fd' },
  { key: 'bubble', title: 'מסטיק ורוד',   price: 50, color: '#fdeef4' },
  { key: 'kraft',  title: 'נייר חום',     price: 60, color: '#f2e4ca' },
].map(t => ({ ...t, id: `theme:${t.key}`, kind: 'theme' }));

// --- State -------------------------------------------------------------------

const sumStars = p => Object.values(p.stars || {}).reduce((s, n) => s + (n || 0), 0);

// Fill in missing keys (older accounts). Safe to call on every read.
export function ensure(p) {
  if (!p.daily || typeof p.daily !== 'object') p.daily = { date: '', rounds: 0, celebrated: false };
  if (typeof p.wallet !== 'number') p.wallet = sumStars(p); // welcome gift: a coin for every star already earned
  if (!Array.isArray(p.owned)) p.owned = [];
  if (typeof p.theme !== 'string') p.theme = '';
  if (typeof p.freezes !== 'number') p.freezes = 0;
  if (!Array.isArray(p.frozen)) p.frozen = [];
  if (!Array.isArray(p.days)) p.days = [];
  return p;
}

export const roundsToday = p => (ensure(p).daily.date === today() ? p.daily.rounds : 0);
export const goalMetToday = p => ensure(p).days.includes(today());
export function owns(p, id) {
  if (id === 'theme:') return true;                                          // classic notebook
  if (id.startsWith('avatar:') && AVATARS.includes(id.slice(7))) return true; // the 12 starting avatars
  return ensure(p).owned.includes(id);
}

// Called inside store.update() when a round ends, before trophies are checked.
// Coins: one per star earned in the round, plus a bonus the first time today's goal is met.
export function onRound(p, res) {
  ensure(p);
  const d = today();
  if (p.daily.date !== d) p.daily = { date: d, rounds: 0, celebrated: false };
  p.daily.rounds++;
  let coins = Math.max(0, res.stars || 0);
  let goalMet = false;
  if (p.daily.rounds >= GOAL && !p.daily.celebrated) {
    p.daily.celebrated = true;
    goalMet = true;
    coins += GOAL_BONUS;
    if (!p.days.includes(d)) p.days.push(d);
    p.stats.goals = (p.stats.goals || 0) + 1;
  }
  p.wallet += coins;
  p.stats.coins = (p.stats.coins || 0) + coins; // lifetime coins earned
  return { coins, goalMet, rounds: p.daily.rounds };
}

const dateStr = d => d.toLocaleDateString('en-CA');

// A held streak freeze covers missed days (up to the number held) so the streak survives.
// Returns true if it changed anything (call inside store.update()).
export function useFreezes(p) {
  ensure(p);
  if (!p.freezes || !p.days.length) return false;
  const set = new Set(p.days);
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (set.has(dateStr(y))) return false;            // streak intact
  const missing = [];
  const d = new Date(y);
  while (!set.has(dateStr(d)) && missing.length <= p.freezes) { missing.push(dateStr(d)); d.setDate(d.getDate() - 1); }
  if (!set.has(dateStr(d)) || missing.length > p.freezes) return false; // gap too long – nothing to save
  for (const m of missing) { p.days.push(m); p.frozen.push(m); }
  p.days.sort();
  p.freezes -= missing.length;
  return missing.length;
}

// Once per day per session: spend held freezes on missed days and tell the player.
let checked = '';
export function dailyCheck(user) {
  const key = `${user.uid}/${today()}`;
  if (checked === key) return;
  checked = key;
  if (!ensure(user.progress).freezes) return;
  let used = 0;
  update(pr => { used = useFreezes(pr); });
  if (used) setTimeout(() => toast(h('div', { class: 'toast-trophy' }, h('span', { class: 'big-emoji' }, '❄️'),
    h('div', {}, h('b', {}, 'הקפאת הרצף הצילה את היום!'), h('div', {}, `הרצף נשמר (${used === 1 ? 'יום אחד' : `${used} ימים`}). שחקו היום כדי להמשיך 🔥`))), 5000), 600);
}

// --- Theme -------------------------------------------------------------------

const THEME_KEY = 'mec.theme.v1'; // per-device copy, so the loading screen already has the player's theme

export function applyTheme(user) {
  const key = user ? ensure(user.progress).theme : '';
  if (key) document.body.dataset.theme = key; else delete document.body.dataset.theme;
  try { localStorage.setItem(THEME_KEY, key); } catch {}
  const color = (THEMES.find(t => t.key === key) || THEMES[0]).color;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}

try { const k = localStorage.getItem(THEME_KEY); if (k && THEMES.some(t => t.key === k)) document.body.dataset.theme = k; } catch {}

// --- Bits of UI ----------------------------------------------------------------

export function ring(done, { size = '', label } = {}) {
  const pct = Math.min(100, Math.round((Math.min(done, GOAL) / GOAL) * 100));
  return h('span', { class: `goal-ring ${size} ${done >= GOAL ? 'full' : ''}`, style: { '--pct': pct }, 'data-goal-ring': '' },
    h('span', { class: 'goal-ring-in' }, label ?? '🔥'));
}

// Topbar chips: day streak with today's goal ring around the flame, and coins (→ shop).
export function topbarChips(p) {
  const n = roundsToday(p);
  return [
    h('span', { class: 'chip streak-chip', title: `ימים ברצף · היום ${Math.min(n, GOAL)}/${GOAL} סבבים`, 'data-streak-chip': '' },
      ring(n, { size: 'mini' }), h('b', {}, dayStreak(p))),
    h('a', { class: 'chip link coin-chip', href: '#/shop', title: 'מטבעות · לחנות', 'data-coins': '' },
      '🪙 ', h('b', {}, ensure(p).wallet.toLocaleString('he-IL'))),
  ];
}

// Update the chips in place (no re-render – a game may be running).
export function paintChips(p) {
  const chip = document.querySelector('.topbar [data-streak-chip]');
  if (chip) chip.replaceWith(topbarChips(p)[0]);
  const coins = document.querySelector('.topbar [data-coins] b');
  if (coins) coins.textContent = ensure(p).wallet.toLocaleString('he-IL');
}

const DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

// Home card: today's goal ring, this week's days and the current streak.
export function todayCard(p) {
  ensure(p);
  const n = roundsToday(p), met = goalMetToday(p), streak = dayStreak(p);
  const now = new Date(), start = new Date(now); start.setDate(now.getDate() - now.getDay()); // week starts on Sunday
  const days = new Set(p.days), frozen = new Set(p.frozen), t = today();
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const ds = dateStr(d);
    const state = frozen.has(ds) ? 'frozen' : days.has(ds) ? 'done' : ds === t ? 'today' : ds > t ? 'future' : 'missed';
    const mark = { done: '✓', frozen: '❄️', today: `${Math.min(n, GOAL)}/${GOAL}`, future: '', missed: '·' }[state];
    return h('li', { class: `wday ${state} ${ds === t ? 'is-today' : ''}`, title: d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' }) },
      h('span', { class: 'wday-name' }, DAY_LETTERS[i]), h('span', { class: 'wday-mark' }, mark));
  });
  const left = GOAL - n;
  const msg = met
    ? 'עמדתם ביעד של היום! 🎉 חוזרים מחר כדי להמשיך את הרצף 🌙'
    : streak > 0
      ? `עוד ${left === 1 ? 'סבב אחד' : `${left} סבבים`} היום כדי לשמור על הרצף של ${streak} ימים!`
      : `שחקו ${left === 1 ? 'עוד סבב אחד' : `עוד ${left} סבבים`} היום ותתחילו רצף 🔥`;
  return h('section', { class: `sheet today-card ${met ? 'met' : ''}`, 'aria-label': 'היעד היומי והרצף' },
    h('div', { class: 'today-ring' }, ring(n, { size: 'big', label: met ? '🎯' : h('bdi', { dir: 'ltr' }, h('b', {}, Math.min(n, GOAL)), `/${GOAL}`) }),
      h('small', {}, 'סבבים היום')),
    h('div', { class: 'today-main' },
      h('h2', {}, 'היעד היומי: ', GOAL, ' סבבים'),
      h('p', { class: 'today-msg' }, msg),
      h('ol', { class: 'week', 'aria-label': 'השבוע שלי' }, week),
      h('div', { class: 'today-foot' },
        h('span', { class: 'streak-big' }, '🔥 ', h('b', {}, streak), streak === 1 ? ' יום ברצף' : ' ימים ברצף',
          p.freezes > 0 && h('span', { class: 'freeze-held', title: 'הקפאות רצף שמורות' }, ` · ❄️×${p.freezes}`)),
        h('a', { class: 'btn shop-btn', href: '#/shop' }, '🛍️ לחנות · 🪙 ', h('b', {}, p.wallet.toLocaleString('he-IL'))))));
}

// Lines for the results overlay.
export function resultLines(reward) {
  if (!reward) return null;
  return [
    reward.coins > 0 && h('p', { class: 'coins-won' }, h('bdi', { dir: 'ltr' }, `+${reward.coins}`), ' מטבעות 🪙'),
    reward.goalMet
      ? h('p', { class: 'goal-done' }, '🎯 עמדתם ביעד היומי! בונוס ', h('bdi', { dir: 'ltr' }, `+${GOAL_BONUS}`), ' 🪙')
      : reward.rounds < GOAL && h('p', { class: 'goal-left' }, `🎯 ${GOAL - reward.rounds === 1 ? 'עוד סבב אחד' : `עוד ${GOAL - reward.rounds} סבבים`} ליעד היומי`),
  ];
}

export function celebrateGoal() {
  setTimeout(() => {
    sfx.goal();
    confetti(160);
    toast(h('div', { class: 'toast-trophy' }, h('span', { class: 'big-emoji' }, '🎯'),
      h('div', {}, h('b', {}, 'היעד היומי הושלם!'), h('div', {}, 'הרצף שלכם ממשיך 🔥 נתראה מחר!'))), 4200);
  }, 700);
}
