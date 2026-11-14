#!/usr/bin/env python3
"""Generate the phonics clips in audio/letters/<letter>.mp3 (macOS only).

The Swift helper (ipa.swift) asks Apple's on-device "Samantha" voice to speak an IPA string
(AVSpeechSynthesisIPANotationAttribute), so we get the letter's SOUND (/s/, /æ/, /b/…) instead of
its NAME. `say "[[inpt PHON]]…"` does not work on current macOS: the voices read the tag aloud.

Usage:  python3 tools/letter-sounds/build.py
Needs: swiftc (Xcode command line tools), ffmpeg, numpy.

Every clip is screened with a crude voiced/unvoiced frame analysis and the result is printed, so a
regression (e.g. an empty file, or a letter NAME sneaking in) is visible. Nobody has listened to
these clips with human ears as part of this script – re-check by ear after regenerating.
"""
import os, subprocess, sys, tempfile
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'audio', 'letters')
SR = 22050

# letter -> (IPA given to the voice, kind)
#   cont : continuant, kept whole (tripled letters make the voice hold the sound)
#   long : a single continuant, slowed down about 3x (for f/v the tripled form stutters)
#   vowel: short vowel, kept whole
#   stop : consonant + schwa; the schwa is cut short so it sounds like "b" not "buh"
# Plain ASCII "g" and "r" are used because the voice returns silence for IPA ɡ / ɹ on their own.
SOUNDS = {
    'a': ('æ', 'vowel'),   'b': ('bə', 'stop'),  'c': ('kə', 'stop'),  'd': ('də', 'stop'),
    'e': ('ɛ', 'vowel'),   'f': ('f', 'long'), 'g': ('gə', 'stop'),  'h': ('hə', 'stop'),
    'i': ('ɪ', 'vowel'),   'j': ('dʒə', 'stop'), 'k': ('kə', 'stop'),  'l': ('lll', 'cont'),
    'm': ('mmm', 'cont'),  'n': ('nnn', 'cont'), 'o': ('ɑ', 'vowel'),  'p': ('pə', 'stop'),
    'q': ('kw', 'cont'),   'r': ('rrr', 'cont'), 's': ('sss', 'cont'), 't': ('tə', 'stop'),
    'u': ('ʌ', 'vowel'),   'v': ('v', 'long'), 'w': ('wə', 'stop'),  'x': ('ks', 'cont'),
    'y': ('jə', 'stop'),   'z': ('zzz', 'cont'),
}

FRAME, HOP = 441, 220  # 20 ms frames, 10 ms hop


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def frame_classes(x):
    """One char per 10 ms: '.' silence, 'V' voiced, 'S' hiss (high-frequency noise), 'n' other noise."""
    peak = np.abs(x).max() + 1e-9
    out = []
    for i in range(0, max(0, len(x) - FRAME), HOP):
        f = x[i:i + FRAME]
        if np.sqrt((f ** 2).mean()) < peak * 0.03:
            out.append('.'); continue
        f2 = f - f.mean()
        ac = np.correlate(f2, f2, 'full')[len(f2) - 1:]
        ac /= ac[0] + 1e-9
        voiced = ac[int(SR / 400):int(SR / 70)].max() > 0.5
        spec = np.abs(np.fft.rfft(f * np.hanning(len(f))))
        freqs = np.fft.rfftfreq(len(f), 1 / SR)
        centroid = (spec * freqs).sum() / (spec.sum() + 1e-9)
        out.append('V' if voiced else ('S' if centroid > 3500 else 'n'))
    return ''.join(out)


def trim(x, kind):
    cls = frame_classes(x)
    active = [i for i, c in enumerate(cls) if c != '.']
    if not active:
        raise SystemExit('empty clip')
    start, end = active[0] * HOP, (active[-1] + 1) * HOP + FRAME
    if kind == 'stop':
        # keep the consonant plus ~110 ms of the following vowel, then fade
        voiced = [i for i, c in enumerate(cls) if c == 'V' and i >= active[0]]
        if voiced:
            end = min(end, voiced[0] * HOP + int(0.11 * SR))
    y = x[max(0, start - int(0.01 * SR)):end].copy()
    fade_in, fade_out = int(0.008 * SR), int((0.06 if kind == 'stop' else 0.03) * SR)
    y[:fade_in] *= np.linspace(0, 1, fade_in)
    y[-fade_out:] *= np.linspace(1, 0, fade_out)
    return y / (np.abs(y).max() + 1e-9) * 0.7  # same loudness for every clip


def main():
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tool = os.path.join(tmp, 'ipatool')
        subprocess.run(['swiftc', '-O', os.path.join(HERE, 'ipa.swift'), '-o', tool], check=True)
        pairs = [f'{k}={ipa}' for k, (ipa, _) in SOUNDS.items()]
        subprocess.run([tool, 'Samantha', tmp, *pairs], check=True, stdout=subprocess.DEVNULL)
        total = 0
        for k, (ipa, kind) in SOUNDS.items():
            src = os.path.join(tmp, f'{k}.caf')
            if kind == 'long':  # time-stretch (pitch kept) so the sound lasts long enough to hear
                slow = os.path.join(tmp, f'{k}-slow.wav')
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', 'atempo=0.5,atempo=0.6', slow], check=True)
                src = slow
            y = trim(load(src), kind)
            dest = os.path.join(OUT, f'{k}.mp3')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                            '-codec:a', 'libmp3lame', '-b:a', '48k', dest],
                           input=y.astype(np.float32).tobytes(), check=True)
            size = os.path.getsize(dest); total += size
            print(f'{k}  /{ipa}/  {kind:5s} {len(y) / SR:4.2f}s {size:5d}B  {frame_classes(y).strip(".")}')
        print(f'total {total / 1024:.1f} KB in {OUT}')


if __name__ == '__main__':
    sys.exit(main())
