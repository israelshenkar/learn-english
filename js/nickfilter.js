// Blocks offensive or inappropriate nicknames (Hebrew + English) when a new player registers.
// Client-side only, so a determined user could bypass it. It keeps honest kids from picking (or being dared
// into) a rude name that then shows up on the leaderboard. Login is never filtered, so existing accounts keep working.
//
// How matching works:
//   1. The nickname is normalized: Unicode accents and Hebrew niqqud removed, lower case, look-alike digits and
//      symbols mapped to letters (0→o, 1→i, 3→e, @→a, $→s …), and Hebrew final letters and common spelling swaps
//      folded together (ך→כ, ק→כ, ט→ת, ע→א, ש→ס …).
//   2. Every letter may repeat ("fuuuck", "זוונה"), and spaces, dots and other separators are ignored ("f.u c-k").
//   3. LONG words (unambiguous) are blocked anywhere inside the name. SHORT words, which hide inside innocent names
//      ("class", "Cassie", "מזין"), are blocked only as a whole word, optionally with one Hebrew prefix letter
//      (ה, ו, ב, ל) for Hebrew words.
//
// The words below are kept deliberately as plain data. Add to them in the same normalized spirit (no niqqud needed).

const ANYWHERE = [
  // English
  'fuck', 'fck', 'motherf', 'shit', 'bitch', 'cunt', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'pussy',
  'penis', 'vagina', 'porn', 'asshole', 'bastard', 'dildo', 'blowjob', 'handjob', 'boobs', 'retard', 'hitler',
  'nazi', 'sexy', 'horny', 'wanker', 'twat', 'jizz',
  // Hebrew in Latin letters
  'sharmuta', 'sharmota', 'benzona', 'kusemek', 'kusemak', 'kusamak', 'kusomo', 'manyak', 'lezayen', 'mizdayen',
  // Hebrew
  'זונה', 'זונות', 'שרמוטה', 'שרמוטא', 'מזדיין', 'מזדין', 'לזיין', 'זיון', 'כוסית', 'כוסאמק', 'כוסאמא', 'כוסומו',
  'מניאק', 'מנייאק', 'מטומטם', 'מטומטמת', 'מפגר', 'מפגרת', 'דביל', 'אידיוט', 'היטלר', 'נאצי', 'ערבוש', 'מוותל',
  'סקסי', 'פורנו', 'בולבול', 'ציצים',
];

const WHOLE_WORD = [
  // English
  'ass', 'dick', 'cock', 'cum', 'tit', 'tits', 'fag', 'anal', 'rape', 'sex', 'piss', 'kys', 'kkk', 'nude', 'boob',
  // Hebrew in Latin letters
  'zona', 'kus', 'zayin',
  // Hebrew
  'זין', 'כוס', 'תחת', 'חרא', 'כושי', 'סתום', 'סתומה', 'ציצי',
];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's', '!': 'i', '|': 'i', '+': 't', '€': 'e' };
const HEBREW_FOLD = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ', ק: 'כ', ט: 'ת', ע: 'א', ש: 'ס' };
const HEBREW_PREFIX = 'הובל';

function fold(text, leet) {
  return [...text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()]
    .map(ch => HEBREW_FOLD[ch] || (leet && LEET[ch]) || ch).join('');
}

// Turn a list word into a pattern where each letter may repeat: "boob" → b+o+o+b+ (so "bob" is NOT matched).
const letters = word => [...fold(word, false).replace(/\P{L}/gu, '')];
const pattern = word => letters(word).map(ch => `${ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}+`).join('');
const isHebrew = word => /[֐-׿]/.test(word);

const ANYWHERE_RE = new RegExp(ANYWHERE.map(pattern).join('|'), 'u');
const WHOLE_RE = new RegExp(`^(?:${WHOLE_WORD.map(w => (isHebrew(w) ? `[${HEBREW_PREFIX}]?` : '') + pattern(w)).join('|')})$`, 'u');

// Two readings of the name: digits/symbols as letters ("sh1t"), and digits/symbols as separators ("dick123").
function readings(nick) {
  return [true, false].map(leet => {
    const folded = fold(nick, leet);
    return { compact: folded.replace(/\P{L}/gu, ''), words: folded.split(/\P{L}+/u).filter(Boolean) };
  });
}

export function isNickAllowed(nick) {
  return !readings(String(nick || '')).some(({ compact, words }) =>
    ANYWHERE_RE.test(compact) || WHOLE_RE.test(compact) || words.some(w => WHOLE_RE.test(w)));
}

export const NICK_BLOCKED_MESSAGE = 'הכינוי הזה לא מתאים לאתר שלנו 🙂 בחרו כינוי אחר, נחמד יותר';
