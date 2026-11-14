// Account screens: the #/account page (recovery code + logout), the recovery-code offer right after registering,
// and the "forgot my password" form on the login screen. Recovery logic itself lives in recovery.js.
import * as store from './store.js';
import { createRecovery, deleteRecovery, checkPassword, recover, formatCode } from './recovery.js';
import { h, en, sfx, toast } from './ui.js';

function busy(btn, on, label) {
  btn.disabled = on;
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; }
  else if (btn.dataset.label) btn.textContent = btn.dataset.label;
}

const pwInput = (id, autocomplete) =>
  h('input', { id, type: 'password', autocomplete, minlength: 6, required: true, dir: 'ltr', class: 'password' });

// Shows a freshly created code once, with ways to keep it. Calls onDone when the parent says it's saved.
function codeCard(nick, code, onDone, doneLabel = 'שמרתי את הקוד ✔') {
  const pretty = formatCode(code);
  const note = `המחברת האנגלית – קוד שחזור סיסמה\nכינוי: ${nick}\nקוד: ${pretty}\n\n` +
    'שכחתם סיסמה? במסך הכניסה לוחצים "שכחתי סיסמה" ומקלידים את הכינוי ואת הקוד.\n' +
    'שמרו את הקוד במקום בטוח ואל תשתפו אותו – מי שמחזיק בו יכול להיכנס לחשבון.';
  const copy = h('button', { class: 'btn', type: 'button', onclick: async () => {
    try { await navigator.clipboard.writeText(note); toast('הקוד הועתק 📋'); }
    catch { toast('לא הצלחנו להעתיק – רשמו את הקוד על דף'); }
  } }, '📋 העתקה');
  const keep = navigator.share
    ? h('button', { class: 'btn', type: 'button', onclick: () => navigator.share({ title: 'קוד שחזור', text: note }).catch(() => {}) }, '📤 שליחה')
    : h('button', { class: 'btn', type: 'button', onclick: () => {
      const a = h('a', { href: URL.createObjectURL(new Blob([note], { type: 'text/plain;charset=utf-8' })), download: `recovery-${nick}.txt` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } }, '💾 שמירה כקובץ');
  return h('div', { class: 'recovery-card' },
    h('p', {}, 'זה קוד השחזור של ', h('b', {}, nick), '. הוא מוצג ', h('b', {}, 'רק עכשיו'), ':'),
    h('p', { class: 'recovery-code', dir: 'ltr' }, en(pretty)),
    h('p', { class: 'hint small' }, 'הורים: שמרו את הקוד אצלכם (על דף, או בטלפון). אם הסיסמה תישכח, הקוד יאפשר לבחור סיסמה חדשה בלי לאבד את ההתקדמות. ',
      h('b', {}, 'אל תשתפו אותו'), ' – מי שמחזיק בקוד יכול להיכנס לחשבון.'),
    h('div', { class: 'row wrap' }, copy, keep),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: onDone }, doneLabel)));
}

// Right after registering: offer (not force) a recovery code. Resolves when the player moves on.
export function recoveryOffer(box, nick, password) {
  return new Promise(resolve => {
    const err = h('p', { class: 'error', role: 'alert' });
    const create = h('button', { class: 'btn primary', type: 'button' }, '🔐 יצירת קוד שחזור');
    const skip = h('button', { class: 'btn ghost', type: 'button', onclick: () => resolve() }, 'אולי אחר כך');
    create.addEventListener('click', async () => {
      err.textContent = '';
      busy(create, true, 'יוצרים קוד…');
      skip.disabled = true;
      try {
        const { code, ref } = await createRecovery(nick, password);
        await store.setRecovery(ref);
        box.replaceChildren(h('h2', { tabindex: -1 }, 'קוד השחזור מוכן 🔐'), codeCard(nick, code, () => resolve(), 'שמרתי, יוצאים לדרך! 🚀'));
        box.querySelector('h2').focus();
      } catch (e) {
        console.warn('[mec] recovery code not created', e);
        err.textContent = 'לא הצלחנו ליצור קוד כרגע. אפשר ליצור אותו אחר כך בדף הפרופיל (לחיצה על הדמות).';
        busy(create, false); skip.disabled = false;
      }
    });
    box.replaceChildren(h('div', { class: 'form' },
      h('h2', { tabindex: -1 }, 'נרשמתם! 🎉 עוד צעד קטן להורים'),
      h('p', {}, 'שכחו סיסמה? עם ', h('b', {}, 'קוד שחזור'), ' אפשר לבחור סיסמה חדשה בלי לאבד את ההתקדמות.'),
      h('p', { class: 'hint small' }, 'אנחנו לא שומרים מייל או פרטים אישיים – הקוד נשמר רק אצלכם.'),
      err, h('div', { class: 'row wrap' }, skip, create)));
    box.querySelector('h2').focus();
  });
}

// "Forgot my password" form (login screen).
export function recoverForm({ nick = '', onBack, onDone }) {
  const err = h('p', { class: 'error', role: 'alert' });
  const nickIn = h('input', { id: 'rec-nick', type: 'text', maxlength: 16, required: true, autocomplete: 'username', value: nick });
  const codeIn = h('input', { id: 'rec-code', type: 'text', required: true, dir: 'ltr', class: 'code-input', autocomplete: 'off',
    autocapitalize: 'characters', spellcheck: 'false', placeholder: 'XXXX-XXXX-XXXX-XXXX', maxlength: 24 });
  const pw = pwInput('rec-pw', 'new-password');
  const submit = h('button', { class: 'btn primary', type: 'submit' }, 'החלפת סיסמה');
  const form = h('form', { class: 'form' },
    h('h2', { tabindex: -1 }, 'שכחתי סיסמה 🔑'),
    h('p', { class: 'hint small' }, 'צריך את קוד השחזור שההורים שמרו כשנרשמתם (או שנוצר בדף הפרופיל).'),
    h('label', { for: 'rec-nick' }, 'כינוי'), nickIn,
    h('label', { for: 'rec-code' }, 'קוד שחזור'), codeIn,
    h('label', { for: 'rec-pw' }, 'סיסמה חדשה – לפחות 6 תווים'), pw,
    err,
    h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', onclick: onBack }, 'חזרה'), submit),
    h('p', { class: 'hint small' }, 'אין קוד שחזור? בלי קוד אי אפשר לשחזר את החשבון – אפשר להירשם מחדש עם כינוי חדש.'));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    busy(submit, true, 'בודקים…');
    try {
      const { warning } = await recover(nickIn.value.trim(), codeIn.value, pw.value, store.login);
      sfx.good();
      toast(warning || 'הסיסמה הוחלפה! 🎉');
      onDone();
    } catch (ex) {
      const friendly = ex.message?.match(/[֐-׿]/);
      if (!friendly) console.warn('[mec] recovery failed', ex);
      err.textContent = friendly ? ex.message : 'משהו השתבש, נסו שוב';
      sfx.bad(); busy(submit, false);
    }
  });
  queueMicrotask(() => (nick ? codeIn : nickIn).focus());
  return form;
}

// #/account – who's playing, the recovery code, and logging out.
export function accountPage(user, { onLogout }) {
  const section = h('section', { class: 'sheet account-recovery' });

  function paint() {
    const ref = store.currentUser()?.recovery;
    section.replaceChildren(
      h('h2', {}, '🔐 שחזור סיסמה'),
      ref ? h('p', {}, '✅ לחשבון הזה יש קוד שחזור. נוצר בתאריך ', h('bdi', {}, new Date(ref.created).toLocaleDateString('he-IL')), '.')
        : h('p', {}, 'עדיין אין קוד שחזור. בלי קוד, סיסמה שנשכחה = חשבון שאבד.'),
      h('p', { class: 'hint small' }, ref
        ? 'הקוד הקודם אבד? צרו קוד חדש – הקוד הישן יפסיק לעבוד.'
        : 'מומלץ שהורה ייצור קוד וישמור אותו אצלו. לא נשמר שום מייל או פרט אישי.'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn primary', type: 'button', onclick: askPassword }, ref ? 'יצירת קוד חדש' : 'יצירת קוד שחזור'),
        ref && h('button', { class: 'btn ghost', type: 'button', onclick: remove }, 'מחיקת הקוד')));
  }

  function askPassword() {
    const err = h('p', { class: 'error', role: 'alert' });
    const pw = pwInput('acc-pw', 'current-password');
    const submit = h('button', { class: 'btn primary', type: 'submit' }, 'המשך');
    const form = h('form', { class: 'form' },
      h('h2', {}, '🔐 שחזור סיסמה'),
      h('label', { for: 'acc-pw' }, 'כדי ליצור קוד, הקלידו את הסיסמה הנוכחית'), pw, err,
      h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', onclick: paint }, 'ביטול'), submit));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      err.textContent = '';
      busy(submit, true, 'יוצרים קוד…');
      try {
        await checkPassword(user.nick, pw.value);
        const old = store.currentUser().recovery;
        const { code, ref } = await createRecovery(user.nick, pw.value);
        await store.setRecovery(ref);
        if (old) deleteRecovery(old);
        section.replaceChildren(h('h2', {}, 'קוד השחזור החדש 🔐'), codeCard(user.nick, code, paint));
      } catch (ex) {
        err.textContent = ex.message?.match(/[֐-׿]/) ? ex.message : 'לא הצלחנו ליצור קוד כרגע, נסו שוב';
        busy(submit, false); pw.select();
      }
    });
    section.replaceChildren(form);
    pw.focus();
  }

  function remove() {
    const yes = h('button', { class: 'btn primary', type: 'button' }, 'כן, למחוק');
    yes.addEventListener('click', async () => {
      busy(yes, true, 'מוחקים…');
      const old = store.currentUser().recovery;
      await store.setRecovery(null);
      await deleteRecovery(old);
      paint();
    });
    section.replaceChildren(h('h2', {}, '🔐 שחזור סיסמה'),
      h('p', {}, 'למחוק את קוד השחזור? אחרי זה לא יהיה אפשר לשחזר סיסמה שנשכחה.'),
      h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', onclick: paint }, 'ביטול'), yes));
  }

  paint();
  const logout = h('button', { class: 'btn', type: 'button' }, '🚪 יציאה מהפרופיל');
  logout.addEventListener('click', async () => { busy(logout, true, 'יוצאים…'); await onLogout(); });
  return h('main', { class: 'account' },
    h('div', { class: 'who' }, h('span', { class: 'avatar big' }, user.avatar), h('h1', { tabindex: -1 }, user.nick)),
    section,
    h('section', { class: 'sheet' },
      h('h2', {}, 'יציאה'),
      h('p', { class: 'hint small' }, 'כדי לחזור צריך את הכינוי והסיסמה.'),
      h('div', { class: 'row' }, logout)));
}
