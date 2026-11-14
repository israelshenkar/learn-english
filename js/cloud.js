// Firebase (Auth + Firestore) loaded straight from Google's CDN – no build step needed.
// The web config below is public by design; access is enforced by the Firestore rules (firestore.rules).
const SDK = 'https://www.gstatic.com/firebasejs/11.10.0';

export const firebaseConfig = {
  apiKey: 'AIzaSyCmNRcBPvMD9eGB1v4fxEQAFPFZyt07POY',
  authDomain: 'my-english-notebook-f96a8.firebaseapp.com',
  projectId: 'my-english-notebook-f96a8',
  storageBucket: 'my-english-notebook-f96a8.firebasestorage.app',
  messagingSenderId: '667871339616',
  appId: '1:667871339616:web:6cdba87721da31d46f0f05',
};

// Players sign in with a nickname, not an email. Each nickname maps to a fixed, made-up address on a
// reserved domain (.invalid can never be registered), so no real mailbox is ever involved.
const EMAIL_DOMAIN = 'players.my-english-notebook.invalid';

export const normNick = nick => nick.normalize('NFC').trim().toLowerCase();

async function nickToEmail(nick) {
  const bytes = new TextEncoder().encode(normNick(nick));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return `p${[...hash.slice(0, 20)].map(b => b.toString(16).padStart(2, '0')).join('')}@${EMAIL_DOMAIN}`;
}

let fb = null;

// Dev only: http://localhost:<port>/?emulator=1 talks to the local Firebase emulators (see firebase.json)
// instead of the live project. Never on a real host; separate app name + memory cache, so the live
// session and offline cache on localhost are untouched.
const useEmulator = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
  && new URLSearchParams(location.search).get('emulator') === '1';

function connectEmulator(app, auth, fs) {
  const firebaseApp = app.initializeApp({ ...firebaseConfig, apiKey: 'demo-key', projectId: 'demo-mec' }, 'emulator');
  const a = auth.getAuth(firebaseApp);
  auth.connectAuthEmulator(a, 'http://127.0.0.1:9774', { disableWarnings: true });
  const db = fs.initializeFirestore(firebaseApp, { localCache: fs.memoryLocalCache() });
  fs.connectFirestoreEmulator(db, '127.0.0.1', 8784);
  document.title = `[EMULATOR] ${document.title}`;
  console.warn('[mec] using the local Firebase emulators');
  return { auth: a, db, A: auth, F: fs };
}

export async function loadCloud() {
  if (fb) return fb;
  const [app, auth, fs] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  if (useEmulator) return (fb = connectEmulator(app, auth, fs));
  const firebaseApp = app.initializeApp(firebaseConfig);
  let db;
  try {
    // Offline cache: writes are queued locally and sent when the network is back.
    db = fs.initializeFirestore(firebaseApp, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch {
    db = fs.getFirestore(firebaseApp);
  }
  fb = { auth: auth.getAuth(firebaseApp), db, A: auth, F: fs };
  return fb;
}

// Resolves with the signed-in Firebase user (or null) once the saved session has been restored.
export function authReady() {
  return new Promise(resolve => {
    const off = fb.A.onAuthStateChanged(fb.auth, u => { off(); resolve(u); });
  });
}

export function hebrewAuthError(err) {
  const code = err?.code || '';
  if (code === 'auth/email-already-in-use') return 'הכינוי הזה כבר תפוס – בחרו כינוי אחר';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found')
    return 'הכינוי או הסיסמה לא נכונים';
  if (code === 'auth/weak-password') return 'הסיסמה צריכה להיות לפחות 6 תווים';
  if (code === 'auth/too-many-requests') return 'יותר מדי ניסיונות. חכו קצת ונסו שוב';
  if (code === 'auth/network-request-failed') return 'אין חיבור לאינטרנט. בדקו את החיבור ונסו שוב';
  return 'משהו השתבש, נסו שוב';
}

export async function signUp(nick, password) {
  const cred = await fb.A.createUserWithEmailAndPassword(fb.auth, await nickToEmail(nick), password);
  return cred.user;
}
export async function signIn(nick, password) {
  const cred = await fb.A.signInWithEmailAndPassword(fb.auth, await nickToEmail(nick), password);
  return cred.user;
}
export const signOutCloud = () => fb.A.signOut(fb.auth);

export async function readProfile(uid) {
  const snap = await fb.F.getDoc(fb.F.doc(fb.db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export function writeProfile(uid, profile, trophies) {
  const { F, db } = fb;
  const updated = F.serverTimestamp();
  return Promise.all([
    F.setDoc(F.doc(db, 'users', uid), { ...profile, updated }),
    F.setDoc(F.doc(db, 'leaderboard', uid), {
      nick: profile.nick, avatar: profile.avatar, points: Math.round(profile.progress.points), trophies, updated,
    }),
  ]);
}

export async function topPlayers(n = 20) {
  const { F, db } = fb;
  const q = F.query(F.collection(db, 'leaderboard'), F.orderBy('points', 'desc'), F.limit(n));
  const snap = await F.getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}
