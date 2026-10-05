/* ============================================================
   Premium Frames — store integration
   - 10 naye frames AVATAR_FRAMES me add (4 CSS premium, 4 mythic
     animated, 2 illustrated) + Frozen Sovereign weekly FREE
   - 6 existing frames ko SVG artwork upgrade
     (burger, mewbeat, purplewing, flowerpenguin, plume, pinklove)
   - applyUserFrame wrap: equipped frame par art render
   - renderFrameStore wrap: animated previews + free-frame UX
   - Weekly login par Frozen Sovereign auto-grant (7 din)
   ============================================================ */
(function () {
  'use strict';

  var DAY = 86400000;

  /* ---------- 1. Naye frames ---------- */
  var NEW_FRAMES = [
    { id: 'gold-royale', name: 'Gold Royale', category: 'Luxury', price: 5000, currency: 'gems',
      duration: 'Permanent', durationMs: null,
      ring: 'conic-gradient(from 0deg,#8a5a00,#ffe9a8,#b8860b,#fff3c4,#8a5a00)', accent: '',
      art: { css: 'gold' } },
    { id: 'diamond-elite', name: 'Diamond Elite', category: 'Luxury', price: 4000, currency: 'gems',
      duration: '30 Days', durationMs: 30 * DAY,
      ring: 'linear-gradient(135deg,#9fdcff,#2e9bff,#d8f3ff)', accent: '',
      art: { css: 'diamond' } },
    { id: 'neon-vip', name: 'Neon VIP', category: 'VIP', price: 3500, currency: 'gems',
      duration: '30 Days', durationMs: 30 * DAY,
      ring: 'conic-gradient(#ff2fd6,#7b2fff,#2fd6ff,#ff2fd6)', accent: '',
      art: { css: 'neon' } },
    { id: 'royal-crown', name: 'Royal Crown', category: 'VIP', price: 8000, currency: 'gems',
      duration: 'Permanent', durationMs: null,
      ring: 'linear-gradient(180deg,#ffe9a8,#b8860b,#7a5200)', accent: '',
      art: { css: 'crown' } },
    { id: 'dragon-emperor', name: 'Dragon Emperor', category: 'Mythic', price: 8000, currency: 'gems',
      duration: 'Permanent', durationMs: null,
      ring: 'conic-gradient(from 0deg,#8a5a00,#ffe9a8,#f5a623,#8a5a00)', accent: '',
      art: { fx: 'dragon' } },
    { id: 'phoenix-wings', name: 'Phoenix Wings', category: 'Mythic', price: 5000, currency: 'gems',
      duration: '30 Days', durationMs: 30 * DAY,
      ring: 'linear-gradient(135deg,#ffd23d,#ff5a00,#ff3d00)', accent: '',
      art: { fx: 'phoenix' } },
    { id: 'celestial-galaxy', name: 'Celestial Galaxy', category: 'Cosmic', price: 3000, currency: 'gems',
      duration: '30 Days', durationMs: 30 * DAY,
      ring: 'conic-gradient(from 0deg,#2b0a4d,#7b2fff,#ff2fd6,#2b0a4d)', accent: '',
      art: { fx: 'galaxy' } },
    { id: 'frozen-sovereign', name: 'Frozen Sovereign', category: 'Elemental', price: 0, currency: 'gems',
      duration: '7 Days', durationMs: 7 * DAY,
      ring: 'linear-gradient(135deg,#dff2ff,#8fc7ff,#eaf7ff)', accent: '',
      art: { fx: 'frozen' }, weeklyFree: true },
    { id: 'strongest-titan', name: 'Strongest Titan', category: 'Elemental', price: 999, currency: 'love',
      duration: '5 Days', durationMs: 5 * DAY,
      ring: 'linear-gradient(135deg,#bfe6ff,#5aa9e6,#ffffff)', accent: '',
      art: { svg: 'titan' } },
    { id: 'happy-birthday', name: 'Happy Birthday', category: 'Celebration', price: 999, currency: 'love',
      duration: '3 Days', durationMs: 3 * DAY,
      ring: 'linear-gradient(135deg,#fff3c4,#f5a623,#b8860b)', accent: '',
      art: { svg: 'birthday' } }
  ];

  /* ---------- 2. Existing frames ka artwork upgrade (ID/price/duration same) ---------- */
  var ART_UPGRADES = {
    burger: 'burger',
    mewbeat: 'mewbeat',
    purplewing: 'purplewing',
    flowerpenguin: 'penguin',
    plume: 'plume',
    pinklove: 'heart'
  };

  function findFrame(id) {
    if (typeof AVATAR_FRAMES === 'undefined') return null;
    for (var i = 0; i < AVATAR_FRAMES.length; i++) {
      if (AVATAR_FRAMES[i].id === id) return AVATAR_FRAMES[i];
    }
    return null;
  }

  function installFrames() {
    if (typeof AVATAR_FRAMES === 'undefined') return false;
    NEW_FRAMES.forEach(function (f) {
      if (!findFrame(f.id)) AVATAR_FRAMES.push(f);
    });
    Object.keys(ART_UPGRADES).forEach(function (id) {
      var f = findFrame(id);
      if (f && !f.art) f.art = { svg: ART_UPGRADES[id] };
    });
    return true;
  }

  /* ---------- 3. Art HTML builder ---------- */
  function svgArt(key) {
    if (window.FRAME_ART && window.FRAME_ART[key]) return window.FRAME_ART[key];
    return '';
  }

  function artHTML(frame) {
    if (!frame || !frame.art) return '';
    var a = frame.art;
    if (a.svg) return svgArt(a.svg);
    if (a.css === 'crown') {
      return '<div class="pfx-css pfx-css-crown"></div>' +
        '<svg class="pfx-crown-badge" viewBox="0 0 40 28"><path d="M4 24 L2 8 L12 14 L20 2 L28 14 L38 8 L36 24 Z" fill="#ffd76a" stroke="#8a5a00" stroke-width="2"/><circle cx="20" cy="12" r="2.4" fill="#ff2f6d"/><circle cx="11" cy="15" r="1.8" fill="#2fd6ff"/><circle cx="29" cy="15" r="1.8" fill="#2fd6ff"/></svg>';
    }
    if (a.css) return '<div class="pfx-css pfx-css-' + a.css + '"></div>';
    if (a.fx === 'dragon') {
      return '<div class="pfx-fx"><svg class="pfx-main pfx-dragon-rot" viewBox="0 0 124 124">' +
        '<defs><linearGradient id="pfx-dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset=".5" stop-color="#f5a623"/><stop offset="1" stop-color="#b8860b"/></linearGradient></defs>' +
        '<path d="M62 6 C 96 6, 118 30, 118 62 C 118 94, 96 118, 62 118 C 30 118, 8 96, 6 66" fill="none" stroke="url(#pfx-dg)" stroke-width="8" stroke-linecap="round"/>' +
        '<path d="M12 50 L2 42 L10 38 L6 28 L18 34 L24 26 L26 40 Z" fill="url(#pfx-dg)"/>' +
        '<circle cx="18" cy="36" r="2.4" fill="#fff"/></svg>' +
        '<span class="pfx-ember" style="left:30%"></span>' +
        '<span class="pfx-ember" style="left:55%;animation-delay:.9s"></span>' +
        '<span class="pfx-ember" style="left:70%;animation-delay:1.7s"></span></div>';
    }
    if (a.fx === 'phoenix') {
      var wing = '<svg class="pfx-wing W" viewBox="0 0 52 70"><defs><linearGradient id="pfx-pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd23d"/><stop offset="1" stop-color="#ff3d00"/></linearGradient></defs><path d="M46 4 C 20 10, 6 32, 10 66 C 22 50, 34 44, 46 40 Z" fill="url(#pfx-pg)"/></svg>';
      return '<div class="pfx-fx"><div class="pfx-fire-glow"></div>' +
        wing.replace('W', 'l') + wing.replace('W', 'r') +
        '<span class="pfx-ember" style="left:40%;animation-delay:.4s"></span>' +
        '<span class="pfx-ember" style="left:62%;animation-delay:1.3s"></span></div>';
    }
    if (a.fx === 'galaxy') {
      return '<div class="pfx-fx"><div class="pfx-galaxy-a"></div><div class="pfx-galaxy-b"></div>' +
        '<span class="pfx-star" style="top:12%;left:30%"></span>' +
        '<span class="pfx-star" style="top:22%;left:72%;animation-delay:.6s"></span>' +
        '<span class="pfx-star" style="top:64%;left:14%;animation-delay:1.1s"></span>' +
        '<span class="pfx-star" style="top:72%;left:64%;animation-delay:.3s"></span></div>';
    }
    if (a.fx === 'frozen') {
      var sh = '<svg class="pfx-shard" style="POS" viewBox="0 0 20 36"><polygon points="10,0 18,34 2,34" fill="#bfe6ff"/><line x1="10" y1="6" x2="10" y2="28" stroke="#fff" stroke-width="2" opacity=".7"/></svg>';
      return '<div class="pfx-fx"><div class="pfx-frost-ring"></div>' +
        sh.replace('POS', 'top:-6%;left:43%') +
        sh.replace('POS', 'top:16%;left:2%;transform:rotate(-40deg)') +
        sh.replace('POS', 'top:16%;right:2%;transform:rotate(40deg)') +
        '<span class="pfx-snow" style="left:30%"></span>' +
        '<span class="pfx-snow" style="left:55%;animation-delay:1.1s"></span>' +
        '<span class="pfx-snow" style="left:72%;animation-delay:2s"></span></div>';
    }
    return '';
  }

  /* ---------- 4. applyUserFrame wrap ---------- */
  function wrapApply() {
    if (typeof applyUserFrame !== 'function') return false;
    var _orig = applyUserFrame;
    applyUserFrame = function (avatarEl, userData) {
      _orig(avatarEl, userData);
      try {
        var wrap = avatarEl && avatarEl.closest ? avatarEl.closest('.vip-frame-wrap') : null;
        if (wrap) {
          var olds = wrap.querySelectorAll('.pfx-art');
          for (var i = 0; i < olds.length; i++) olds[i].remove();
        }
        var fid = userData && userData.equippedFrameId;
        var frame = fid ? findFrame(fid) : null;
        if (!frame || !frame.art || !wrap) return;
        var owned = (userData.ownedFrames || {})[fid];
        var valid = owned === true || (typeof owned === 'number' && owned > Date.now());
        if (!valid) return;
        var html = artHTML(frame);
        if (!html) return;
        var art = document.createElement('div');
        art.className = 'pfx-art';
        art.innerHTML = html;
        wrap.appendChild(art);
      } catch (e) {}
    };
    return true;
  }

  /* ---------- 5. renderFrameStore wrap (previews + free UX) ---------- */
  function wrapStore() {
    if (typeof renderFrameStore !== 'function') return false;
    var _orig = renderFrameStore;
    renderFrameStore = function () {
      _orig();
      try {
        var grid = document.getElementById('frameStoreGrid');
        if (!grid) return;
        var cards = grid.children;
        for (var i = 0; i < cards.length; i++) {
          (function (card) {
            var nameEl = card.querySelector('.fsc-frame-name');
            if (!nameEl) return;
            var nm = nameEl.textContent.trim();
            var frame = null;
            if (typeof AVATAR_FRAMES !== 'undefined') {
              for (var k = 0; k < AVATAR_FRAMES.length; k++) {
                if (AVATAR_FRAMES[k].name === nm && AVATAR_FRAMES[k].art) { frame = AVATAR_FRAMES[k]; break; }
              }
            }
            if (!frame) return;
            var prev = card.querySelector('.fsc-frame-preview');
            if (prev && !prev.querySelector('.pfx-pv-overlay')) {
              var rings = prev.querySelectorAll('.vip-frame-ring,.vip-frame-crown');
              for (var r = 0; r < rings.length; r++) rings[r].style.display = 'none';
              var ov = document.createElement('div');
              ov.className = 'pfx-pv-overlay';
              ov.innerHTML = artHTML(frame);
              prev.appendChild(ov);
            }
            if (frame.weeklyFree) {
              var priceEl = card.querySelector('.fsc-frame-price');
              if (priceEl) priceEl.innerHTML = '<span class="pfx-free-tag">🎁 FREE — Weekly Login</span>';
              var btn = card.querySelector('.fsc-frame-btn');
              if (btn && !btn.disabled && btn.textContent.trim() === 'Buy') {
                btn.textContent = '🎁 Claim Free';
              }
            }
          })(cards[i]);
        }
      } catch (e) {}
    };
    return true;
  }

  /* ---------- 6. Weekly FREE grant (Frozen Sovereign) ---------- */
  function weekKey(d) {
    var onejan = new Date(d.getFullYear(), 0, 1);
    var w = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return d.getFullYear() + '-W' + w;
  }

  function weeklyGrant() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      try {
        if (typeof currentUser === 'undefined' || !currentUser) return;
        if (typeof currentUserData === 'undefined' || !currentUserData) return;
        if (typeof db === 'undefined') return;
        clearInterval(t);
        var wk = weekKey(new Date());
        if (currentUserData.lastWeeklyFrameWeek === wk) return;
        var upd = {};
        upd['ownedFrames/frozen-sovereign'] = Date.now() + 7 * DAY;
        upd['lastWeeklyFrameWeek'] = wk;
        db.ref('users/' + currentUser.uid).update(upd).then(function () {
          if (typeof toast === 'function') {
            toast('🎁 Weekly login gift: Frozen Sovereign frame — 7 din ke liye FREE!');
          }
          if (typeof renderFrameStore === 'function') {
            try { renderFrameStore(); } catch (e) {}
          }
        });
      } catch (e) {}
      if (tries > 40) clearInterval(t);
    }, 1500);
  }

  /* ---------- boot ---------- */
  var bootTries = 0;
  var boot = setInterval(function () {
    bootTries++;
    var ok = installFrames();
    if (ok) {
      wrapApply();
      wrapStore();
      clearInterval(boot);
      setTimeout(weeklyGrant, 4000);
    }
    if (bootTries > 40) clearInterval(boot);
  }, 1000);
})();
