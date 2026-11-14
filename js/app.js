import { UNITS, GAMES, AVATARS } from './data.js';
import * as store from './store.js';
import { TROPHIES, awardTrophies } from './trophies.js';
import { runGame } from './games.js';
import { h, en, toast, confetti, starsRow, sfx } from './ui.js';
import { canSpeak } from './speech.js';

const app = document.getElementById('app');
let cleanups = [];

function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

function render() {
  cleanups.forEach(fn => { try { fn(); } catch {} });
  cleanups = [];
  globalThis.speechSynthesis?.cancel();
  const user = store.currentUser();
  const hash = location.hash || '#/';
  let m;
  if (!user) return authScreen();
  if ((m = hash.match(/^#\/unit\/([\w-]+)$/))) return unitScreen(user, m[1]);
  if ((m = hash.match(/^#\/play\/([\w-]+)\/(\w+)$/))) return playScreen(user, m[1], m[2]);
  if (hash === '#/trophies') return trophiesScreen(user);
  return homeScreen(user);
}

function mount(...nodes) {
  app.replaceChildren(...nodes);
  window.scrollTo(0, 0);
  app.querySelector('h1, h2')?.focus?.({ preventScroll: true });
}

const brand = () => h('div', { class: 'brand' },
  h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, en('Aa', 'glyph')),
  h('span', { class: 'brand-text' }, h('b', {}, 'המחברת האנגלית'), h('small', {}, en('My English Notebook'))));

function topbar(user, { back } = {}) {
  const p = user.progress;
  const sound = store.settings.get().sound;
  const soundBtn = h('button', { class: 'icon-btn', type: 'button' });
  const paintSound = on => { soundBtn.textContent = on ? '🔔' : '🔕'; soundBtn.setAttribute('aria-label', on ? 'השתקת צלילים' : 'הפעלת צלילים'); };
  paintSound(sound);
  // Toggle in place – re-rendering would restart a running game.
  soundBtn.addEventListener('click', () => { const on = !store.settings.get().sound; store.settings.set({ sound: on }); paintSound(on); });
  return h('header', { class: 'topbar' },
    back ? h('a', { class: 'back', href: back, 'aria-label': 'חזרה' }, '→') : brand(),
    h('nav', { class: 'chips', 'aria-label': 'סטטוס' },
      h('span', { class: 'chip', title: 'נקודות' }, '⭐ ', h('b', {}, p.points.toLocaleString('he-IL'))),
      h('span', { class: 'chip', title: 'ימים ברצף' }, '🔥 ', h('b', {}, store.dayStreak(p))),
      h('a', { class: 'chip link', href: '#/trophies', title: 'גביעים' }, '🏆 ', h('b', {}, Object.keys(p.trophies).length)),
      soundBtn,
      h('button', { class: 'avatar-btn', type: 'button', 'aria-label': `${user.nick} – יציאה`, title: 'יציאה',
        onclick: async () => { if (confirm(`לצאת מהפרופיל של ${user.nick}?`)) { await store.logout(); go('#/'); } } }, user.avatar)));
}

// ---------------------------------------------------------------------------
function busy(btn, on, label) {
  btn.disabled = on;
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; }
  else if (btn.dataset.label) btn.textContent = btn.dataset.label;
}

function passwordInput(id, autocomplete) {
  return h('input', { id, type: 'password', autocomplete, minlength: 6, required: true, dir: 'ltr', class: 'password' });
}

function authScreen() {
  const recent = store.recentPlayers();
  const box = h('div', { class: 'auth-box sheet' });
  const pageTitle = h('h1', { tabindex: -1 }, 'לומדים אנגלית – אות אחרי אות');

  mount(h('main', { class: 'auth' },
    h('div', { class: 'auth-hero' },
      brand(), pageTitle,
      h('p', { class: 'lead' }, 'משחקים, צוברים נקודות וגביעים, ומתחילים לקרוא, לכתוב ולדבר באנגלית.'),
      h('div', { class: 'hero-letters', 'aria-hidden': 'true' },
        ['A', 'b', 'C', 'd', 'E'].map((c, k) => h('span', { style: { animationDelay: `${k * 90}ms` } }, en(c, 'glyph'))))),
    box));

  if (recent.length) showPicker(); else showRegister();

  function showPicker() {
    box.replaceChildren(
      h('h2', {}, 'מי משחק/ת?'),
      h('div', { class: 'profiles' },
        recent.map(u => h('button', { class: 'profile', type: 'button', onclick: () => showLogin(u) },
          h('span', { class: 'avatar' }, u.avatar), h('span', { class: 'nick' }, u.nick))),
        h('button', { class: 'profile add', type: 'button', onclick: () => showLogin(null) },
          h('span', { class: 'avatar' }, '🔑'), h('span', { class: 'nick' }, 'כניסה עם כינוי אחר')),
        h('button', { class: 'profile add', type: 'button', onclick: showRegister },
          h('span', { class: 'avatar' }, '＋'), h('span', { class: 'nick' }, 'שחקן/ית חדש/ה'))));
  }

  function showLogin(u) {
    const err = h('p', { class: 'error', role: 'alert' });
    const nick = h('input', { id: 'login-nick', type: 'text', maxlength: 16, required: true, autocomplete: 'username',
      value: u?.nick || '' });
    const pw = passwordInput('login-pw', 'current-password');
    const submit = h('button', { class: 'btn primary', type: 'submit' }, 'כניסה');
    const form = h('form', { class: 'form' },
      u ? h('div', { class: 'who' }, h('span', { class: 'avatar big' }, u.avatar), h('h2', {}, `היי ${u.nick}!`))
        : h('h2', {}, 'כניסה'),
      h('label', { for: 'login-nick', class: u ? 'sr-only' : '' }, 'כינוי'), nick,
      h('label', { for: 'login-pw' }, 'סיסמה'), pw, err,
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost', type: 'button', onclick: recent.length ? showPicker : showRegister }, 'חזרה'),
        submit),
      !u && h('p', { class: 'hint small' }, 'אין לך עדיין משתמש? ',
        h('button', { class: 'linkish', type: 'button', onclick: showRegister }, 'נרשמים כאן')));
    if (u) nick.hidden = true;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      err.textContent = '';
      busy(submit, true, 'נכנסים…');
      try { await store.login(nick.value, pw.value); sfx.good(); go('#/'); }
      catch (ex) { err.textContent = ex.message; pw.select(); sfx.bad(); busy(submit, false); }
    });
    box.replaceChildren(form);
    (u ? pw : nick).focus();
  }

  function showRegister() {
    let avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const err = h('p', { class: 'error', role: 'alert' });
    const nick = h('input', { id: 'nick', type: 'text', maxlength: 16, required: true, autocomplete: 'username',
      placeholder: 'למשל: נועה' });
    const pw = passwordInput('newpw', 'new-password');
    const avatars = h('div', { class: 'avatar-pick', role: 'radiogroup', 'aria-label': 'בחירת דמות' },
      AVATARS.map(a => {
        const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(a === avatar), class: a === avatar ? 'on' : '' }, a);
        b.addEventListener('click', () => {
          avatar = a;
          avatars.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
        });
        return b;
      }));
    const submit = h('button', { class: 'btn primary', type: 'submit' }, 'יוצאים לדרך! 🚀');
    const form = h('form', { class: 'form' },
      h('h2', {}, 'נרשמים בקלות'),
      h('label', { for: 'nick' }, 'כינוי (כך תיכנסו בפעם הבאה)'), nick,
      h('span', { class: 'label' }, 'בחרו דמות'), avatars,
      h('label', { for: 'newpw' }, 'סיסמה – לפחות 6 תווים'), pw,
      h('p', { class: 'hint small' }, 'שמרו את הכינוי והסיסמה – איתם אפשר להמשיך לשחק מכל מכשיר.'),
      err,
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => showLogin(null) }, 'כבר רשומים? כניסה'),
        submit));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      err.textContent = '';
      busy(submit, true, 'נרשמים…');
      try { await store.register(nick.value, avatar, pw.value); sfx.win(); confetti(60); go('#/'); }
      catch (ex) { err.textContent = ex.message; sfx.bad(); busy(submit, false); }
    });
    box.replaceChildren(form);
    nick.focus();
  }
}

// ---------------------------------------------------------------------------
function homeScreen(user) {
  const p = user.progress;
  const firstOpen = UNITS.findIndex((u, i) => store.unitUnlocked(p, i) && store.unitStars(p, u) < store.unitMaxStars(u));
  mount(topbar(user), h('main', { class: 'home' },
    h('h1', { tabindex: -1 }, `שלום ${user.nick}! `, h('span', { class: 'wave' }, '👋')),
    h('p', { class: 'lead' }, 'בחרו שלב במסלול. כל שלב נפתח כשאוספים חצי מהכוכבים בשלב שלפניו.'),
    !canSpeak && h('p', { class: 'warn' }, 'הדפדפן הזה לא יכול להשמיע קול – חלק מהמשחקים יעבדו בלי שמע.'),
    h('ol', { class: 'path' }, UNITS.map((u, i) => {
      const open = store.unitUnlocked(p, i);
      const stars = store.unitStars(p, u), max = store.unitMaxStars(u);
      const prev = UNITS[i - 1];
      const inner = [
        h('span', { class: 'unit-icon', 'aria-hidden': 'true' }, open ? u.icon : '🔒'),
        h('span', { class: 'unit-text' },
          h('span', { class: 'unit-num' }, `שלב ${i + 1}`),
          h('b', { class: 'unit-title' }, u.title),
          h('small', {}, open ? u.subtitle : `צריך ${store.unitNeeded(prev)} ⭐ ב"${prev.title}"`)),
        h('span', { class: 'unit-progress' },
          h('span', { class: 'meter' }, h('i', { style: { width: `${(stars / max) * 100}%` } })),
          h('small', {}, `${stars}/${max} ⭐`)),
      ];
      return h('li', { class: `unit ${open ? '' : 'locked'} ${i === firstOpen ? 'current' : ''}`, style: { '--c': u.color, '--i': i } },
        open ? h('a', { href: `#/unit/${u.id}` }, inner) : h('div', { 'aria-disabled': 'true' }, inner));
    }))));
}

// ---------------------------------------------------------------------------
function unitScreen(user, unitId) {
  const idx = UNITS.findIndex(u => u.id === unitId);
  const unit = UNITS[idx];
  if (!unit || !store.unitUnlocked(user.progress, idx)) return go('#/');
  const p = user.progress;
  mount(topbar(user, { back: '#/' }), h('main', { class: 'unit-page', style: { '--c': unit.color } },
    h('div', { class: 'unit-head' },
      h('span', { class: 'unit-icon big', 'aria-hidden': 'true' }, unit.icon),
      h('div', {}, h('h1', { tabindex: -1 }, unit.title), h('p', { class: 'lead' }, unit.subtitle)),
      h('span', { class: 'unit-total' }, `${store.unitStars(p, unit)}/${store.unitMaxStars(unit)} ⭐`)),
    h('div', { class: 'games' }, unit.games.map((g, k) => {
      const meta = GAMES[g];
      const best = p.stars[`${unit.id}/${g}`] || 0;
      return h('a', { class: 'game-card', href: `#/play/${unit.id}/${g}`, style: { '--k': k } },
        h('span', { class: 'game-icon', 'aria-hidden': 'true' }, meta.icon),
        h('span', { class: 'game-text' }, h('b', {}, meta.title), h('small', {}, meta.desc)),
        meta.bonus ? h('span', { class: 'badge' }, 'בונוס') : starsRow(best));
    }))));
}

// ---------------------------------------------------------------------------
function playScreen(user, unitId, gameId) {
  const idx = UNITS.findIndex(u => u.id === unitId);
  const unit = UNITS[idx];
  if (!unit || !unit.games.includes(gameId) || !store.unitUnlocked(user.progress, idx)) return go('#/');
  const meta = GAMES[gameId];
  const root = h('div', { class: 'game' });
  mount(topbar(user, { back: `#/unit/${unit.id}` }), h('main', { class: 'play', style: { '--c': unit.color } },
    h('h1', { class: 'play-title', tabindex: -1 }, h('span', { 'aria-hidden': 'true' }, meta.icon), ' ', meta.title,
      h('small', {}, ` · ${unit.title}`)),
    root));

  const key = `${unit.id}/${gameId}`;
  let finished = false, alive = true;
  cleanups.push(() => { alive = false; });
  const api = {
    // Delayed steps die with the screen, so leaving mid-answer doesn't leak into the next page.
    later: (fn, ms) => setTimeout(() => { if (alive) fn(); }, ms),
    seen: () => store.currentUser().progress.seen[unit.id] || [],
    alreadyCompleted: () => (store.currentUser().progress.stars[key] || 0) >= 3,
    markSeen(itemKey) {
      let fresh = [];
      const u = store.update(pr => {
        const list = pr.seen[unit.id] ||= [];
        if (!list.includes(itemKey)) { list.push(itemKey); pr.points += 2; }
        fresh = awardTrophies(pr);
      });
      refreshChips(u);
      announceTrophies(fresh);
    },
    onCleanup: fn => cleanups.push(fn),
    finish(res) {
      if (finished || !alive) return;
      finished = true;
      const before = UNITS.filter((_, i) => store.unitUnlocked(store.currentUser().progress, i)).length;
      const prevBest = store.currentUser().progress.stars[key] || 0;
      let fresh = [];
      const u = store.update(pr => {
        pr.stars[key] = Math.max(pr.stars[key] || 0, res.stars);
        pr.points += res.points;
        pr.stats.rounds++;
        if (!res.learn && !res.wrong && res.total) pr.stats.perfect++;
        pr.stats.correct += res.correct || 0;
        pr.stats.wrong += res.wrong || 0;
        pr.stats.bestStreak = Math.max(pr.stats.bestStreak, res.best || 0);
        pr.stats.traced += res.traced || 0;
        pr.stats.said += res.said || 0;
        fresh = awardTrophies(pr);
      });
      store.flush(); // save the round to the cloud right away
      const after = UNITS.filter((_, i) => store.unitUnlocked(u.progress, i)).length;
      showResults(user, unit, gameId, res, { fresh, newUnit: after > before ? UNITS[after - 1] : null, prevBest });
    },
  };
  runGame(gameId, root, unit, api);
}

function refreshChips(u) {
  const b = document.querySelector('.topbar .chip b');
  if (b && u) b.textContent = u.progress.points.toLocaleString('he-IL');
}

function announceTrophies(list) {
  list.forEach((t, k) => setTimeout(() => {
    sfx.win();
    toast(h('div', { class: 'toast-trophy' }, h('span', { class: 'big-emoji' }, t.icon),
      h('div', {}, h('b', {}, 'גביע חדש!'), h('div', {}, t.title))));
  }, 400 + k * 700));
  if (list.length) confetti(70);
}

function showResults(user, unit, gameId, res, { fresh, newUnit, prevBest }) {
  const games = unit.games;
  const nextGame = games[games.indexOf(gameId) + 1];
  const msg = res.stars === 3 ? 'מדהים!' : res.stars === 2 ? 'כל הכבוד!' : res.stars === 1 ? 'יפה, ממשיכים להתאמן!' : 'לא נורא – ננסה שוב?';
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'res-title' },
    h('div', { class: 'result sheet' },
      h('h2', { id: 'res-title', tabindex: -1 }, msg),
      starsRow(res.stars, 3, 'big animate'),
      res.learn ? h('p', {}, 'הכרתם את כל הכרטיסים בשלב הזה!')
        : h('p', { class: 'score-line' }, `עניתם נכון על ${res.correct} מתוך ${res.total}`),
      res.points > 0 && h('p', { class: 'points-won' }, h('bdi', { dir: 'ltr' }, `+${res.points}`), ' נקודות ⭐'),
      res.stars > prevBest && prevBest > 0 && h('p', { class: 'record' }, '🎖️ שיא אישי חדש!'),
      newUnit && h('p', { class: 'unlock' }, `🔓 נפתח שלב חדש: ${newUnit.title}`),
      fresh.length > 0 && h('div', { class: 'new-trophies' },
        h('b', {}, fresh.length > 1 ? 'גביעים חדשים:' : 'גביע חדש:'),
        fresh.map(t => h('span', { class: 'trophy-mini' }, h('span', {}, t.icon), t.title))),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', type: 'button', onclick: () => { overlay.remove(); render(); } }, '🔁 שוב'),
        nextGame && h('a', { class: 'btn primary', href: `#/play/${unit.id}/${nextGame}`, onclick: () => overlay.remove() },
          `הבא: ${GAMES[nextGame].title}`),
        h('a', { class: 'btn ghost', href: newUnit ? '#/' : `#/unit/${unit.id}`, onclick: () => overlay.remove() },
          newUnit ? 'למסלול' : 'לשלב'))));
  document.body.append(overlay);
  cleanups.push(() => overlay.remove());
  overlay.querySelector('h2').focus();
  if (res.stars >= 2 || fresh.length || newUnit) { sfx.win(); confetti(res.stars === 3 ? 110 : 60); }
  refreshChips(store.currentUser());
  if (fresh.length) setTimeout(() => announceTrophies(fresh), 600);
}

// ---------------------------------------------------------------------------
function trophiesScreen(user) {
  const p = user.progress;
  const got = TROPHIES.filter(t => p.trophies[t.id]).length;
  const board = h('section', { class: 'sheet board' }, h('h2', {}, 'טבלת האלופים'), h('p', { class: 'hint' }, 'טוענים…'));
  const s = p.stats;
  mount(topbar(user, { back: '#/' }), h('main', { class: 'trophies' },
    h('h1', { tabindex: -1 }, 'הגביעים שלי'),
    h('p', { class: 'lead' }, `אספת ${got} מתוך ${TROPHIES.length} גביעים`),
    h('ul', { class: 'trophy-grid' }, TROPHIES.map(t => {
      const when = p.trophies[t.id];
      return h('li', { class: `trophy ${when ? 'earned' : 'locked'}` },
        h('span', { class: 'trophy-icon', 'aria-hidden': 'true' }, when ? t.icon : '❔'),
        h('b', {}, t.title), h('small', {}, t.desc),
        when && h('time', { datetime: when }, new Date(when).toLocaleDateString('he-IL')));
    })),
    h('section', { class: 'sheet stats' },
      h('h2', {}, 'הסטטיסטיקה שלי'),
      h('dl', {},
        [['תשובות נכונות', s.correct], ['סבבים', s.rounds], ['הרצף הכי ארוך', s.bestStreak],
         ['אותיות שנכתבו', s.traced], ['מילים שלמדתי', store.wordsLearned(p)], ['ימים ברצף', store.dayStreak(p)]]
          .map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v))))),
    board));
  store.leaderboard().then(rows => {
    if (!board.isConnected) return;
    if (!rows) { board.replaceChildren(h('h2', {}, 'טבלת האלופים'), h('p', { class: 'hint' }, 'לא הצלחנו לטעון את הטבלה כרגע.')); return; }
    board.replaceChildren(h('h2', {}, 'טבלת האלופים'),
      h('ol', {}, rows.map(r => h('li', { class: r.uid === user.uid ? 'me' : '' },
        h('span', {}, r.avatar), h('b', {}, r.nick), h('span', {}, `⭐ ${r.points}`), h('span', {}, `🏆 ${r.trophies}`)))));
  });
}

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; // each screen starts at the top

async function start() {
  app.replaceChildren(h('div', { class: 'loading', role: 'status' }, brand(), h('p', {}, 'טוענים את המחברת…')));
  try {
    await store.init();
  } catch (err) {
    console.error(err);
    app.replaceChildren(h('main', { class: 'auth' }, h('div', { class: 'auth-box sheet' },
      h('h2', {}, 'לא הצלחנו להתחבר 😕'),
      h('p', {}, 'כדי לשמור את ההתקדמות צריך חיבור לאינטרנט. בדקו את החיבור ונסו שוב.'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => location.reload() }, 'נסו שוב')))));
    return;
  }
  window.addEventListener('hashchange', render);
  render();
}
start();
