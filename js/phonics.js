// Letter SOUNDS (phonics): short pre-recorded clips in audio/letters/<a-z>.mp3, generated on a Mac
// from IPA with tools/letter-sounds/build.py. Browser text-to-speech can only say letter NAMES,
// so when a clip can't play we fall back to saying the example word instead.
import { speak } from './speech.js';

const url = l => `audio/letters/${l}.mp3`;
const warm = new Map();         // letter -> Audio used only to preload the file into the cache
const broken = new Set();       // letters whose clip failed to load
let player = null;              // ONE element for all playback: iOS lets an element that was started
                                // by a tap keep playing later (a blend), but blocks fresh elements
let run = 0;                    // bumps on every new request, so an older blend stops itself

const ok = letter => /^[a-z]$/.test(letter) && !broken.has(letter);

// Warm the cache (e.g. for the letters of a word about to be blended).
export function preloadSounds(letters) {
  for (const c of letters) {
    const l = c.toLowerCase();
    if (!ok(l) || warm.has(l)) continue;
    const a = new Audio(url(l));
    a.preload = 'auto';
    a.addEventListener('error', () => broken.add(l), { once: true });
    warm.set(l, a);
  }
}

// Plays one clip; resolves true when it ends, false if it can't play.
function playClip(letter) {
  const l = letter.toLowerCase();
  if (!ok(l)) return Promise.resolve(false);
  player ||= new Audio();
  const a = player;
  return new Promise(resolve => {
    let done = false;
    const end = res => {
      if (done) return; done = true;
      a.removeEventListener('ended', onEnd); a.removeEventListener('error', onErr); clearTimeout(t); resolve(res);
    };
    const onEnd = () => end(true);
    const onErr = () => { broken.add(l); end(false); };
    const t = setTimeout(() => end(true), 2500); // never hang a blend on a stuck clip
    a.addEventListener('ended', onEnd);
    a.addEventListener('error', onErr);
    try { a.pause(); } catch {}
    if (!a.src.endsWith(url(l))) a.src = url(l);
    try { a.currentTime = 0; } catch {}
    a.play().catch(e => { if (e?.name === 'NotSupportedError') broken.add(l); end(false); });
  });
}

export function stopSounds() {
  run++;
  try { player?.pause(); } catch {}
}

// The typical sound of a letter. `fallbackWord` is spoken if the clip is unavailable.
// Resolves true if the clip played (or a newer sound took over), false if it couldn't play.
export async function playLetterSound(letter, fallbackWord) {
  stopSounds();
  globalThis.speechSynthesis?.cancel();
  const me = run;
  const played = await playClip(letter);
  if (me !== run) return true; // interrupted by a newer tap – no fallback
  if (!played && fallbackWord) speak(fallbackWord, { rate: 0.7 });
  return played;
}

const wait = ms => new Promise(r => setTimeout(r, ms));

// "Blend slowly": sound by sound (c… a… t…), then the whole word, slowly.
// onStep(i) is called as each letter plays, and with -1 at the end, for highlighting.
export async function blendWord(word, onStep = () => {}) {
  stopSounds();
  globalThis.speechSynthesis?.cancel();
  const me = run;
  const letters = [...word.toLowerCase()];
  preloadSounds(letters);
  for (let i = 0; i < letters.length; i++) {
    onStep(i);
    const played = await playClip(letters[i]);
    if (me === run) await wait(played ? 350 : 600);
    if (me !== run) { onStep(-1); return; }
  }
  onStep(-1);
  speak(word, { rate: 0.55 });
}
