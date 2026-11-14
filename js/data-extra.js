// Extra course content: more word units and the short-sentences unit.
// Item keys are stable (the English word / sentence as written here) – don't rename them.

// Same shape as WORD_UNITS in data.js. `games` overrides the default word-unit game list.
export const EXTRA_WORD_UNITS = [
  {
    id: 'clothes', title: 'בגדים', icon: '👕', color: '#5b8def',
    words: [
      { en: 'shirt', he: 'חולצה', emoji: '👕' },
      { en: 'pants', he: 'מכנסיים', emoji: '👖' },
      { en: 'dress', he: 'שמלה', emoji: '👗' },
      { en: 'shorts', he: 'מכנסיים קצרים', emoji: '🩳' },
      { en: 'shoes', he: 'נעליים', emoji: '👟' },
      { en: 'socks', he: 'גרביים', emoji: '🧦' },
      { en: 'coat', he: 'מעיל', emoji: '🧥' },
      { en: 'hat', he: 'כובע', emoji: '👒' },
      { en: 'gloves', he: 'כפפות', emoji: '🧤' },
      { en: 'scarf', he: 'צעיף', emoji: '🧣' },
    ],
  },
  {
    id: 'weather', title: 'מזג האוויר', icon: '🌦️', color: '#3fa7c9',
    words: [
      { en: 'sun', he: 'שמש', emoji: '☀️' },
      { en: 'rain', he: 'גשם', emoji: '🌧️' },
      { en: 'cloud', he: 'ענן', emoji: '☁️' },
      { en: 'wind', he: 'רוח', emoji: '🌬️' },
      { en: 'snow', he: 'שלג', emoji: '❄️' },
      { en: 'storm', he: 'סערה', emoji: '⛈️' },
      { en: 'rainbow', he: 'קשת בענן', emoji: '🌈' },
      { en: 'hot', he: 'חם', emoji: '🥵' },
      { en: 'cold', he: 'קר', emoji: '🥶' },
    ],
  },
  {
    id: 'school', title: 'בבית הספר', icon: '🏫', color: '#c0713a',
    words: [
      { en: 'school', he: 'בית ספר', emoji: '🏫' },
      { en: 'teacher', he: 'מורה', emoji: '🧑‍🏫' },
      { en: 'pencil', he: 'עיפרון', emoji: '✏️' },
      { en: 'notebook', he: 'מחברת', emoji: '📓' },
      { en: 'backpack', he: 'ילקוט', emoji: '🎒', alt: ['back pack'] },
      { en: 'ruler', he: 'סרגל', emoji: '📏' },
      { en: 'scissors', he: 'מספריים', emoji: '✂️' },
      { en: 'crayon', he: 'צבע שעווה', emoji: '🖍️' },
      { en: 'computer', he: 'מחשב', emoji: '💻' },
    ],
  },
  {
    // Number emoji = the Hebrew day number (יום ראשון = 1).
    id: 'days', title: 'ימי השבוע', icon: '📅', color: '#8a6fd1', ordered: true,
    games: ['learn', 'pick', 'listen', 'order', 'say'],
    words: [
      { en: 'Sunday', he: 'יום ראשון', emoji: '1️⃣' },
      { en: 'Monday', he: 'יום שני', emoji: '2️⃣' },
      { en: 'Tuesday', he: 'יום שלישי', emoji: '3️⃣' },
      { en: 'Wednesday', he: 'יום רביעי', emoji: '4️⃣' },
      { en: 'Thursday', he: 'יום חמישי', emoji: '5️⃣' },
      { en: 'Friday', he: 'יום שישי', emoji: '6️⃣' },
      { en: 'Saturday', he: 'יום שבת', emoji: '7️⃣' },
    ],
  },
  {
    id: 'months', title: 'חודשי השנה', icon: '🗓️', color: '#d4569b', ordered: true,
    games: ['learn', 'pick', 'listen', 'order', 'say'],
    words: [
      { en: 'January', he: 'ינואר', emoji: '⛄' },
      { en: 'February', he: 'פברואר', emoji: '🎭' },
      { en: 'March', he: 'מרץ', emoji: '🌸' },
      { en: 'April', he: 'אפריל', emoji: '🌱' },
      { en: 'May', he: 'מאי', emoji: '🌼' },
      { en: 'June', he: 'יוני', emoji: '🍉' },
      { en: 'July', he: 'יולי', emoji: '🏖️' },
      { en: 'August', he: 'אוגוסט', emoji: '🍦' },
      { en: 'September', he: 'ספטמבר', emoji: '🍯' },
      { en: 'October', he: 'אוקטובר', emoji: '🍂' },
      { en: 'November', he: 'נובמבר', emoji: '🌧️' },
      { en: 'December', he: 'דצמבר', emoji: '🕎' },
    ],
  },
  {
    id: 'feelings', title: 'רגשות', icon: '😊', color: '#e8a317',
    words: [
      { en: 'happy', he: 'שמח/ה', emoji: '😀' },
      { en: 'sad', he: 'עצוב/ה', emoji: '😢' },
      { en: 'angry', he: 'כועס/ת', emoji: '😠' },
      { en: 'scared', he: 'מפוחד/ת', emoji: '😨' },
      { en: 'tired', he: 'עייף/ה', emoji: '🥱' },
      { en: 'surprised', he: 'מופתע/ת', emoji: '😲' },
      { en: 'hungry', he: 'רעב/ה', emoji: '🤤' },
      { en: 'sick', he: 'חולה', emoji: '🤒' },
      { en: 'bored', he: 'משועמם/ת', emoji: '😑', alt: ['board'] },
    ],
  },
];

// Tiny sentences built from words taught earlier. `en` has no final period – the UI adds it,
// so the item key stays a plain phrase. Every picture (emoji string) is unique.
export const SENTENCES = [
  { en: 'The cat is red', he: 'החתול אדום.', emoji: '🐱🔴' },
  { en: 'The cat is black', he: 'החתול שחור.', emoji: '🐈‍⬛' },
  { en: 'The dog is brown', he: 'הכלב חום.', emoji: '🐕🟤' },
  { en: 'The sun is yellow', he: 'השמש צהובה.', emoji: '☀️🟡' },
  { en: 'I have a dog', he: 'יש לי כלב.', emoji: '🧒🐶' },
  { en: 'I have a fish', he: 'יש לי דג.', emoji: '🧒🐟' },
  { en: 'I have two cats', he: 'יש לי שני חתולים.', emoji: '🧒🐱🐱' },
  { en: 'This is my mom', he: 'זאת אמא שלי.', emoji: '👩' },
  { en: 'This is my dad', he: 'זה אבא שלי.', emoji: '👨' },
  { en: 'This is my sister', he: 'זאת אחות שלי.', emoji: '👧' },
  { en: 'I eat bread', he: 'אני אוכל/ת לחם.', emoji: '😋🍞' },
  { en: 'I drink milk', he: 'אני שותה חלב.', emoji: '🥛' },
  { en: 'I can swim', he: 'אני יודע/ת לשחות.', emoji: '🏊' },
  { en: 'I can run', he: 'אני יודע/ת לרוץ.', emoji: '🏃' },
  { en: 'I see a bird', he: 'אני רואה ציפור.', emoji: '👀🐦' },
  { en: 'I am happy', he: 'אני שמח/ה.', emoji: '😀' },
];

export const SENTENCE_UNIT = {
  id: 'sentences', title: 'משפטים קצרים', subtitle: 'קוראים ובונים משפטים ראשונים', icon: '💬', color: '#2f9e8f',
  kind: 'sentences', items: SENTENCES, games: ['learn', 'sentpic', 'listen', 'build'],
};

export const EXTRA_GAMES = {
  order:   { title: 'לפי הסדר',         icon: '🪜', desc: 'מה בא קודם ומה אחר כך?' },
  sentpic: { title: 'קוראים משפט',      icon: '🖼️', desc: 'קוראים משפט ובוחרים תמונה' },
  build:   { title: 'בונים משפט',       icon: '🧱', desc: 'מסדרים מילים למשפט' },
};
