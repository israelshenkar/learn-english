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
- **Trophies:** 19 trophies, defined in `js/trophies.js`.
- **Accounts:** a nickname, an avatar and a password of at least 6 characters, with no email needed. Progress is saved to Firebase, so a player can continue on any device.
- **Leaderboard:** the top 20 players by points, visible only to signed-in players.
- **Parent report (`#/progress`, linked from the trophies page):** a printable page for adults with play per day over the last 14 days, units completed, letters/words learned or mastered, and weak spots.
- **Groups (`#/groups`):** a family or a class. A player creates a group and gets a 6-character join code, or joins one with a code. Members see a private leaderboard; the creator also sees each member's progress summary and can remove members (which changes the code) or delete the group.
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
- **Groups data:** `groups/{gid}` (name, current code, owner), `groups/{gid}/members/{uid}` (a small summary each member writes for themself: nick, avatar, points, stars per unit, counts, last active day), `groupCodes/{code}` (lookup by exact code only, never listable) and `memberships/{uid}` (the player's own list of group ids). Until the rules below are published, the groups page says groups aren't enabled yet; everything else keeps working.
- **Rules:** if you change `firestore.rules`, paste it into Firestore → Rules in the console and press Publish.

### Local emulator and rules tests

Groups can be tried without touching the live project. This needs Java 11 or newer.

```bash
npx firebase-tools emulators:start --only firestore,auth --project demo-mec
```

Then open http://localhost:8765/?emulator=1. The switch only works on localhost, and it uses a separate app instance and an in-memory cache. The security-rules tests run against the same emulator:

```bash
cd tests/rules && npm install && npm test
```
- **Hosting:** `learn-english.shenkar.site` and `israelshenkar.github.io` are listed under Authentication → Settings → Authorized domains.

## Code map

- `js/data.js`: all course content (letters, words, units, games). Edit it to add words or units.
- `js/store.js`: accounts and progress, cached in memory and saved to Firestore.
- `js/cloud.js`: the Firebase config and SDK wrapper (Auth + Firestore, loaded from Google's CDN).
- `firestore.rules`: a copy of the security rules published in the Firebase console.
- `js/games.js`: the mini-games.
- `js/trophies.js`: trophy rules.
- `js/report.js`: progress metrics for adults and the per-day log (`progress.daily`).
- `js/parent.js`: the parent report page.
- `js/groups.js`: groups (Firestore calls and screens).
- `js/app.js`: screens and routing.
- `js/speech.js`: text-to-speech and speech recognition.
- `js/ui.js`: DOM helper, sound effects, confetti.
