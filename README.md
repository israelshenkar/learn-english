# המחברת האנגלית · My English Notebook

A game-style site for Hebrew speakers learning English from zero. It is fully static, with no build step and no dependencies, and is ready for GitHub Pages.

## What's inside

| Unit | Games |
|------|-------|
| 1. האותיות (letters) | Learn (name, recorded letter sound, example word) · Listen & pick · Upper/lower-case memory · Trace with a finger · ABC order (what comes after/before, missing letter, tap into order) |
| 2. קריאה ראשונה (first reading) | Learn short words letter by letter, with "sound by sound" blending · Read & pick picture · Hear & pick the spelling among look-alikes · Spell with tiles |
| 3–17. Daily words: greetings, numbers, colors, family, food, animals, body, home, actions, clothes, weather, school, days of the week, months, feelings | Learn · Picture → English · Listen → picture · Spell · Say it (bonus, microphone). Days and months play "in order" instead of Spell. |
| 18. משפטים קצרים (short sentences) | Learn (tap each word) · Read a sentence & pick the picture · Listen → picture · Build the sentence from word tiles |

- **Scoring:** 10 points per correct answer, +5 when on a streak of 3 or more. Each round earns 1–3 stars.
- **Progression:** a unit unlocks once you earn half the stars of the unit before it. Bonus games don't count toward unlocking. A unit you already have stars in stays open, so adding a game to an earlier unit never re-locks a player.
- **Trophies:** 22 trophies, defined in `js/trophies.js`.
- **Adaptive practice:** every answer is recorded per item (letter or word) and skill: recognise, write, spell, say. Rounds pick items that were never practiced first, then recent mistakes, then the longest unseen, with a little randomness. This way every letter A–Z comes up within a few rounds. Each unit page shows a grid of its items as not started, practicing or mastered. An item is mastered when it has passed every skill tested by the unit's non-bonus games.
- **Daily review (חזרה יומית):** a home-screen card starts a mixed round of up to 8 practiced items whose review date has come. After a correct answer, the next review is 1, 3, 7 and then 14 days later; a mistake brings the item back today. The round earns points and counts toward the day streak, but gives no unit stars.
- **Daily goal & streak:** 3 rounds a day is the daily goal (ring on the home screen and around the 🔥 in the top bar). The 🔥 day streak counts days the goal was met; a streak freeze from the shop covers a missed day.
- **Coins & shop:** 1 🪙 per star earned in a round, +10 for meeting the daily goal. The shop (`#/shop`) sells extra avatars, notebook themes and streak freezes. Logic lives in `js/rewards.js` and `js/shop.js`.
- **Accounts:** a nickname, an avatar (36 free ones: 12 shown at sign-up, the rest fold out) and a password of at least 6 characters, with no email needed. Progress is saved to Firebase, so a player can continue on any device.
- **Installable and offline:** the site is a PWA. It installs to the home screen and, after one visit, opens without internet (see *Offline app*).
- **Leaderboard:** the top 20 players by points, visible only to signed-in players.
- **Parent report (`#/progress`, linked from the trophies page):** a printable page for adults with play per day over the last 14 days, units completed, letters/words learned or mastered, and weak spots.
- **Groups (`#/groups`):** a family or a class. A player creates a group and gets a 6-character join code, or joins one with a code. Members see a private leaderboard; the creator also sees each member's progress summary and can remove members (which changes the code) or delete the group.
- **Audio:** pronunciation uses the browser's built-in English voice (`speechSynthesis`). "Say it" uses speech recognition, which Chrome, Edge and Android support.
- **Letter sounds:** TTS can only say letter *names*, so the phonics sounds (/b/, /s/, short vowels…) are small clips in `audio/letters/` (about 55 KB in all). They were generated on a Mac from IPA with Apple's built-in voice by `tools/letter-sounds/build.py`. If a clip can't play, the game says the example word instead.

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
- **How nicknames sign in:** each nickname maps to a made-up address, `p<hash>@players.my-english-notebook.invalid`, used with Email/Password sign-in. No real email is used, so Firebase's own password-reset email can't work. Forgotten passwords are handled by the recovery code instead (below). A player with no code who forgets their password can only register again.
- **Recovery vaults:** each recovery code creates a second auth user, `r<hash>@players.my-english-notebook.invalid`. Its `users/{uid}` doc holds `{ kind: 'recovery', iv, ct }`. When you delete a player by hand in the console, also delete their vault. Its address is in the player's `users/{uid}.recovery.email`.
- **Data:** `users/{uid}` holds a player's full progress and only that player can access it. `leaderboard/{uid}` holds the nickname, avatar, points and trophy count; any signed-in player can read it.
- **Groups data:** `groups/{gid}` (name, current code, owner), `groups/{gid}/members/{uid}` (a small summary each member writes for themself: nick, avatar, points, stars per unit, counts, last active day), `groupCodes/{code}` (lookup by exact code only, never listable) and `memberships/{uid}` (the player's own list of group ids). The rules below are published (14 Nov 2026). If a project ever runs without them, the groups page says groups aren't enabled yet and everything else keeps working.
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

## Password recovery

**What players see.** After registering, parents are offered a recovery code such as `80TC-VTD7-8N76-RWY5` and asked to keep it (copy, share or save to a file). The code can also be created, replaced or deleted later on the profile page, which asks for the current password. On the login screen, **שכחתי סיסמה** asks for the nickname, the code and a new password. Progress is kept, and the same code keeps working afterwards.

**How it works** (`js/recovery.js`, no server code, **no Firestore rules change**):
1. The code is 16 random Crockford-base32 characters (80 bits).
2. Nickname + code derive three things: the made-up address of a hidden *vault* auth user, that user's password, and an AES-GCM key (PBKDF2-SHA-256, 200k rounds).
3. The player's current password is encrypted with that key. The ciphertext is stored in the vault user's own `users/{vaultUid}` doc, which the existing owner-only rule protects.
4. Recovery signs in to the vault on a separate, in-memory Firebase app instance, decrypts the old password, signs in to the player's account with it, calls `updatePassword`, and re-encrypts the vault. While switching, the vault briefly holds both passwords, so a failure halfway never locks the code out.
5. The player's profile keeps only the vault's sign-in (`users/{uid}.recovery`), so the vault can be deleted when the code is replaced. That sign-in cannot decrypt the password; only the code can.

**Why not a parent email?** Firebase gives a user exactly one email and password. Making that a real, verified parent address (`verifyBeforeUpdateEmail`) means nickname login would need a nickname → email lookup that any client could read, which leaks parents' emails, or else players log in with the email. One parent email also can't serve two siblings. Linking a parent's Google account has the same one-account-per-Google-user limit and needs the Google provider enabled. The recovery code stores no personal data and needs no console change.

**Trade-offs to know:**
- The code is **password-equivalent** for as long as it exists. Whoever holds it (with the nickname) can take over the account and learn the current password. That is why the UI tells parents to keep it private. Replacing the code deletes the old vault, and **מחיקת הקוד** removes it entirely.
- Guessing is as hard as guessing an 80-bit password, and Firebase Auth rate-limits sign-in attempts.
- The vault holds whatever the password was when the code was made, or after the last recovery. Any future "change password" feature must re-encrypt the vault (or tell the user to make a new code). Otherwise recovery reports that the code no longer matches.
- Each code adds one hidden user to Authentication → Users.

## Nickname filter

`js/nickfilter.js` refuses offensive Hebrew and English nicknames at **registration only**; existing accounts can always log in. Before matching, it removes niqqud and accents, ignores case and separators, maps look-alike digits and symbols (`sh1t`, `a$$`), folds Hebrew final letters and common swaps (ק/כ, ט/ת, ע/א, ש/ס), and allows any letter to repeat. Long words match anywhere in the name. Short ones (`ass`, `זין`, `כוס`) match only as a whole word, so names like Cassie, Hassan or מזין still pass. It runs in the browser, so someone who edits the page can get around it. A matching Firestore rule on `leaderboard/{uid}.nick` would make it binding. A possible rule (not published):

```
function cleanNick(n) {
  // Lower case, without spaces, punctuation or niqqud. Rules have no full normalizer, so only the most common words.
  return !n.lower().replace('[\\s._\\-\\x{0591}-\\x{05C7}]', '')
    .matches('.*(fuck|shit|bitch|cunt|whore|slut|nigg|fagg|pussy|porn|hitler|nazi|זונה|שרמוט|מזדיין|כוסאמק|כוסעמק|מניאק).*');
}
// in match /leaderboard/{uid}, allow create, update: ... && cleanNick(request.resource.data.nick)
```

Check it in the Rules Playground or the emulator before publishing. An existing account whose nickname matches would no longer be able to update its leaderboard row.

## Offline app (PWA)

- `manifest.webmanifest` gives the Hebrew name, `dir: rtl` and the icons in `icons/`, which are generated PNGs plus an SVG.
- `js/pwa.js` registers `sw.js` with a relative URL, so it works at the GitHub Pages root.
- **Same-origin files** are network-first, with the cache as fallback when offline or after 4 s. A deploy (including new files) is picked up on the next load with no version bump. GitHub Pages' own `max-age=600` still applies.
- **Firebase SDK files (pinned version) and Google font files** are cache-first. **Google Fonts CSS** is stale-while-revalidate.
- **Firestore, Auth and every other API** are not handled by the worker at all, so they are never cached. Offline progress comes from Firestore's own persistent cache.
- After the first visit, the page sends the worker the list of files it loaded, so the next visit works offline even for modules not in the worker's built-in list.
- Bump `VERSION` in `sw.js` to drop old caches, for example after changing the Firebase SDK version. That version string appears in `js/cloud.js`, `index.html` (modulepreload) and `sw.js`.

## Loading speed

The loading screen is plain HTML in `index.html`, so it paints before any JavaScript runs. All app modules and the Firebase SDK are `modulepreload`ed. Before, they were found one import level at a time: app.js → store.js → cloud.js → SDK. The Google Fonts stylesheet no longer blocks the first paint (`font-display: swap`). The app still waits for the saved sign-in and the profile before its first real render.

## Code map

- `js/data.js`: all course content (letters, words, units, games). Edit it to add words or units.
- `js/data-extra.js`: the later word units (clothes … feelings) and the short-sentences unit.
- `js/store.js`: accounts and progress, cached in memory and saved to Firestore.
- `js/cloud.js`: the Firebase config and SDK wrapper (Auth + Firestore, loaded from Google's CDN).
- `firestore.rules`: a copy of the security rules published in the Firebase console.
- `js/games.js`: the mini-games.
- `js/games-extra.js`: the order game and the sentence games.
- `js/phonics.js`: letter-sound playback and sound-by-sound blending.
- `js/trophies.js`: trophy rules.
- `js/mastery.js`: per-item results (`progress.items[unitId][key]`), mastery, adaptive item choice and review due dates. These are pure functions with no DOM.
- `js/review.js`: the daily review round, the home review card and the unit mastery grid.
- `js/rewards.js`: daily goal, day streak, coins, streak freezes and notebook themes.
- `js/shop.js`: the shop screen (`#/shop`).
- `js/report.js`: progress metrics for adults and the per-day log (`progress.dayLog`).
- `js/parent.js`: the parent report page.
- `js/groups.js`: groups (Firestore calls and screens).
- `js/app.js`: screens and routing.
- `js/speech.js`: text-to-speech and speech recognition.
- `js/ui.js`: DOM helper, sound effects, confetti.
- `js/account.js`: the profile page, the recovery-code offer after registering, and the "forgot password" form.
- `js/recovery.js`: recovery codes and the encrypted vault.
- `js/nickfilter.js`: the offensive-nickname filter.
- `js/pwa.js`, `sw.js`, `manifest.webmanifest`, `icons/`: the installable offline app.
