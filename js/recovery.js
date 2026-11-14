// Password recovery with a parent-held recovery code – no email, no server code, no new Firestore rules.
//
// The idea: a recovery code is a long random secret (16 characters, 80 bits) that a parent keeps on paper or in their
// phone. When it is created, the player's current password is encrypted with a key derived from the code and stored
// in a "vault": a second, hidden Firebase Auth account whose made-up address and password are also derived from
// nickname + code. The vault's ciphertext lives in that account's own users/{vaultUid} doc, which the existing
// owner-only rule already protects – so only someone who has the code can even read the ciphertext, and guessing is
// rate-limited by Firebase Auth like any login.
//
// Recovering: nickname + code → sign in to the vault (on a separate, in-memory Firebase app instance, so the player's
// own session is untouched) → decrypt the old password → sign in to the player's account with it → set the new
// password → re-encrypt the vault with the new password. The same code keeps working afterwards.
//
// Trade-off (also in README): the code is password-equivalent for as long as it exists. Anyone holding it can take
// over the account and read the current password, so it must be kept by a parent, not shared.
import { SDK, firebaseConfig, normNick, nickToEmail, loadCloud, hebrewAuthError } from './cloud.js';

const VAULT_DOMAIN = 'players.my-english-notebook.invalid';
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: no I, L, O, U – easy to read and type
const CODE_LENGTH = 16;                                // 16 × 5 bits = 80 bits
const PBKDF2_ROUNDS = 200_000;

// --- Codes -------------------------------------------------------------------

export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return [...bytes].map(b => ALPHABET[b & 31]).join('');
}

// Accepts the code as typed: any case, with or without dashes/spaces, and O/I/L typed for 0/1.
export function normCode(text) {
  const s = String(text || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
  return s.length === CODE_LENGTH && [...s].every(ch => ALPHABET.includes(ch)) ? s : null;
}

export const formatCode = code => code.match(/.{4}/g).join('-');

// --- Crypto helpers ----------------------------------------------------------

const enc = new TextEncoder();
const sha256 = async text => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)));
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const b64 = bytes => btoa(String.fromCharCode(...bytes));
const unb64 = text => Uint8Array.from(atob(text), ch => ch.charCodeAt(0));

async function derive(nick, code) {
  const n = normNick(nick);
  const seed = `${n}|${code}`;
  const material = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`mec-vault-key|${n}`), iterations: PBKDF2_ROUNDS },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return {
    email: `r${hex(await sha256(`mec-vault-id|${seed}`)).slice(0, 40)}@${VAULT_DOMAIN}`,
    password: b64(await sha256(`mec-vault-pw|${seed}`)),
    key,
  };
}

async function seal(key, passwords) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify({ p: passwords }))));
  return { kind: 'recovery', v: 1, iv: b64(iv), ct: b64(ct) };
}

async function unseal(key, doc) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(doc.iv) }, key, unb64(doc.ct));
  return JSON.parse(new TextDecoder().decode(plain)).p;
}

// --- Vault account (a separate Firebase app instance, never persisted) -------

async function withVaultApp(fn) {
  const [appMod, A, F] = await Promise.all([
    import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = appMod.initializeApp(firebaseConfig, `vault-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    const auth = A.initializeAuth(app, { persistence: A.inMemoryPersistence });
    return await fn({ auth, db: F.getFirestore(app), A, F });
  } finally {
    appMod.deleteApp(app).catch(() => {});
  }
}

const vaultDoc = (F, db, uid) => F.doc(db, 'users', uid);

// Checks the signed-in player's password without changing the session.
export async function checkPassword(nick, password) {
  const { auth, A } = await loadCloud();
  try {
    await A.reauthenticateWithCredential(auth.currentUser, A.EmailAuthProvider.credential(await nickToEmail(nick), password));
  } catch (e) { throw new Error(hebrewAuthError(e).replace('הכינוי או הסיסמה לא נכונים', 'הסיסמה לא נכונה')); }
}

// Creates a new code + vault holding `password`. Returns { code, ref } – store `ref` on the player's profile so the
// vault can be deleted later (it holds only the vault's own sign-in, which can't decrypt the password).
export async function createRecovery(nick, password) {
  const code = newCode();
  const d = await derive(nick, code);
  await withVaultApp(async ({ auth, db, A, F }) => {
    const { user } = await A.createUserWithEmailAndPassword(auth, d.email, d.password);
    await F.setDoc(vaultDoc(F, db, user.uid), { ...(await seal(d.key, [password])), updated: F.serverTimestamp() });
  });
  return { code, ref: { email: d.email, password: d.password, created: Date.now() } };
}

// Deletes an old vault (when a code is replaced or removed). Best effort.
export async function deleteRecovery(ref) {
  if (!ref?.email) return;
  await withVaultApp(async ({ auth, db, A, F }) => {
    const { user } = await A.signInWithEmailAndPassword(auth, ref.email, ref.password);
    await F.deleteDoc(vaultDoc(F, db, user.uid));
    await A.deleteUser(user);
  }).catch(err => console.warn('[mec] could not delete old recovery vault', err));
}

// Full recovery. `login(nick, password)` signs the player in (store.login). Resolves when the player is signed in
// with `newPassword`; resolves with { warning } if signed in but the vault could not be updated.
export async function recover(nick, codeText, newPassword, login) {
  const code = normCode(codeText);
  if (!code) throw new Error(`קוד השחזור צריך להיות ${CODE_LENGTH} תווים (אותיות באנגלית ומספרים)`);
  if (newPassword.length < 6) throw new Error('הסיסמה החדשה צריכה להיות לפחות 6 תווים');
  const d = await derive(nick, code);
  return withVaultApp(async ({ auth, db, A, F }) => {
    let user;
    try { ({ user } = await A.signInWithEmailAndPassword(auth, d.email, d.password)); }
    catch (e) { throw new Error(hebrewAuthError(e).replace('הכינוי או הסיסמה לא נכונים', 'הכינוי או קוד השחזור לא נכונים')); }
    const ref = vaultDoc(F, db, user.uid);
    const snap = await F.getDoc(ref);
    if (!snap.exists()) throw new Error('הכינוי או קוד השחזור לא נכונים');
    const passwords = await unseal(d.key, snap.data());

    let oldPassword = null;
    for (const pw of passwords) {
      try { await login(nick, pw); oldPassword = pw; break; } catch {}
    }
    if (oldPassword === null) throw new Error('הקוד הזה כבר לא מתאים לחשבון (אולי הסיסמה הוחלפה מאז). צרו קוד חדש אחרי הכניסה.');
    if (oldPassword === newPassword) return {};

    // Keep both passwords in the vault while switching, so a failure halfway never locks the code out.
    const save = async list => F.setDoc(ref, { ...(await seal(d.key, list)), updated: F.serverTimestamp() });
    try { await save([newPassword, oldPassword]); }
    catch { return { warning: 'נכנסתם, אבל לא הצלחנו להחליף סיסמה כרגע. נסו שוב מאוחר יותר.' }; }
    const main = await loadCloud();
    try { await main.A.updatePassword(main.auth.currentUser, newPassword); }
    catch { return { warning: 'נכנסתם, אבל לא הצלחנו להחליף סיסמה כרגע. הסיסמה הישנה עדיין בתוקף.' }; }
    await save([newPassword]).catch(() => {});
    return {};
  });
}
