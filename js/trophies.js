import { UNITS } from './data.js';
import { dayStreak, unitUnlocked, wordsLearned, countedGames } from './store.js';

const reading = UNITS.find(u => u.id === 'reading');

export const TROPHIES = [
  { id: 'first',    icon: '🌱', title: 'צעד ראשון',      desc: 'סיום הסבב הראשון',                 test: p => p.stats.rounds >= 1 },
  { id: 'abc',      icon: '🔤', title: 'מכירים את ה-ABC', desc: 'צפייה בכל 26 האותיות',             test: p => (p.seen.letters?.length || 0) >= 26 },
  { id: 'ear',      icon: '👂', title: 'אוזן חדה',        desc: '3 כוכבים ב"שומעים ובוחרים" של האותיות', test: p => (p.stars['letters/listen'] || 0) >= 3 },
  { id: 'memory',   icon: '🧠', title: 'זיכרון של פיל',   desc: '3 כוכבים במשחק הזוגות',            test: p => (p.stars['letters/memory'] || 0) >= 3 },
  { id: 'writer',   icon: '✍️', title: 'יד של סופר',      desc: 'כתיבה של 20 אותיות',               test: p => p.stats.traced >= 20 },
  { id: 'perfect',  icon: '💯', title: 'מושלם!',          desc: 'סבב שלם בלי אף טעות',              test: p => p.stats.perfect >= 1 },
  { id: 'streak10', icon: '🔥', title: 'על הגל',          desc: '10 תשובות נכונות ברצף',           test: p => p.stats.bestStreak >= 10 },
  { id: 'reader',   icon: '📖', title: 'קורא/ת ראשון/ה',  desc: 'כוכב בכל משחקי "קריאה ראשונה"',    test: p => countedGames(reading).every(g => (p.stars[`reading/${g}`] || 0) >= 1) },
  { id: 'words25',  icon: '📚', title: 'אספן מילים',      desc: 'למידה של 25 מילים',               test: p => wordsLearned(p) >= 25 },
  { id: 'words60',  icon: '🗃️', title: 'מילון מהלך',      desc: 'למידה של 60 מילים',               test: p => wordsLearned(p) >= 60 },
  { id: 'speaker',  icon: '🎤', title: 'מדברים אנגלית',   desc: '10 מילים שנאמרו נכון בקול',        test: p => p.stats.said >= 10 },
  { id: 'p100',     icon: '⭐', title: '100 נקודות',       desc: 'צבירה של 100 נקודות',             test: p => p.points >= 100 },
  { id: 'p500',     icon: '🌟', title: '500 נקודות',       desc: 'צבירה של 500 נקודות',             test: p => p.points >= 500 },
  { id: 'p1500',    icon: '🏅', title: '1,500 נקודות',     desc: 'צבירה של 1,500 נקודות',           test: p => p.points >= 1500 },
  { id: 'p4000',    icon: '🏆', title: '4,000 נקודות',     desc: 'צבירה של 4,000 נקודות',           test: p => p.points >= 4000 },
  { id: 'goal1',    icon: '🎯', title: 'פגיעה במטרה',     desc: 'עמידה ביעד היומי בפעם הראשונה',   test: p => (p.stats.goals || 0) >= 1 },
  { id: 'days3',    icon: '📅', title: '3 ימים ברצף',      desc: 'עמידה ביעד היומי 3 ימים רצופים',   test: p => dayStreak(p) >= 3 },
  { id: 'days7',    icon: '🗓️', title: 'שבוע שלם',        desc: 'עמידה ביעד היומי 7 ימים רצופים',   test: p => dayStreak(p) >= 7 },
  { id: 'days30',   icon: '🌙', title: 'חודש של התמדה',   desc: 'עמידה ביעד היומי 30 ימים רצופים',  test: p => dayStreak(p) >= 30 },
  { id: 'shopper',  icon: '🛍️', title: 'קנייה ראשונה',    desc: 'קנייה ראשונה בחנות',              test: p => (p.owned?.length || 0) >= 1 || (p.freezes || 0) >= 1 },
  { id: 'explorer', icon: '🗺️', title: 'מגלי עולמות',     desc: 'פתיחת כל השלבים',                 test: p => unitUnlocked(p, UNITS.length - 1) },
  { id: 'master',   icon: '👑', title: 'אלופי האנגלית',   desc: '3 כוכבים בכל המשחקים',            test: p => UNITS.every(u => countedGames(u).every(g => (p.stars[`${u.id}/${g}`] || 0) >= 3)) },
];

// Returns trophies newly earned (and records them on p).
export function awardTrophies(p) {
  const fresh = [];
  for (const t of TROPHIES) {
    if (!p.trophies[t.id] && t.test(p)) {
      p.trophies[t.id] = new Date().toISOString();
      fresh.push(t);
    }
  }
  return fresh;
}
