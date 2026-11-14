// Player accounts + progress, stored in Firebase (Auth + Firestore) so a player can continue on any device.
// Reads are synchronous from an in-memory copy; writes are sent to Firestore in the background
// (debounced, and flushed right away at the end of each round).
import { UNITS, GAMES } from './data.js';
import * as cloud from './cloud.js';

const RECENT_KEY = 'mec.recent.v1';      // nicknames that signed in on this device (for quick login)
const SETTINGS_KEY = 'mec.settings.v1';

function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time

function freshProgress() {
  return {
    points: 0,
    stars: {},          // "unit/game" -> best stars (0..3)
    seen: {},           // unitId -> [item keys viewed in "learn"]
    days: [],           // dates played
    trophies: {},       // trophyId -> date earned
    stats: { rounds: 0, perfect: 0, correct: 0, wrong: 0, bestStreak: 0, traced: 0, said: 0 },
  };
}
function withDefaults(progress = {}) {
  const base = freshProgress();
  return { ...base, ...progress, stats: { ...base.stats, ...(progress.stats || {}) } };
}

let cur = null;          // { uid, nick, avatar, created, progress }
let saveTimer = null;
let saving = Promise.resolve();

// --- Startup ---------------------------------------------------------------

export async function init() {
  await cloud.loadCloud();
  const user = await cloud.authReady();
  if (user) {
    try { await loadProfile(user.uid); }
    catch { cur = null; }
  }
  addEventListener('pagehide', () => flush());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}

async function loadProfile(uid) {
  const data = await cloud.readProfile(uid);
  if (!data) { cur = null; return; }
  cur = { uid, nick: data.nick, avatar: data.avatar, created: data.created, progress: withDefaults(data.progress) };
  rememberRecent(cur);
  touchDay();
}

function rememberRecent(u) {
  const list = read(RECENT_KEY, []).filter(x => cloud.normNick(x.nick) !== cloud.normNick(u.nick));
  write(RECENT_KEY, [{ nick: u.nick, avatar: u.avatar }, ...list].slice(0, 8));
}
export const recentPlayers = () => read(RECENT_KEY, []);
export function forgetRecent(nick) {
  write(RECENT_KEY, read(RECENT_KEY, []).filter(x => cloud.normNick(x.nick) !== cloud.normNick(nick)));
}

// --- Accounts ----------------------------------------------------------------

function checkNick(nick) {
  nick = nick.normalize('NFC').trim();
  if (nick.length < 2) throw new Error('הכינוי צריך להיות לפחות 2 תווים');
  if (nick.length > 16) throw new Error('הכינוי ארוך מדי (עד 16 תווים)');
  return nick;
}

export async function register(nick, avatar, password) {
  nick = checkNick(nick);
  if (password.length < 6) throw new Error('הסיסמה צריכה להיות לפחות 6 תווים');
  let user;
  try { user = await cloud.signUp(nick, password); }
  catch (e) { throw new Error(cloud.hebrewAuthError(e)); }
  cur = { uid: user.uid, nick, avatar, created: Date.now(), progress: freshProgress() };
  touchDay();
  rememberRecent(cur);
  await flush();
}

export async function login(nick, password) {
  nick = checkNick(nick);
  let user;
  try { user = await cloud.signIn(nick, password); }
  catch (e) { throw new Error(cloud.hebrewAuthError(e)); }
  try { await loadProfile(user.uid); }
  catch { throw new Error('לא הצלחנו לטעון את ההתקדמות. בדקו את החיבור ונסו שוב'); }
  if (!cur) { // account exists but the profile was never saved – start it now
    cur = { uid: user.uid, nick, avatar: '🦊', created: Date.now(), progress: freshProgress() };
    touchDay();
    rememberRecent(cur);
    await flush();
  }
}

export async function logout() {
  await flush();
  cur = null;
  await cloud.signOutCloud();
}

export function currentUser() { return cur; }

// --- Saving --------------------------------------------------------------------

// Apply a change to the current player's progress; it's saved to the cloud shortly after.
export function update(fn) {
  if (!cur) return null;
  fn(cur.progress);
  const d = today();
  if (!cur.progress.days.includes(d)) cur.progress.days.push(d);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 1500);
  return cur;
}

function touchDay() { update(() => {}); }

// Send the latest progress now. Safe to call often.
export function flush() {
  clearTimeout(saveTimer);
  if (!cur) return saving;
  const { uid, nick, avatar, created, progress } = cur;
  const snapshot = JSON.parse(JSON.stringify({ nick, avatar, created, progress }));
  saving = saving
    .then(() => cloud.writeProfile(uid, snapshot, Object.keys(snapshot.progress.trophies).length))
    .catch(err => console.warn('[mec] save failed – will retry on next change', err));
  return saving;
}

export async function leaderboard() {
  try { return await cloud.topPlayers(20); }
  catch { return null; }
}

// --- Derived values -------------------------------------------------------

export function dayStreak(p) {
  const set = new Set(p.days);
  let n = 0;
  const d = new Date();
  if (!set.has(d.toLocaleDateString('en-CA'))) d.setDate(d.getDate() - 1); // streak still alive until tonight
  while (set.has(d.toLocaleDateString('en-CA'))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export const countedGames = unit => unit.games.filter(g => !GAMES[g].bonus);
export const unitStars = (p, unit) => countedGames(unit).reduce((s, g) => s + (p.stars[`${unit.id}/${g}`] || 0), 0);
export const unitMaxStars = unit => countedGames(unit).length * 3;
export const unitNeeded = unit => Math.ceil(unitMaxStars(unit) / 2);

export function unitUnlocked(p, index) {
  if (index === 0) return true;
  const prev = UNITS[index - 1];
  return unitStars(p, prev) >= unitNeeded(prev) && unitUnlocked(p, index - 1);
}

export function wordsLearned(p) {
  return UNITS.filter(u => u.kind !== 'letters').reduce((n, u) => n + (p.seen[u.id]?.length || 0), 0);
}

// --- Settings (per device) -----------------------------------------------
export const settings = {
  get: () => read(SETTINGS_KEY, { sound: true }),
  set: patch => write(SETTINGS_KEY, { ...settings.get(), ...patch }),
};
