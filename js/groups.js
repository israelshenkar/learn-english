// Private groups (a family or a class): create / join with a short code, a private leaderboard,
// and – for the group's creator – a table of every member's progress summary.
//
// Firestore layout (rules in firestore.rules):
//   groups/{gid}                 { name, code, ownerUid, ownerNick, created }       members only
//   groups/{gid}/members/{uid}   small summary each member writes for themself      members only
//   groupCodes/{code}            { groupId, name, ownerNick }                        get by exact code, never list
//   memberships/{uid}            { groups: [gid] }  – "my groups" index              owner only
import { UNITS } from './data.js';
import * as store from './store.js';
import { loadCloud } from './cloud.js';
import { groupSummary } from './report.js';
import { h, toast, sfx, confetti } from './ui.js';

const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 – easy to read aloud and type
const MAX_GROUPS = 20;

const newCode = () => [...crypto.getRandomValues(new Uint8Array(6))].map(b => CODE_ABC[b % CODE_ABC.length]).join('');
export const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const denied = e => e?.code === 'permission-denied';

class GroupsUnavailable extends Error {}

async function fs() {
  const { F, db } = await loadCloud();
  return { F, db, uid: store.currentUser()?.uid };
}

// --- "my groups" index ------------------------------------------------------------

let myGroupIds = null; // cached for summary syncing; null = unknown
let cachedFor = null;  // uid the cache belongs to

async function readMembership() {
  const { F, db, uid } = await fs();
  try {
    const snap = await F.getDoc(F.doc(db, 'memberships', uid));
    myGroupIds = snap.exists() ? (snap.data().groups || []) : [];
    cachedFor = uid;
    return myGroupIds;
  } catch (e) {
    if (denied(e)) throw new GroupsUnavailable('groups rules not published');
    throw e;
  }
}

async function forget(gids) {
  if (!gids.length) return;
  const { F, db, uid } = await fs();
  await F.setDoc(F.doc(db, 'memberships', uid), { groups: F.arrayRemove(...gids) }, { merge: true }).catch(() => {});
  myGroupIds = (myGroupIds || []).filter(g => !gids.includes(g));
}

export async function myGroups() {
  const { F, db, uid } = await fs();
  const ids = await readMembership();
  const gone = [];
  const rows = await Promise.all(ids.map(async gid => {
    try {
      const snap = await F.getDoc(F.doc(db, 'groups', gid));
      if (!snap.exists()) { gone.push(gid); return null; }
      return { id: gid, ...snap.data(), mine: snap.data().ownerUid === uid };
    } catch (e) {
      if (denied(e)) gone.push(gid); // removed from the group (or it was deleted)
      return null;
    }
  }));
  await forget(gone);
  return rows.filter(Boolean);
}

// --- summary syncing ---------------------------------------------------------------

let lastSync = 0;
let syncing = null;

// Push this player's summary to every group they're in. Cheap no-op when they have no groups.
export function syncSummaries({ force = false } = {}) {
  const user = store.currentUser();
  if (!user) return Promise.resolve();
  if (!force && Date.now() - lastSync < 20_000) return syncing || Promise.resolve();
  lastSync = Date.now();
  syncing = (async () => {
    if (cachedFor !== user.uid) myGroupIds = null;
    const ids = myGroupIds ?? await readMembership().catch(() => { cachedFor = user.uid; return (myGroupIds = []); });
    if (!ids.length) return;
    const { F, db } = await fs();
    const summary = groupSummary(user);
    for (const k of ['mastered', 'lastActive']) if (!(k in summary)) summary[k] = F.deleteField(); // drop stale values
    const gone = [];
    await Promise.all(ids.map(gid => F.updateDoc(F.doc(db, 'groups', gid, 'members', user.uid), summary)
      .catch(e => { if (denied(e) || e?.code === 'not-found') gone.push(gid); })));
    await forget(gone);
  })().catch(err => console.warn('[mec] group summary sync failed', err));
  return syncing;
}

// --- create / join / leave / remove ----------------------------------------------

export async function createGroup(name) {
  name = String(name || '').normalize('NFC').trim().slice(0, 30);
  if (!name) throw new Error('צריך לתת שם לקבוצה');
  const user = store.currentUser();
  const { F, db } = await fs();
  const ids = await readMembership();
  if (ids.length >= MAX_GROUPS) throw new Error(`אפשר להיות בעד ${MAX_GROUPS} קבוצות`);
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = newCode();
    const taken = await F.getDoc(F.doc(db, 'groupCodes', code)).then(s => s.exists());
    if (taken) continue;
    const gref = F.doc(F.collection(db, 'groups'));
    const b = F.writeBatch(db);
    b.set(gref, { name, code, ownerUid: user.uid, ownerNick: user.nick, created: F.serverTimestamp() });
    b.set(F.doc(db, 'groupCodes', code), { groupId: gref.id, name, ownerNick: user.nick });
    b.set(F.doc(db, 'groups', gref.id, 'members', user.uid),
      { ...groupSummary(user), joined: F.serverTimestamp(), joinCode: code });
    b.set(F.doc(db, 'memberships', user.uid), { groups: F.arrayUnion(gref.id) }, { merge: true });
    try {
      await b.commit();
    } catch (e) {
      if (denied(e)) continue; // most likely someone grabbed the same code a moment ago – try another
      throw e;
    }
    myGroupIds = [...(myGroupIds || []), gref.id];
    return gref.id;
  }
  throw new Error('לא הצלחנו ליצור קבוצה, נסו שוב');
}

export async function lookupCode(raw) {
  const code = cleanCode(raw);
  if (code.length !== 6) throw new Error('הקוד צריך להיות 6 תווים, למשל K7Q2PX');
  const { F, db } = await fs();
  const snap = await F.getDoc(F.doc(db, 'groupCodes', code));
  if (!snap.exists()) throw new Error('לא מצאנו קבוצה עם הקוד הזה. בדקו שהוא הוקלד נכון');
  return { code, ...snap.data() };
}

export async function joinGroup({ code, groupId }) {
  const user = store.currentUser();
  const { F, db } = await fs();
  const ids = await readMembership();
  if (ids.includes(groupId)) return groupId;
  if (ids.length >= MAX_GROUPS) throw new Error(`אפשר להיות בעד ${MAX_GROUPS} קבוצות`);
  const b = F.writeBatch(db);
  b.set(F.doc(db, 'groups', groupId, 'members', user.uid),
    { ...groupSummary(user), joined: F.serverTimestamp(), joinCode: code });
  b.set(F.doc(db, 'memberships', user.uid), { groups: F.arrayUnion(groupId) }, { merge: true });
  try { await b.commit(); }
  catch (e) {
    if (denied(e)) throw new Error('לא הצלחנו להצטרף. ייתכן שהקוד הוחלף – בקשו קוד חדש ממי שיצר/ה את הקבוצה');
    throw e;
  }
  myGroupIds = [...ids, groupId];
  return groupId;
}

export async function leaveGroup(gid) {
  const { F, db, uid } = await fs();
  const b = F.writeBatch(db);
  b.delete(F.doc(db, 'groups', gid, 'members', uid));
  b.set(F.doc(db, 'memberships', uid), { groups: F.arrayRemove(gid) }, { merge: true });
  await b.commit();
  myGroupIds = (myGroupIds || []).filter(g => g !== gid);
}

// The owner changes the join code, e.g. so a removed member can't come back with the old one.
async function rotateBatch(F, db, group) {
  let code;
  for (let attempt = 0; attempt < 4; attempt++) {
    code = newCode();
    if (!(await F.getDoc(F.doc(db, 'groupCodes', code)).then(s => s.exists()))) break;
  }
  const b = F.writeBatch(db);
  b.update(F.doc(db, 'groups', group.id), { code });
  b.set(F.doc(db, 'groupCodes', code), { groupId: group.id, name: group.name, ownerNick: group.ownerNick });
  b.delete(F.doc(db, 'groupCodes', group.code));
  return { b, code };
}

export async function newJoinCode(group) {
  const { F, db } = await fs();
  const { b, code } = await rotateBatch(F, db, group);
  await b.commit();
  return code;
}

export async function removeMember(group, memberUid) {
  const { F, db } = await fs();
  const { b, code } = await rotateBatch(F, db, group);
  b.delete(F.doc(db, 'groups', group.id, 'members', memberUid));
  await b.commit();
  return code;
}

export async function deleteGroup(group, memberUids) {
  const { F, db, uid } = await fs();
  await Promise.all(memberUids.filter(m => m !== uid).map(m => F.deleteDoc(F.doc(db, 'groups', group.id, 'members', m))));
  const b = F.writeBatch(db);
  b.delete(F.doc(db, 'groups', group.id, 'members', uid));
  b.delete(F.doc(db, 'groupCodes', group.code));
  b.delete(F.doc(db, 'groups', group.id));
  b.set(F.doc(db, 'memberships', uid), { groups: F.arrayRemove(group.id) }, { merge: true });
  await b.commit();
  myGroupIds = (myGroupIds || []).filter(g => g !== group.id);
}

async function loadGroup(gid) {
  const { F, db, uid } = await fs();
  const [gsnap, msnap] = await Promise.all([
    F.getDoc(F.doc(db, 'groups', gid)),
    F.getDocs(F.collection(db, 'groups', gid, 'members')),
  ]);
  if (!gsnap.exists()) return null;
  const group = { id: gid, ...gsnap.data() };
  group.mine = group.ownerUid === uid;
  const members = msnap.docs.map(d => ({ uid: d.id, ...d.data() }));
  return { group, members };
}

// --- screens --------------------------------------------------------------------------

function busy(btn, on, label) {
  btn.disabled = on;
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; }
  else if (btn.dataset.label) btn.textContent = btn.dataset.label;
}

const unavailableMsg = () => h('p', { class: 'warn' }, 'הקבוצות עוד לא הופעלו באתר. נסו שוב בקרוב.');
const errorMsg = () => h('p', { class: 'warn' }, 'לא הצלחנו לטעון כרגע. בדקו את החיבור לאינטרנט ונסו שוב.');

export function groupsScreen(user, { mount, topbar, go }) {
  const list = h('section', { class: 'sheet gr-section' }, h('h2', {}, 'הקבוצות שלי'), h('p', { class: 'hint' }, 'טוענים…'));

  // Create
  const cErr = h('p', { class: 'error', role: 'alert' });
  const cName = h('input', { id: 'gr-name', type: 'text', maxlength: 30, required: true, placeholder: 'למשל: משפחת כהן / כיתה ג׳2' });
  const cBtn = h('button', { class: 'btn primary', type: 'submit' }, 'יצירת קבוצה');
  const createForm = h('form', { class: 'form gr-form' },
    h('h2', {}, 'קבוצה חדשה'),
    h('p', { class: 'hint small' }, 'להורים ולמורים: יוצרים קבוצה, מקבלים קוד, ומשתפים אותו עם הילדים או התלמידים.'),
    h('label', { for: 'gr-name' }, 'שם הקבוצה'), cName, cErr, h('div', { class: 'row' }, cBtn));
  createForm.addEventListener('submit', async e => {
    e.preventDefault(); cErr.textContent = '';
    busy(cBtn, true, 'יוצרים…');
    try { const gid = await createGroup(cName.value); sfx.win(); confetti(50); go(`#/group/${gid}`); }
    catch (ex) { cErr.textContent = ex instanceof GroupsUnavailable ? 'הקבוצות עוד לא הופעלו באתר.' : ex.message || 'משהו השתבש, נסו שוב'; sfx.bad(); busy(cBtn, false); }
  });

  // Join
  const jErr = h('p', { class: 'error', role: 'alert' });
  const jCode = h('input', { id: 'gr-code', type: 'text', maxlength: 8, required: true, dir: 'ltr', class: 'gr-code-input',
    autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'K7Q2PX' });
  const jBtn = h('button', { class: 'btn primary', type: 'submit' }, 'חיפוש');
  const jPreview = h('div', { class: 'gr-preview' });
  const joinForm = h('form', { class: 'form gr-form' },
    h('h2', {}, 'הצטרפות עם קוד'),
    h('label', { for: 'gr-code' }, 'הקוד שקיבלתם'), jCode, jErr, jPreview, h('div', { class: 'row' }, jBtn));
  joinForm.addEventListener('submit', async e => {
    e.preventDefault(); jErr.textContent = ''; jPreview.replaceChildren();
    busy(jBtn, true, 'מחפשים…');
    try {
      const found = await lookupCode(jCode.value);
      busy(jBtn, false);
      const yes = h('button', { class: 'btn primary', type: 'button' }, 'כן, להצטרף');
      yes.addEventListener('click', async () => {
        busy(yes, true, 'מצטרפים…');
        try { const gid = await joinGroup({ code: found.code, groupId: found.groupId }); sfx.win(); go(`#/group/${gid}`); }
        catch (ex) { jErr.textContent = ex instanceof GroupsUnavailable ? 'הקבוצות עוד לא הופעלו באתר.' : ex.message || 'משהו השתבש, נסו שוב'; sfx.bad(); busy(yes, false); }
      });
      jPreview.replaceChildren(h('p', {}, 'נמצאה הקבוצה ', h('b', {}, `"${found.name}"`), ` של ${found.ownerNick}.`),
        h('p', { class: 'hint small' }, 'חברי הקבוצה יראו את הכינוי, הדמות, הנקודות והכוכבים שלך. מי שיצר/ה את הקבוצה יראה גם סיכום התקדמות.'),
        h('div', { class: 'row' }, yes));
      yes.focus();
    } catch (ex) {
      jErr.textContent = denied(ex) ? 'הקבוצות עוד לא הופעלו באתר.' : ex.message || 'משהו השתבש, נסו שוב';
      sfx.bad(); busy(jBtn, false);
    }
  });

  mount(topbar(user, { back: '#/trophies' }), h('main', { class: 'groups' },
    h('h1', { tabindex: -1 }, 'קבוצות'),
    h('p', { class: 'lead' }, 'משפחה או כיתה – טבלת אלופים פרטית רק לחברי הקבוצה.'),
    list,
    h('div', { class: 'gr-forms' }, h('section', { class: 'sheet' }, joinForm), h('section', { class: 'sheet' }, createForm))));

  myGroups().then(rows => {
    if (!list.isConnected) return;
    list.replaceChildren(h('h2', {}, 'הקבוצות שלי'), rows.length
      ? h('ul', { class: 'gr-list' }, rows.map(g => h('li', {},
        h('a', { href: `#/group/${g.id}`, class: 'gr-card' },
          h('span', { class: 'gr-icon', 'aria-hidden': 'true' }, g.mine ? '🧑‍🏫' : '👥'),
          h('span', {}, h('b', {}, g.name), h('small', {}, g.mine ? 'את/ה מנהל/ת את הקבוצה' : `של ${g.ownerNick}`))))))
      : h('p', { class: 'hint' }, 'עוד לא הצטרפת לאף קבוצה.'));
  }).catch(e => {
    if (list.isConnected) list.replaceChildren(h('h2', {}, 'הקבוצות שלי'), e instanceof GroupsUnavailable ? unavailableMsg() : errorMsg());
  });
  syncSummaries({ force: true });
}

const fmtDay = iso => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) : '—');
const totalStars = m => Object.values(m.stars || {}).reduce((s, n) => s + (Number(n) || 0), 0);

export function groupScreen(user, gid, { mount, topbar, go, render }) {
  const main = h('main', { class: 'group' }, h('h1', { tabindex: -1 }, 'קבוצה'), h('p', { class: 'hint' }, 'טוענים…'));
  mount(topbar(user, { back: '#/groups' }), main);

  syncSummaries({ force: true }).then(() => loadGroup(gid)).then(data => {
    if (!main.isConnected) return;
    if (!data) { main.replaceChildren(h('h1', { tabindex: -1 }, 'הקבוצה לא נמצאה'), h('p', {}, h('a', { href: '#/groups' }, 'חזרה לקבוצות'))); return; }
    const { group, members } = data;
    members.sort((a, b) => (b.points || 0) - (a.points || 0));

    const board = h('section', { class: 'sheet board' }, h('h2', {}, 'טבלת האלופים של הקבוצה'),
      h('ol', {}, members.map(m => h('li', { class: m.uid === user.uid ? 'me' : '' },
        h('span', {}, m.avatar), h('b', {}, m.nick, m.uid === group.ownerUid ? ' 🧑‍🏫' : ''),
        h('span', {}, `⭐ ${(m.points || 0).toLocaleString('he-IL')}`), h('span', {}, `★ ${totalStars(m)}`)))));

    const head = h('div', { class: 'gr-head' },
      h('div', {}, h('h1', { tabindex: -1 }, group.name),
        h('p', { class: 'lead' }, group.mine ? `${members.length} חברים · את/ה מנהל/ת את הקבוצה` : `${members.length} חברים · מנהל/ת: ${group.ownerNick}`)),
      group.mine && h('div', { class: 'gr-code-box' },
        h('span', {}, 'קוד הצטרפות'),
        h('b', { dir: 'ltr', class: 'gr-code' }, group.code),
        h('button', { class: 'linkish no-print', type: 'button', onclick: async e => {
          const btn = e.currentTarget; busy(btn, true, 'מחליפים…');
          try { await newJoinCode(group); toast('נוצר קוד חדש. הקוד הישן כבר לא עובד.'); render(); }
          catch { toast('לא הצלחנו להחליף קוד'); busy(btn, false); }
        } }, 'קוד חדש')));

    let teacher = null;
    if (group.mine) {
      const unitCols = UNITS;
      teacher = h('section', { class: 'sheet gr-section' },
        h('div', { class: 'gr-row' }, h('h2', {}, 'התקדמות החברים'),
          h('button', { class: 'btn no-print', type: 'button', onclick: () => window.print() }, '🖨️ הדפסה')),
        h('div', { class: 'rp-scroll' }, h('table', { class: 'rp-table gr-table' },
          h('thead', {}, h('tr', {},
            h('th', { scope: 'col' }, 'שם'), h('th', { scope: 'col' }, 'נקודות'),
            unitCols.map((u, i) => h('th', { scope: 'col', title: u.title, class: 'gr-unit' }, h('span', { 'aria-hidden': 'true' }, u.icon), h('span', { class: 'sr-only' }, u.title), h('small', {}, i + 1))),
            h('th', { scope: 'col' }, 'נלמדו'), h('th', { scope: 'col' }, 'נשלטו'), h('th', { scope: 'col' }, 'סבבים'),
            h('th', { scope: 'col' }, 'ימים פעילים (7)'), h('th', { scope: 'col' }, 'פעילות אחרונה'),
            h('th', { scope: 'col', class: 'no-print' }, h('span', { class: 'sr-only' }, 'פעולות')))),
          h('tbody', {}, members.map(m => h('tr', {},
            h('th', { scope: 'row' }, `${m.avatar} ${m.nick}`),
            h('td', {}, (m.points || 0).toLocaleString('he-IL')),
            unitCols.map(u => { const s = m.stars?.[u.id] || 0; return h('td', { class: s ? 'gr-unit' : 'gr-unit zero' }, s); }),
            h('td', {}, m.learned ?? '—'), h('td', {}, m.mastered ?? '—'), h('td', {}, m.rounds ?? '—'),
            h('td', {}, m.active7 ?? '—'), h('td', {}, fmtDay(m.lastActive)),
            h('td', { class: 'no-print' }, m.uid !== user.uid && h('button', { class: 'linkish danger', type: 'button', onclick: async e => {
              if (!confirm(`להוציא את ${m.nick} מהקבוצה? קוד ההצטרפות יוחלף כדי שלא יוכלו לחזור עם הקוד הישן.`)) return;
              const btn = e.currentTarget; busy(btn, true, '…');
              try { await removeMember(group, m.uid); toast(`${m.nick} הוצא/ה מהקבוצה. נוצר קוד הצטרפות חדש.`); render(); }
              catch { toast('לא הצלחנו להוציא מהקבוצה'); busy(btn, false); }
            } }, 'הוצאה'))))))),
        h('p', { class: 'hint small' }, 'בעמודות השלבים: מספר הכוכבים בכל שלב. "נלמדו" = פריטים שנצפו בכרטיסי הלמידה. "נשלטו" יופיע כשיהיו נתוני תרגול מפורטים.'));
    }

    const actions = h('div', { class: 'row no-print gr-actions' },
      group.mine
        ? h('button', { class: 'btn ghost danger', type: 'button', onclick: async e => {
          if (!confirm(`למחוק את הקבוצה "${group.name}"? כל החברים יוצאו ממנה. ההתקדמות של כל אחד נשמרת.`)) return;
          const btn = e.currentTarget; busy(btn, true, 'מוחקים…');
          try { await deleteGroup(group, members.map(m => m.uid)); toast('הקבוצה נמחקה'); go('#/groups'); }
          catch { toast('לא הצלחנו למחוק את הקבוצה'); busy(btn, false); }
        } }, 'מחיקת הקבוצה')
        : h('button', { class: 'btn ghost danger', type: 'button', onclick: async e => {
          if (!confirm(`לעזוב את הקבוצה "${group.name}"?`)) return;
          const btn = e.currentTarget; busy(btn, true, 'יוצאים…');
          try { await leaveGroup(group.id); toast('יצאת מהקבוצה'); go('#/groups'); }
          catch { toast('לא הצלחנו לצאת מהקבוצה'); busy(btn, false); }
        } }, 'עזיבת הקבוצה'));

    main.replaceChildren(...[head, board, teacher, actions].filter(Boolean));
    main.querySelector('h1')?.focus?.({ preventScroll: true });
  }).catch(e => {
    if (!main.isConnected) return;
    main.replaceChildren(h('h1', { tabindex: -1 }, 'קבוצה'),
      denied(e) ? h('p', {}, 'אין לך גישה לקבוצה הזאת (אולי יצאת ממנה או שהיא נמחקה). ', h('a', { href: '#/groups' }, 'לקבוצות שלי'))
        : errorMsg());
  });
}
