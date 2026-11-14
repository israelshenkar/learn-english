// Security-rules tests for firestore.rules, run against the local Firestore emulator.
//   cd tests/rules && npm install
//   (repo root) npx firebase-tools emulators:start --only firestore,auth --project demo-mec
//   cd tests/rules && npm test
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, writeBatch, serverTimestamp, query, where, deleteField,
} from 'firebase/firestore';

let env;
const RULES = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mec',
    firestore: { rules: RULES, host: '127.0.0.1', port: 8784 },
  });
});
after(() => env?.cleanup());
beforeEach(() => env.clearFirestore());

const db = uid => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

const summary = (nick, code, extra = {}) => ({
  nick, avatar: '🦊', points: 10, stars: { letters: 3 }, learned: 4, mastered: 1, rounds: 2, active7: 1,
  lastActive: '2026-11-14', joined: serverTimestamp(), joinCode: code, ...extra,
});

// Mirrors the app's createGroup() batch.
async function createGroup(uid, gid, code, name = 'כיתה ג') {
  const d = db(uid);
  const b = writeBatch(d);
  b.set(doc(d, 'groups', gid), { name, code, ownerUid: uid, ownerNick: uid, created: serverTimestamp() });
  b.set(doc(d, 'groupCodes', code), { groupId: gid, name, ownerNick: uid });
  b.set(doc(d, 'groups', gid, 'members', uid), summary(uid, code));
  return b.commit();
}
const join = (uid, gid, code) => setDoc(doc(db(uid), 'groups', gid, 'members', uid), summary(uid, code));
async function rotate(uid, gid, oldCode, newCode) {
  const d = db(uid);
  const b = writeBatch(d);
  b.update(doc(d, 'groups', gid), { code: newCode });
  b.set(doc(d, 'groupCodes', newCode), { groupId: gid, name: 'כיתה ג', ownerNick: uid });
  b.delete(doc(d, 'groupCodes', oldCode));
  return b.commit();
}

// ---- existing collections keep working ----------------------------------------------
test('users: owner-only', async () => {
  await assertSucceeds(setDoc(doc(db('alice'), 'users', 'alice'), { nick: 'alice', progress: {} }));
  await assertSucceeds(getDoc(doc(db('alice'), 'users', 'alice')));
  await assertFails(getDoc(doc(db('bob'), 'users', 'alice')));
  await assertFails(setDoc(doc(db('bob'), 'users', 'alice'), { nick: 'x' }));
});

test('leaderboard: unchanged behaviour', async () => {
  const row = { nick: 'alice', avatar: '🦊', points: 5, trophies: 1, updated: serverTimestamp() };
  await assertSucceeds(setDoc(doc(db('alice'), 'leaderboard', 'alice'), row));
  await assertFails(setDoc(doc(db('bob'), 'leaderboard', 'alice'), row));
  await assertFails(setDoc(doc(db('alice'), 'leaderboard', 'alice'), { ...row, extra: 1 }));
  await assertSucceeds(getDocs(collection(db('bob'), 'leaderboard')));
  await assertFails(getDocs(collection(db(null), 'leaderboard')));
});

// ---- groups -----------------------------------------------------------------------------
test('owner can create a group with code + own member doc in one batch', async () => {
  await assertSucceeds(createGroup('olga', 'g1', 'K7Q2PX'));
  await assertSucceeds(getDoc(doc(db('olga'), 'groups', 'g1')));
  await assertSucceeds(getDocs(collection(db('olga'), 'groups', 'g1', 'members')));
});

test('group creation is denied when parts are missing or point elsewhere', async () => {
  const d = db('olga');
  // group without code doc
  await assertFails(setDoc(doc(d, 'groups', 'g1'), { name: 'x', code: 'K7Q2PX', ownerUid: 'olga', ownerNick: 'o', created: serverTimestamp() }));
  // bad code format (I/O/0/1 excluded, length 6)
  await assertFails(createGroup('olga', 'g1', 'K7Q2P0'));
  await assertFails(createGroup('olga', 'g1', 'abcdef'));
  // someone else as owner
  const b = writeBatch(d);
  b.set(doc(d, 'groups', 'g2'), { name: 'x', code: 'AAAAAA', ownerUid: 'bob', ownerNick: 'o', created: serverTimestamp() });
  b.set(doc(d, 'groupCodes', 'AAAAAA'), { groupId: 'g2', name: 'x', ownerNick: 'o' });
  b.set(doc(d, 'groups', 'g2', 'members', 'olga'), summary('olga', 'AAAAAA'));
  await assertFails(b.commit());
});

test('a code doc cannot point at someone else\'s group, nor overwrite an existing code', async () => {
  await createGroup('olga', 'g1', 'K7Q2PX');
  // mallory tries to claim a new code for olga's group
  await assertFails(setDoc(doc(db('mallory'), 'groupCodes', 'ZZZZZZ'), { groupId: 'g1', name: 'x', ownerNick: 'm' }));
  // mallory creates her own group re-using olga's code -> code doc exists already, so it's an update -> denied
  await assertFails(createGroup('mallory', 'g9', 'K7Q2PX'));
  await assertFails(updateDoc(doc(db('olga'), 'groupCodes', 'K7Q2PX'), { name: 'y' }));
});

test('codes and groups cannot be listed / enumerated', async () => {
  await createGroup('olga', 'g1', 'K7Q2PX');
  await assertFails(getDocs(collection(db('mallory'), 'groupCodes')));
  await assertFails(getDocs(collection(db('olga'), 'groupCodes')));
  await assertFails(getDocs(collection(db('mallory'), 'groups')));
  await assertFails(getDocs(query(collection(db('mallory'), 'groups'), where('ownerUid', '==', 'olga'))));
  // looking up one exact code is allowed (that's how joining works) – but only when signed in
  await assertSucceeds(getDoc(doc(db('mallory'), 'groupCodes', 'K7Q2PX')));
  await assertFails(getDoc(doc(db(null), 'groupCodes', 'K7Q2PX')));
});

test('non-members cannot read the group or its members', async () => {
  await createGroup('olga', 'g1', 'K7Q2PX');
  await assertFails(getDoc(doc(db('mallory'), 'groups', 'g1')));
  await assertFails(getDocs(collection(db('mallory'), 'groups', 'g1', 'members')));
  await assertFails(getDoc(doc(db('mallory'), 'groups', 'g1', 'members', 'olga')));
  await assertFails(getDocs(collection(db(null), 'groups', 'g1', 'members')));
});

test('joining needs the current code; then the member can read the group', async () => {
  await createGroup('olga', 'g1', 'K7Q2PX');
  await assertFails(join('kid', 'g1', 'WRONG2'));
  await assertFails(join('kid', 'g1', 'AAAAAA'));
  await assertFails(setDoc(doc(db('kid'), 'groups', 'g1', 'members', 'kid'), summary('kid', undefined, { joinCode: null })));
  await assertSucceeds(join('kid', 'g1', 'K7Q2PX'));
  await assertSucceeds(getDoc(doc(db('kid'), 'groups', 'g1')));
  await assertSucceeds(getDocs(collection(db('kid'), 'groups', 'g1', 'members')));
  // joining a group that doesn't exist
  await assertFails(join('kid', 'nope', 'K7Q2PX'));
});

test('only the member writes their own summary, with a fixed shape', async () => {
  await createGroup('olga', 'g1', 'K7Q2PX');
  await join('kid', 'g1', 'K7Q2PX');
  const ref = uid => doc(db(uid), 'groups', 'g1', 'members', 'kid');
  await assertSucceeds(updateDoc(ref('kid'), { points: 50, stars: { letters: 3, reading: 2 }, active7: 3 }));
  await assertFails(updateDoc(ref('olga'), { points: 9999 }));          // even the owner can't
  await assertFails(setDoc(doc(db('mallory'), 'groups', 'g1', 'members', 'kid'), summary('kid', 'K7Q2PX')));
  await assertFails(updateDoc(ref('kid'), { progress: { secret: 1 } })); // extra key
  await assertFails(updateDoc(ref('kid'), { nick: 'x'.repeat(17) }));
  await assertFails(updateDoc(ref('kid'), { points: -1 }));
  await assertFails(updateDoc(ref('kid'), { points: 1.5 }));
  await assertFails(updateDoc(ref('kid'), { active7: 8 }));
  await assertFails(updateDoc(ref('kid'), { stars: Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`u${i}`, 1])) }));
  await assertFails(updateDoc(ref('kid'), { joinCode: 'BBBBBB' }));    // can't change how you joined
  // the app's sync drops optional fields it no longer has
  await assertSucceeds(updateDoc(ref('kid'), { points: 60, mastered: deleteField(), lastActive: deleteField() }));
  // ...but can't drop required ones
  await assertFails(updateDoc(ref('kid'), { nick: deleteField() }));
  await assertFails(updateDoc(ref('kid'), { joinCode: deleteField() }));
});

test('members leave; only the owner removes others', async () => {
  await createGroup('olga', 'g1', 'K7Q2PX');
  await join('kid', 'g1', 'K7Q2PX');
  await join('kid2', 'g1', 'K7Q2PX');
  await assertFails(deleteDoc(doc(db('kid2'), 'groups', 'g1', 'members', 'kid')));
  await assertFails(deleteDoc(doc(db('mallory'), 'groups', 'g1', 'members', 'kid')));
  await assertSucceeds(deleteDoc(doc(db('kid2'), 'groups', 'g1', 'members', 'kid2')));   // leave
  await assertSucceeds(deleteDoc(doc(db('olga'), 'groups', 'g1', 'members', 'kid')));    // remove
  await assertFails(getDocs(collection(db('kid'), 'groups', 'g1', 'members')));          // no longer a member
});

test('after the owner rotates the code, a removed member cannot rejoin with the old one', async () => {
  await createGroup('olga', 'g1', 'K7Q2PX');
  await join('kid', 'g1', 'K7Q2PX');
  await deleteDoc(doc(db('olga'), 'groups', 'g1', 'members', 'kid'));
  await assertSucceeds(rotate('olga', 'g1', 'K7Q2PX', 'M3N4P5'));
  await assertFails(join('kid', 'g1', 'K7Q2PX'));
  const old = await getDoc(doc(db('kid'), 'groupCodes', 'K7Q2PX'));
  if (old.exists()) throw new Error('old code doc should be gone');
  await assertSucceeds(join('kid3', 'g1', 'M3N4P5'));
});

test('owner cannot change ownerUid or name; non-owners cannot rotate or delete', async () => {
  await createGroup('olga', 'g1', 'K7Q2PX');
  await join('kid', 'g1', 'K7Q2PX');
  await assertFails(updateDoc(doc(db('olga'), 'groups', 'g1'), { ownerUid: 'kid' }));
  await assertFails(updateDoc(doc(db('olga'), 'groups', 'g1'), { name: 'new' }));
  await assertFails(rotate('kid', 'g1', 'K7Q2PX', 'M3N4P5'));
  await assertFails(deleteDoc(doc(db('kid'), 'groups', 'g1')));
  await assertFails(deleteDoc(doc(db('kid'), 'groupCodes', 'K7Q2PX')));
  // owner rotating to a code doc that isn't created in the same batch
  await assertFails(updateDoc(doc(db('olga'), 'groups', 'g1'), { code: 'QQQQQQ' }));
});

test('owner can delete a big group (members one by one, then group + code)', async () => {
  await createGroup('olga', 'g1', 'K7Q2PX');
  const kids = Array.from({ length: 30 }, (_, i) => `kid${i}`);
  await Promise.all(kids.map(k => join(k, 'g1', 'K7Q2PX')));
  const d = db('olga');
  await assertSucceeds(Promise.all(kids.map(k => deleteDoc(doc(d, 'groups', 'g1', 'members', k)))));
  const b = writeBatch(d);
  b.delete(doc(d, 'groups', 'g1', 'members', 'olga'));
  b.delete(doc(d, 'groupCodes', 'K7Q2PX'));
  b.delete(doc(d, 'groups', 'g1'));
  await assertSucceeds(b.commit());
  await env.withSecurityRulesDisabled(async ctx => {
    const left = await getDocs(collection(ctx.firestore(), 'groups', 'g1', 'members'));
    if (left.size) throw new Error(`${left.size} members left`);
  });
});

test('a member can still leave after the group was deleted', async () => {
  await createGroup('olga', 'g1', 'K7Q2PX');
  await join('kid', 'g1', 'K7Q2PX');
  await env.withSecurityRulesDisabled(ctx => deleteDoc(doc(ctx.firestore(), 'groups', 'g1')));
  await assertSucceeds(deleteDoc(doc(db('kid'), 'groups', 'g1', 'members', 'kid')));
});

test('memberships index: owner-only, small list', async () => {
  await assertSucceeds(setDoc(doc(db('kid'), 'memberships', 'kid'), { groups: ['g1'] }));
  await assertSucceeds(getDoc(doc(db('kid'), 'memberships', 'kid')));
  await assertFails(getDoc(doc(db('olga'), 'memberships', 'kid')));
  await assertFails(setDoc(doc(db('olga'), 'memberships', 'kid'), { groups: [] }));
  await assertFails(setDoc(doc(db('kid'), 'memberships', 'kid'), { groups: ['g1'], x: 1 }));
  await assertFails(setDoc(doc(db('kid'), 'memberships', 'kid'), { groups: Array.from({ length: 21 }, (_, i) => `g${i}`) }));
  await assertFails(getDocs(collection(db('kid'), 'memberships')));
});
