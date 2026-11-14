// Text-to-speech (English voice) and optional speech recognition.
let voice = null;
const synth = globalThis.speechSynthesis;

function pickVoice() {
  if (!synth) return;
  const vs = synth.getVoices();
  const en = vs.filter(v => /^en[-_]/i.test(v.lang));
  voice =
    en.find(v => /en[-_]US/i.test(v.lang) && /(Samantha|Google US|Aria|Jenny|Ava|Allison)/i.test(v.name)) ||
    en.find(v => /en[-_]US/i.test(v.lang) && v.localService) ||
    en.find(v => /en[-_]US/i.test(v.lang)) ||
    en[0] || null;
}
if (synth) {
  pickVoice();
  synth.addEventListener?.('voiceschanged', pickVoice);
}

export const canSpeak = !!synth;

export function speak(text, { rate = 0.85 } = {}) {
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  if (voice) u.voice = voice;
  u.rate = rate;
  synth.speak(u);
}

// Letter names: single uppercase letters are read as names by TTS engines ("A" -> "ay").
export const speakLetter = letter => speak(letter.toUpperCase(), { rate: 0.8 });

const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export const canListen = !!Recognition;

// Resolves with a list of lower-cased transcripts, or rejects with a Hebrew error message.
export function listenOnce() {
  return new Promise((resolve, reject) => {
    if (!Recognition) return reject(new Error('הדפדפן הזה לא תומך בזיהוי דיבור'));
    const r = new Recognition();
    r.lang = 'en-US';
    r.maxAlternatives = 5;
    r.interimResults = false;
    let done = false;
    r.onresult = e => {
      done = true;
      const alts = [...e.results[0]].map(a => a.transcript.trim().toLowerCase());
      resolve(alts);
    };
    r.onerror = e => {
      done = true;
      reject(new Error(e.error === 'not-allowed' ? 'צריך לאשר גישה למיקרופון' :
                       e.error === 'no-speech' ? 'לא שמענו כלום, נסו שוב' : 'משהו השתבש, נסו שוב'));
    };
    r.onend = () => { if (!done) reject(new Error('לא שמענו כלום, נסו שוב')); };
    r.start();
  });
}
