# המחברת האנגלית · My English Notebook

A game-style site for Hebrew speakers learning English from zero. It is fully static, with no build step and no dependencies, and is ready for GitHub Pages.

## What's inside

| Unit | Games |
|------|-------|
| 1. האותיות (letters) | Learn (name, sound, example word) · Listen & pick · Upper/lower-case memory · Trace with a finger |
| 2. קריאה ראשונה (first reading) | Learn short words letter by letter · Read & pick picture · Hear & pick the spelling among look-alikes · Spell with tiles |
| 3–11. Daily words: greetings, numbers, colors, family, food, animals, body, home, actions | Learn · Picture → English · Listen → picture · Spell · Say it (bonus, microphone) |

- **Scoring:** 10 points per correct answer, +5 when on a streak of 3 or more. Each round earns 1–3 stars.
- **Progression:** a unit unlocks once you earn half the stars of the unit before it. Bonus games don't count toward unlocking.
- **Trophies:** 22 trophies, defined in `js/trophies.js`.
- **Daily goal & streak:** 3 rounds a day is the daily goal (ring on the home screen and around the 🔥 in the top bar). The 🔥 day streak counts days the goal was met; a streak freeze from the shop covers a missed day.
- **Coins & shop:** 1 🪙 per star earned in a round, +10 for meeting the daily goal. The shop (`#/shop`) sells extra avatars, notebook themes and streak freezes. Logic lives in `js/rewards.js` and `js/shop.js`.
- **Accounts:** a nickname, an avatar and a password of at least 6 characters, with no email needed. Progress is saved to Firebase, so a player can continue on any device.
- **Leaderboard:** the top 20 players by points, visible only to signed-in players.
- **Audio:** pronunciation uses the browser's built-in English voice (`speechSynthesis`). "Say it" uses speech recognition, which Chrome, Edge and Android support.

## Run locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765. ES modules need a server; opening the file from disk with `file://` won't work.

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages**. Set the source to **Deploy from a branch** and pick `main` with `/ (root)`.
3. The site is served at **https://learn-english.shenkar.site**. The `CNAME` file sets this custom domain. The Cloudflare DNS record is a CNAME from `learn-english` to `israelshenkar.github.io`, set to DNS only. All paths are relative and routing uses `#/`, so no extra configuration is needed.

## Firebase backend

- **Project:** `my-english-notebook-f96a8`, on the free Spark plan. The database is Firestore in `me-west1` (Tel Aviv).
- **How nicknames sign in:** each nickname maps to a made-up address, `p<hash>@players.my-english-notebook.invalid`, used with Email/Password sign-in. No real email is used, so **there is no password reset**. If a player forgets their password, the only option is to delete the account under Authentication → Users and register again, which loses their progress.
- **Data:** `users/{uid}` holds a player's full progress and only that player can access it. `leaderboard/{uid}` holds the nickname, avatar, points and trophy count; any signed-in player can read it.
- **Rules:** if you change `firestore.rules`, paste it into Firestore → Rules in the console and press Publish.
- **Hosting:** `learn-english.shenkar.site` and `israelshenkar.github.io` are listed under Authentication → Settings → Authorized domains.

## Code map

- `js/data.js`: all course content (letters, words, units, games). Edit it to add words or units.
- `js/store.js`: accounts and progress, cached in memory and saved to Firestore.
- `js/cloud.js`: the Firebase config and SDK wrapper (Auth + Firestore, loaded from Google's CDN).
- `firestore.rules`: a copy of the security rules published in the Firebase console.
- `js/games.js`: the mini-games.
- `js/trophies.js`: trophy rules.
- `js/rewards.js`: daily goal, day streak, coins, streak freezes and notebook themes.
- `js/shop.js`: the shop screen (`#/shop`).
- `js/app.js`: screens and routing.
- `js/speech.js`: text-to-speech and speech recognition.
- `js/ui.js`: DOM helper, sound effects, confetti.
