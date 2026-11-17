import { EXTRA_WORD_UNITS, SENTENCE_UNIT, EXTRA_GAMES } from './data-extra.js';

// Course content. All Hebrew text is shown RTL; all English text is wrapped LTR in the UI.

// name = how the letter's NAME sounds (American English), written in Hebrew.
// sound = the letter's typical SOUND inside a word, with a tip where Hebrew has no exact match.
export const LETTERS = [
  { u: 'A', l: 'a', name: 'אֵיי',        sound: 'אֶ פתוחה, כמו ב-apple',            word: 'apple',    emoji: '🍎', he: 'תפוח' },
  { u: 'B', l: 'b', name: 'בִּי',         sound: 'בּ',                                 word: 'ball',     emoji: '⚽', he: 'כדור' },
  { u: 'C', l: 'c', name: 'סִי',          sound: 'ק (ולפעמים ס)',                      word: 'cat',      emoji: '🐱', he: 'חתול' },
  { u: 'D', l: 'd', name: 'דִּי',         sound: 'ד',                                  word: 'dog',      emoji: '🐶', he: 'כלב' },
  { u: 'E', l: 'e', name: 'אִי',          sound: 'אֶ קצרה, כמו ב-egg',                 word: 'egg',      emoji: '🥚', he: 'ביצה' },
  { u: 'F', l: 'f', name: 'אֶף',          sound: 'פ רפה (f)',                           word: 'fish',     emoji: '🐟', he: 'דג' },
  { u: 'G', l: 'g', name: "גִ'י",         sound: "ג (ולפעמים ג')",                     word: 'goat',     emoji: '🐐', he: 'עז' },
  { u: 'H', l: 'h', name: "אֵייץ'",       sound: 'ה (נשיפה קלה)',                      word: 'hat',      emoji: '🎩', he: 'כובע' },
  { u: 'I', l: 'i', name: 'אַיי',         sound: 'אִ קצרה, כמו ב-insect',               word: 'insect',   emoji: '🐞', he: 'חרק' },
  { u: 'J', l: 'j', name: "גֵ'יי",        sound: "ג'",                                  word: 'juice',    emoji: '🧃', he: 'מיץ' },
  { u: 'K', l: 'k', name: 'קֵיי',         sound: 'ק',                                  word: 'kite',     emoji: '🪁', he: 'עפיפון' },
  { u: 'L', l: 'l', name: 'אֶל',          sound: 'ל',                                  word: 'lion',     emoji: '🦁', he: 'אריה' },
  { u: 'M', l: 'm', name: 'אֶם',          sound: 'מ',                                  word: 'moon',     emoji: '🌙', he: 'ירח' },
  { u: 'N', l: 'n', name: 'אֶן',          sound: 'נ',                                  word: 'nose',     emoji: '👃', he: 'אף' },
  { u: 'O', l: 'o', name: 'אוֹ',          sound: 'אָ, כמו ב-octopus',                   word: 'octopus',  emoji: '🐙', he: 'תמנון' },
  { u: 'P', l: 'p', name: 'פִּי',         sound: 'פּ דגושה',                            word: 'pig',      emoji: '🐷', he: 'חזיר' },
  { u: 'Q', l: 'q', name: 'קְיוּ',        sound: 'קְוְ (כמעט תמיד בא עם u)',            word: 'queen',    emoji: '👑', he: 'מלכה' },
  { u: 'R', l: 'r', name: 'אָר',          sound: 'ר אנגלית: הלשון לא נוגעת בחך',       word: 'rabbit',   emoji: '🐰', he: 'ארנב' },
  { u: 'S', l: 's', name: 'אֶס',          sound: 'ס',                                  word: 'sun',      emoji: '☀️', he: 'שמש' },
  { u: 'T', l: 't', name: 'טִי',          sound: 'ט / ת',                              word: 'tree',     emoji: '🌳', he: 'עץ' },
  { u: 'U', l: 'u', name: 'יוּ',          sound: 'אַ, כמו ב-umbrella',                  word: 'umbrella', emoji: '☂️', he: 'מטרייה' },
  { u: 'V', l: 'v', name: 'וִי',          sound: 'ו (שיניים על השפה התחתונה)',         word: 'violin',   emoji: '🎻', he: 'כינור' },
  { u: 'W', l: 'w', name: 'דַּאבֶּל-יוּ', sound: 'וּ קצרה עם שפתיים עגולות',            word: 'watermelon', emoji: '🍉', he: 'אבטיח' },
  { u: 'X', l: 'x', name: 'אֶקְס',        sound: 'קְס, כמו בסוף של fox',                word: 'fox',      emoji: '🦊', he: 'שועל' },
  { u: 'Y', l: 'y', name: 'וַאי',         sound: 'י, כמו ב-yo-yo',                      word: 'yo-yo',    emoji: '🪀', he: 'יו-יו' },
  { u: 'Z', l: 'z', name: 'זִי',          sound: 'ז',                                  word: 'zebra',    emoji: '🦓', he: 'זברה' },
];

// Short, regular words for first reading (consonant-vowel-consonant).
export const CVC = [
  { en: 'cat', he: 'חתול', emoji: '🐱' },
  { en: 'dog', he: 'כלב', emoji: '🐶' },
  { en: 'sun', he: 'שמש', emoji: '☀️' },
  { en: 'pig', he: 'חזיר', emoji: '🐷' },
  { en: 'hat', he: 'כובע', emoji: '🎩' },
  { en: 'bus', he: 'אוטובוס', emoji: '🚌' },
  { en: 'cup', he: 'כוס', emoji: '☕' },
  { en: 'bed', he: 'מיטה', emoji: '🛏️' },
  { en: 'fox', he: 'שועל', emoji: '🦊' },
  { en: 'box', he: 'קופסה', emoji: '📦' },
  { en: 'hen', he: 'תרנגולת', emoji: '🐔' },
  { en: 'map', he: 'מפה', emoji: '🗺️' },
  { en: 'pen', he: 'עט', emoji: '🖊️' },
  { en: 'bag', he: 'תיק', emoji: '👜' },
  { en: 'red', he: 'אדום', emoji: '🔴' },
  { en: 'ten', he: 'עשר', emoji: '🔟' },
];

// Real words that look/sound close to the CVC words – used as tricky distractors in reading games.
export const LOOKALIKES = [
  'bat', 'rat', 'mat', 'sat', 'hot', 'log', 'dig', 'fog', 'bun', 'run', 'fun', 'big', 'wig',
  'cap', 'pup', 'bud', 'bad', 'fix', 'six', 'men', 'hen', 'tap', 'pan', 'bag', 'beg', 'rag',
  'leg', 'peg', 'pet', 'net', 'tan', 'cut', 'hut', 'nut', 'sit', 'hit', 'pit', 'fan', 'can',
];

export const WORD_UNITS = [
  {
    id: 'greetings', title: 'שלום ונימוסים', icon: '👋', color: '#ff9f43',
    words: [
      { en: 'hello', he: 'שלום', emoji: '👋', alt: ['hallo'] },
      { en: 'goodbye', he: 'להתראות', emoji: '🚶', alt: ['good bye', 'bye'] },
      { en: 'yes', he: 'כן', emoji: '👍' },
      { en: 'no', he: 'לא', emoji: '👎', alt: ['know'] },
      { en: 'please', he: 'בבקשה', emoji: '🙏' },
      { en: 'thanks', he: 'תודה', emoji: '💐', alt: ['thank you'] },
      { en: 'sorry', he: 'סליחה', emoji: '😔' },
      { en: 'good morning', he: 'בוקר טוב', emoji: '🌅' },
      { en: 'good night', he: 'לילה טוב', emoji: '🌙' },
      { en: 'friend', he: 'חבר', emoji: '🤝' },
    ],
  },
  {
    id: 'numbers', title: 'מספרים', icon: '🔢', color: '#4aa3df',
    words: [
      { en: 'one', he: 'אחת', emoji: '1', alt: ['1', 'won'] },
      { en: 'two', he: 'שתיים', emoji: '2', alt: ['2', 'to', 'too'] },
      { en: 'three', he: 'שלוש', emoji: '3', alt: ['3'] },
      { en: 'four', he: 'ארבע', emoji: '4', alt: ['4', 'for'] },
      { en: 'five', he: 'חמש', emoji: '5', alt: ['5'] },
      { en: 'six', he: 'שש', emoji: '6', alt: ['6'] },
      { en: 'seven', he: 'שבע', emoji: '7', alt: ['7'] },
      { en: 'eight', he: 'שמונה', emoji: '8', alt: ['8', 'ate'] },
      { en: 'nine', he: 'תשע', emoji: '9', alt: ['9'] },
      { en: 'ten', he: 'עשר', emoji: '10', alt: ['10'] },
    ],
  },
  {
    id: 'colors', title: 'צבעים', icon: '🎨', color: '#e2554b',
    words: [
      { en: 'red', he: 'אדום', emoji: '🔴' },
      { en: 'blue', he: 'כחול', emoji: '🔵' },
      { en: 'green', he: 'ירוק', emoji: '🟢' },
      { en: 'yellow', he: 'צהוב', emoji: '🟡' },
      { en: 'orange', he: 'כתום', emoji: '🟠' },
      { en: 'purple', he: 'סגול', emoji: '🟣' },
      { en: 'pink', he: 'ורוד', emoji: '🩷' },
      { en: 'brown', he: 'חום', emoji: '🟤' },
      { en: 'black', he: 'שחור', emoji: '⚫' },
      { en: 'white', he: 'לבן', emoji: '⚪' },
    ],
  },
  {
    id: 'family', title: 'משפחה', icon: '👨‍👩‍👧', color: '#ef6fa4',
    words: [
      { en: 'mom', he: 'אמא', emoji: '👩', alt: ['mum', 'mama'] },
      { en: 'dad', he: 'אבא', emoji: '👨' },
      { en: 'baby', he: 'תינוק', emoji: '👶' },
      { en: 'brother', he: 'אח', emoji: '👦' },
      { en: 'sister', he: 'אחות', emoji: '👧' },
      { en: 'grandma', he: 'סבתא', emoji: '👵' },
      { en: 'grandpa', he: 'סבא', emoji: '👴' },
      { en: 'family', he: 'משפחה', emoji: '👨‍👩‍👧' },
    ],
  },
  {
    id: 'food', title: 'אוכל ושתייה', icon: '🍞', color: '#f2b705',
    words: [
      { en: 'bread', he: 'לחם', emoji: '🍞' },
      { en: 'milk', he: 'חלב', emoji: '🥛' },
      { en: 'water', he: 'מים', emoji: '💧' },
      { en: 'apple', he: 'תפוח', emoji: '🍎' },
      { en: 'banana', he: 'בננה', emoji: '🍌' },
      { en: 'egg', he: 'ביצה', emoji: '🥚' },
      { en: 'cheese', he: 'גבינה', emoji: '🧀' },
      { en: 'rice', he: 'אורז', emoji: '🍚' },
      { en: 'cake', he: 'עוגה', emoji: '🍰' },
      { en: 'juice', he: 'מיץ', emoji: '🧃' },
    ],
  },
  {
    id: 'animals', title: 'בעלי חיים', icon: '🦁', color: '#2bb673',
    words: [
      { en: 'cat', he: 'חתול', emoji: '🐱' },
      { en: 'dog', he: 'כלב', emoji: '🐶' },
      { en: 'bird', he: 'ציפור', emoji: '🐦' },
      { en: 'fish', he: 'דג', emoji: '🐟' },
      { en: 'horse', he: 'סוס', emoji: '🐴' },
      { en: 'cow', he: 'פרה', emoji: '🐮' },
      { en: 'lion', he: 'אריה', emoji: '🦁' },
      { en: 'monkey', he: 'קוף', emoji: '🐵' },
      { en: 'duck', he: 'ברווז', emoji: '🦆' },
      { en: 'mouse', he: 'עכבר', emoji: '🐭' },
    ],
  },
  {
    id: 'body', title: 'הגוף שלי', icon: '✋', color: '#9b6bd6',
    words: [
      { en: 'eye', he: 'עין', emoji: '👁️', alt: ['i', 'aye'] },
      { en: 'ear', he: 'אוזן', emoji: '👂' },
      { en: 'nose', he: 'אף', emoji: '👃' },
      { en: 'mouth', he: 'פה', emoji: '👄' },
      { en: 'hand', he: 'יד', emoji: '✋' },
      { en: 'foot', he: 'כף רגל', emoji: '🦶' },
      { en: 'leg', he: 'רגל', emoji: '🦵' },
      { en: 'tooth', he: 'שן', emoji: '🦷' },
    ],
  },
  {
    id: 'home', title: 'בבית', icon: '🏠', color: '#1fa6a0',
    words: [
      { en: 'house', he: 'בית', emoji: '🏠' },
      { en: 'door', he: 'דלת', emoji: '🚪' },
      { en: 'window', he: 'חלון', emoji: '🪟' },
      { en: 'bed', he: 'מיטה', emoji: '🛏️' },
      { en: 'chair', he: 'כיסא', emoji: '🪑' },
      { en: 'book', he: 'ספר', emoji: '📖' },
      { en: 'phone', he: 'טלפון', emoji: '📱' },
      { en: 'key', he: 'מפתח', emoji: '🔑' },
      { en: 'clock', he: 'שעון', emoji: '⏰' },
    ],
  },
  {
    id: 'actions', title: 'מה עושים?', icon: '🏃', color: '#d9772b',
    words: [
      { en: 'eat', he: 'לאכול', emoji: '🍽️' },
      { en: 'drink', he: 'לשתות', emoji: '🥤' },
      { en: 'sleep', he: 'לישון', emoji: '😴' },
      { en: 'run', he: 'לרוץ', emoji: '🏃' },
      { en: 'walk', he: 'ללכת', emoji: '🚶' },
      { en: 'read', he: 'לקרוא', emoji: '📚', alt: ['reed'] },
      { en: 'write', he: 'לכתוב', emoji: '✍️', alt: ['right'] },
      { en: 'play', he: 'לשחק', emoji: '⚽' },
      { en: 'swim', he: 'לשחות', emoji: '🏊' },
    ],
  },
];

// Game catalogue. `bonus` games don't count toward unlocking the next unit.
export const GAMES = {
  learn:  { title: 'לומדים',            icon: '👀', desc: 'מכירים, מקשיבים וחוזרים' },
  listen: { title: 'שומעים ובוחרים',    icon: '👂', desc: 'מקשיבים ובוחרים את התשובה' },
  memory: { title: 'זוגות: גדולה וקטנה', icon: '🃏', desc: 'מוצאים אות גדולה ואת הקטנה שלה' },
  trace:  { title: 'כותבים',            icon: '✏️', desc: 'עוקבים באצבע אחרי האות' },
  read:   { title: 'קוראים ובוחרים',    icon: '🔎', desc: 'קוראים מילה ובוחרים תמונה' },
  sounds: { title: 'שומעים וקוראים',     icon: '🎧', desc: 'שומעים מילה ומוצאים איך כותבים אותה' },
  pick:   { title: 'מה זה באנגלית?',     icon: '🎯', desc: 'רואים תמונה ובוחרים מילה' },
  spell:  { title: 'מאייתים',           icon: '🧩', desc: 'בונים את המילה מאותיות' },
  say:    { title: 'אומרים בקול',        icon: '🎤', desc: 'אומרים את המילה למיקרופון', bonus: true },
  warmup: { title: 'חימום אותיות',      icon: '🔤', desc: 'אותיות שלא מופיעות במילים של השלב', bonus: true },
  ...EXTRA_GAMES,
};

export const UNITS = [
  { id: 'letters', title: 'האותיות', subtitle: 'מזהים, שומעים וכותבים את ה-ABC', icon: '🔤', color: '#4aa3df',
    kind: 'letters', games: ['learn', 'listen', 'memory', 'trace', 'order'] },
  { id: 'reading', title: 'קריאה ראשונה', subtitle: 'מחברים אותיות למילים קצרות', icon: '📖', color: '#2bb673',
    kind: 'reading', items: CVC, games: ['learn', 'read', 'sounds', 'spell'] },
  ...[...WORD_UNITS, ...EXTRA_WORD_UNITS].map(u => ({ ...u, subtitle: 'מילים יומיומיות', kind: 'words', items: u.words,
    games: u.games || ['learn', 'pick', 'listen', 'spell', 'say'] })),
  SENTENCE_UNIT,
// Every stage after the ABC opens with a bonus letters warm-up on the letters its words don't use (js/abc.js).
].map(u => (u.kind === 'letters' ? u : { ...u, games: ['warmup', ...u.games] }));

// Free avatars. The first FIRST_AVATARS show up front in the sign-up picker; the rest fold out.
// Single-codepoint emoji only (the leaderboard and group rows keep the avatar as one short string).
export const FIRST_AVATARS = 12;
export const AVATARS = [
  '🦊', '🐼', '🐸', '🦁', '🐯', '🐨', '🐵', '🦄', '🐙', '🐢', '🦉', '🐳',
  '🐮', '🐷', '🐹', '🐭', '🐔', '🐤', '🦆', '🦜', '🦚', '🦢', '🐺', '🦝',
  '🐴', '🦓', '🦒', '🐘', '🦛', '🦘', '🦦', '🦥', '🦀', '🐠', '🐊', '🦕',
];
