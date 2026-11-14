// "דוח להורים" – a printable progress report for the signed-in player (route #/progress).
import { h, en } from './ui.js';
import { overview, STATUS_HE } from './report.js';

const fmtDate = iso => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '—');
const minutesText = m => (m < 1 ? 'פחות מדקה' : m === 1 ? 'דקה אחת' : `${m} דקות`);

function tile(label, value, note) {
  return h('div', { class: 'rp-tile' }, h('span', { class: 'rp-tile-label' }, label), h('b', {}, value), note && h('small', {}, note));
}

// 14 bars: rounds per day. Days we only know were "played" (before the per-day log) get a short hatched bar.
function activityChart(days) {
  const max = Math.max(3, ...days.map(d => d.rounds));
  const bars = days.map(d => {
    const label = `${d.weekday} ${d.dayNum}/${d.month}: ` + (d.rounds ? `${d.rounds} סבבים, ${minutesText(Math.round(d.secs / 60))}`
      : d.played ? 'נכנס/ה לאתר (אין פירוט)' : 'לא שיחק/ה');
    const height = d.rounds ? Math.max(6, (d.rounds / max) * 100) : d.played ? 6 : 0;
    return h('li', { class: `rp-bar ${d.rounds ? '' : d.played ? 'only-played' : 'idle'}`, title: label, tabindex: 0, 'aria-label': label },
      h('span', { class: 'rp-bar-val' }, d.rounds || ''),
      h('span', { class: 'rp-bar-col' }, h('i', { style: { height: `${height}%` } })),
      h('span', { class: 'rp-bar-day' }, d.weekday, h('br'), d.dayNum, h('span', { class: 'rp-bar-month' }, `/${d.month}`)));
  });
  return h('figure', { class: 'rp-chart' },
    h('figcaption', {}, 'סבבי משחק בכל יום – 14 הימים האחרונים'),
    h('ol', { class: 'rp-bars' }, bars),
    days.some(d => d.played && !d.detailed) && h('p', { class: 'hint small' },
      'עמודה נמוכה ומקווקוות = יום שבו נכנסו לאתר לפני שהתחלנו לרשום פירוט יומי.'));
}

export function progressScreen(user, { mount, topbar }) {
  const p = user.progress;
  const o = overview(p);
  const today = new Date().toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

  const unitsTable = h('div', { class: 'rp-scroll' }, h('table', { class: 'rp-table' },
    h('thead', {}, h('tr', {},
      h('th', { scope: 'col' }, 'שלב'), h('th', { scope: 'col' }, 'כוכבים'), h('th', { scope: 'col' }, 'מצב'),
      h('th', { scope: 'col' }, 'פריטים שנלמדו'), o.hasItems && h('th', { scope: 'col' }, 'נשלטו'))),
    h('tbody', {}, o.units.map(r => h('tr', { class: `st-${r.status}` },
      h('th', { scope: 'row' }, h('span', { 'aria-hidden': 'true' }, r.unit.icon), ' ', `${r.index + 1}. ${r.unit.title}`),
      h('td', {}, h('span', { class: 'rp-meter', 'aria-hidden': 'true' }, h('i', { style: { width: `${(r.stars / r.max) * 100}%` } })),
        ` ${r.stars}/${r.max}`),
      h('td', {}, STATUS_HE[r.status]),
      h('td', {}, `${r.seen}/${r.total}`),
      o.hasItems && h('td', {}, r.mastered ?? 0))))));

  const weak = o.weak.length
    ? h('ul', { class: 'rp-weak' }, o.weak.map(w => w.kind === 'item'
      ? h('li', {}, w.label.emoji && h('span', { 'aria-hidden': 'true' }, `${w.label.emoji} `), en(w.label.en), w.label.he && ` (${w.label.he})`,
        h('small', {}, ` · ${w.unit.title} · ${w.wrong} טעויות, ${w.right} נכונות`))
      : h('li', {}, `${w.unit.icon} ${w.unit.title} – "${w.game.title}"`,
        h('small', {}, ` · התוצאה הטובה ביותר: ${w.stars} מתוך 3 כוכבים`))))
    : h('p', {}, 'לא נמצאו נקודות חולשה בולטות. כל הכבוד! 🎉');

  mount(topbar(user, { back: '#/trophies' }), h('main', { class: 'report' },
    h('div', { class: 'rp-head' },
      h('div', {},
        h('h1', { tabindex: -1 }, `דוח התקדמות – ${user.nick} `, h('span', { 'aria-hidden': 'true' }, user.avatar)),
        h('p', { class: 'lead' }, `המחברת האנגלית · הופק ב-${today}`)),
      h('div', { class: 'rp-actions no-print' },
        h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, '🖨️ הדפסה'),
        h('a', { class: 'btn ghost', href: '#/groups' }, '👨‍👩‍👧 קבוצות'))),

    h('section', { class: 'sheet rp-section' },
      h('h2', {}, 'במבט מהיר'),
      h('div', { class: 'rp-tiles' },
        tile('ימי פעילות (14 יום)', `${o.activeDays14}/14`),
        tile('סבבים (14 יום)', o.rounds14),
        tile('זמן משחק משוער (14 יום)', minutesText(o.minutes14), 'לפי משך הסבבים'),
        tile('דיוק בתשובות', o.accuracy14 != null ? `${o.accuracy14}%` : o.accuracyAll != null ? `${o.accuracyAll}%` : '—',
          o.accuracy14 != null ? '14 הימים האחרונים' : 'מאז ההתחלה'),
        tile('ימים ברצף', o.streak),
        tile('נקודות', p.points.toLocaleString('he-IL')),
        tile('פעילות אחרונה', fmtDate(o.lastActive)))),

    h('section', { class: 'sheet rp-section' }, h('h2', {}, 'פעילות יומית'), activityChart(o.days)),

    h('section', { class: 'sheet rp-section' },
      h('h2', {}, 'אותיות ומילים'),
      h('div', { class: 'rp-tiles' },
        tile('אותיות שהוכרו', `${o.lettersSeen}/${o.lettersTotal}`),
        o.hasItems && tile('אותיות שנשלטו', `${o.lettersMastered ?? 0}/${o.lettersTotal}`),
        tile('מילים שנלמדו', `${o.wordsSeen}/${o.wordsTotal}`),
        o.hasItems && tile('מילים שנשלטו', `${o.wordsMastered}/${o.wordsTotal}`),
        tile('שלבים שהושלמו', `${o.unitsDone}/${o.units.length}`, 'כוכב אחד לפחות בכל משחק')),
      h('p', { class: 'hint small' }, o.hasItems
        ? '"נלמדו" = נצפו בכרטיסי הלמידה. "נשלטו" = הצליחו בכל סוגי התרגול של אותו פריט (זיהוי, כתיבה, איות, דיבור).'
        : '"נלמדו" = נצפו בכרטיסי הלמידה. השליטה בכל שלב נמדדת לפי הכוכבים בטבלה למטה.')),

    h('section', { class: 'sheet rp-section' }, h('h2', {}, 'התקדמות לפי שלבים'), unitsTable),

    h('section', { class: 'sheet rp-section' },
      h('h2', {}, 'כדאי לחזק'),
      weak,
      h('p', { class: 'hint small' }, 'טיפ: עדיף 10 דקות כל יום מאשר שעה פעם בשבוע. אפשר לחזור על משחק כמה פעמים – נשמרת התוצאה הטובה ביותר.')),

    h('p', { class: 'hint small rp-foot' }, 'זמן המשחק מחושב לפי משך כל סבב (עד 15 דקות לסבב), ולכן הוא הערכה בלבד.')));
}
