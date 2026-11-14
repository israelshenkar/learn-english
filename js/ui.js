import { settings } from './store.js';

// Tiny DOM builder: h('div', {class: 'x', onclick}, child, 'text', [children])
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// English text inside the RTL page.
export const en = (text, cls = '') => h('bdi', { class: `en ${cls}`, dir: 'ltr', lang: 'en' }, text);

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const sample = (arr, n) => shuffle(arr).slice(0, n);

// --- Sound effects (WebAudio, no files) ----------------------------------
let ctx;
function tone(freq, start, dur, type = 'sine', gain = 0.18) {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur + 0.05);
}
export const sfx = {
  good() { if (settings.get().sound) { tone(660, 0, 0.12, 'triangle'); tone(990, 0.09, 0.18, 'triangle'); } },
  bad() { if (settings.get().sound) { tone(220, 0, 0.18, 'square', 0.08); tone(180, 0.12, 0.22, 'square', 0.08); } },
  win() { if (settings.get().sound) [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.25, 'triangle')); },
  goal() { if (settings.get().sound) [523, 659, 784, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.09, i === 6 ? 0.5 : 0.18, 'triangle', 0.16)); },
  coin() { if (settings.get().sound) { tone(988, 0, 0.08, 'square', 0.06); tone(1319, 0.07, 0.25, 'square', 0.06); } },
  flip() { if (settings.get().sound) tone(880, 0, 0.05, 'sine', 0.08); },
};

// --- Toasts & confetti ----------------------------------------------------
export function toast(content, ms = 3200) {
  let box = document.querySelector('.toasts');
  if (!box) { box = h('div', { class: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: 'toast' }, content);
  box.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, ms);
}

export function confetti(n = 80) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#e2554b', '#4aa3df', '#ffd84d', '#2bb673', '#ef6fa4', '#ff9f43'];
  const layer = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < n; i++) {
    layer.append(h('i', { style: {
      left: Math.random() * 100 + 'vw',
      background: colors[i % colors.length],
      animationDelay: Math.random() * 0.6 + 's',
      animationDuration: 1.8 + Math.random() * 1.6 + 's',
      transform: `rotate(${Math.random() * 360}deg)`,
    } }));
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 4200);
}

export function starsRow(n, max = 3, cls = '') {
  return h('span', { class: `stars ${cls}`, 'aria-label': `${n} מתוך ${max} כוכבים` },
    Array.from({ length: max }, (_, i) => h('span', { class: i < n ? 'on' : 'off' }, '★')));
}
