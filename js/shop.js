// The shop (#/shop): spend coins on avatars, notebook themes and streak freezes.
import { AVATARS } from './data.js';
import * as store from './store.js';
import { awardTrophies } from './trophies.js';
import { h, toast, confetti, sfx } from './ui.js';
import { SHOP_AVATARS, THEMES, FREEZE_PRICE, MAX_FREEZES, ensure, owns, applyTheme, paintChips, useFreezes } from './rewards.js';

// `mount`, `topbar` and `announceTrophies` come from app.js (passed in to avoid a circular import).
export function shopScreen(user, { mount, topbar, announceTrophies }) {
  const body = h('div', { class: 'shop-body' });
  const balance = h('b', {});
  mount(topbar(user, { back: '#/' }), h('main', { class: 'shop' },
    h('div', { class: 'shop-head' },
      h('div', {}, h('h1', { tabindex: -1 }, 'החנות 🛍️'),
        h('p', { class: 'lead' }, 'מרוויחים מטבע על כל כוכב, ובונוס על עמידה ביעד היומי.')),
      h('span', { class: 'wallet', 'aria-live': 'polite' }, '🪙 ', balance)),
    body));

  let armed = null; // item id waiting for a second tap ("בטוח?")

  function draw() {
    const p = ensure(store.currentUser().progress);
    balance.textContent = p.wallet.toLocaleString('he-IL');
    const me = store.currentUser().avatar;

    const priceBtn = (item, label = 'קנייה') => {
      const can = p.wallet >= item.price;
      const sure = armed === item.id;
      return h('button', {
        class: `btn buy ${sure ? 'primary sure' : ''}`, type: 'button', disabled: !can,
        'aria-label': `${label} ב-${item.price} מטבעות`,
        onclick: () => { if (sure) buy(item); else { armed = item.id; draw(); } },
      }, sure ? 'בטוח? ✓' : can ? `🪙 ${item.price}` : `🔒 ${item.price}`);
    };

    const avatarItems = [...SHOP_AVATARS, ...AVATARS.map(emoji => ({ id: `avatar:${emoji}`, kind: 'avatar', emoji, price: 0 }))];
    const avatars = h('ul', { class: 'shop-grid avatars' }, avatarItems.map(item => {
      const have = owns(p, item.id), on = me === item.emoji;
      return h('li', { class: `shop-item ${have ? 'owned' : ''} ${on ? 'on' : ''}` },
        h('span', { class: 'shop-avatar', 'aria-hidden': 'true' }, item.emoji),
        on ? h('span', { class: 'tag' }, '✓ שלי')
          : have ? h('button', { class: 'btn equip', type: 'button', 'aria-label': `לבחור ${item.emoji}`, onclick: () => equipAvatar(item.emoji) }, 'בחירה')
            : priceBtn(item));
    }));

    const themes = h('ul', { class: 'shop-grid themes' }, THEMES.map(item => {
      const have = owns(p, item.id), on = p.theme === item.key;
      return h('li', { class: `shop-item theme-item ${have ? 'owned' : ''} ${on ? 'on' : ''}` },
        h('span', { class: 'theme-swatch', 'data-theme': item.key || 'classic', 'aria-hidden': 'true' },
          h('span', { class: 'sw-mark' }, 'Aa'), h('span', { class: 'sw-btn' })),
        h('b', {}, item.title),
        on ? h('span', { class: 'tag' }, '✓ בשימוש')
          : have ? h('button', { class: 'btn equip', type: 'button', onclick: () => equipTheme(item.key) }, 'בחירה')
            : priceBtn(item));
    }));

    const freezeItem = { id: 'freeze', kind: 'freeze', price: FREEZE_PRICE };
    const freeze = h('div', { class: 'shop-item freeze-item' },
      h('span', { class: 'shop-avatar', 'aria-hidden': 'true' }, '❄️'),
      h('div', { class: 'freeze-text' }, h('b', {}, 'הקפאת רצף'),
        h('small', {}, `שומרת על הרצף ביום שפספסתם. יש לכם ${p.freezes} מתוך ${MAX_FREEZES}.`)),
      p.freezes >= MAX_FREEZES ? h('span', { class: 'tag' }, 'מלא') : priceBtn(freezeItem));

    body.replaceChildren(
      h('section', {}, h('h2', {}, 'דמויות'), avatars),
      h('section', {}, h('h2', {}, 'עיצוב המחברת'), themes),
      h('section', {}, h('h2', {}, 'עזרה לרצף'), freeze));
  }

  function buy(item) {
    armed = null;
    let fresh = [], ok = false, repaired = 0;
    store.update(pr => {
      ensure(pr);
      if (pr.wallet < item.price) return;
      if (item.kind === 'freeze') { if (pr.freezes >= MAX_FREEZES) return; pr.freezes++; repaired = useFreezes(pr); } // covers a gap right away
      else { if (owns(pr, item.id)) return; pr.owned.push(item.id); }
      pr.wallet -= item.price;
      if (item.kind === 'theme') pr.theme = item.key;
      ok = true;
      fresh = awardTrophies(pr);
    });
    if (!ok) { draw(); return; }
    sfx.coin();
    confetti(50);
    if (item.kind === 'avatar') store.setAvatar(item.emoji); // saves profile + leaderboard row
    else store.flush();
    if (item.kind === 'theme') applyTheme(store.currentUser());
    toast(item.kind !== 'freeze' ? 'תתחדשו! 🎉' : repaired ? '❄️ הרצף שלכם תוקן!' : '❄️ הקפאת רצף נשמרה!');
    afterChange();
    announceTrophies(fresh);
  }

  function equipAvatar(emoji) {
    sfx.flip();
    store.setAvatar(emoji);
    afterChange();
  }

  function equipTheme(key) {
    sfx.flip();
    store.update(pr => { ensure(pr).theme = key; });
    store.flush();
    applyTheme(store.currentUser());
    afterChange();
  }

  function afterChange() {
    const u = store.currentUser();
    paintChips(u.progress);
    const av = document.querySelector('.topbar .avatar-btn');
    if (av) av.textContent = u.avatar;
    draw();
  }

  draw();
}
