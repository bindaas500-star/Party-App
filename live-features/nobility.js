/* ============================================================
   Party App — Live Features: Nobility 👑
   VIP se upar paid titles — Mico/Bigo style.
   Title khareedo → naam ke saath badge, room me dhamakedaar entry!

   Titles (30 din ke liye):
     🛡️ Knight → 🏵️ Baron → 🎖️ Viscount → 🏅 Earl
     💜 Duke → 👑 King → 🌟 Emperor

   Firebase: users/{uid}/nobility = { titleId, expiresAt }
   ------------------------------------------------------------
   ADAPTER:
     Nobility.getUser() → { id, name }
     Nobility.spendGems(uid, amount) → true/false
   Entry effect: room enter par NobleEntry.show(title, name)
   ============================================================ */
(function () {
  'use strict';

  var N = window.Nobility = {};

  var TITLES = [
    { id: 'knight',   name: 'Knight',   emoji: '🛡️', price: 500,   color: '#9fb3c8', perks: ['Special badge', 'Room entry notice'] },
    { id: 'baron',    name: 'Baron',    emoji: '🏵️', price: 1500,  color: '#7fd08a', perks: ['Knight perks', 'Golden chat name'] },
    { id: 'viscount', name: 'Viscount', emoji: '🎖️', price: 3000,  color: '#4fc3ff', perks: ['Baron perks', 'Exclusive frame'] },
    { id: 'earl',     name: 'Earl',     emoji: '🏅', price: 6000,  color: '#c86bff', perks: ['Viscount perks', 'Entry animation'] },
    { id: 'duke',     name: 'Duke',     emoji: '💜', price: 12000, color: '#b366ff', perks: ['Earl perks', 'Duke banner entry', 'Kick protection'] },
    { id: 'king',     name: 'King',     emoji: '👑', price: 30000, color: '#ffd76a', perks: ['Duke perks', 'Full-screen King entry', 'Room announcement'] },
    { id: 'emperor',  name: 'Emperor',  emoji: '🌟', price: 80000, color: '#ff6ec4', perks: ['King perks', 'Emperor entry + fireworks', 'Top of member list'] },
  ];
  var DAY = 24 * 60 * 60 * 1000;

  /* ---------------- ADAPTER ---------------- */
  N.getUser = function () {
    return { id: window.currentUserId || (window.currentUser && window.currentUser.uid) || 'demo',
             name: window.currentUserName || (window.currentUserData && window.currentUserData.name) || 'Guest' };
  };
  N.spendGems = function (uid, amount) {
    if (window.spendGemsOfUser) return window.spendGemsOfUser(uid, amount);
    console.log('[Nobility] -' + amount + ' gems →', uid);
    return true; // demo
  };
  N._save = function (uid, data) {
    var d = window.db || (window.firebase && firebase.database());
    if (d) d.ref('users/' + uid + '/nobility').set(data);
    else { try { localStorage.setItem('nobility_' + uid, JSON.stringify(data)); } catch (e) {} }
  };
  N._load = function (uid, cb) {
    var d = window.db || (window.firebase && firebase.database());
    if (d) d.ref('users/' + uid + '/nobility').once('value').then(function (s) { cb(s.val()); });
    else { try { cb(JSON.parse(localStorage.getItem('nobility_' + uid) || 'null')); } catch (e) { cb(null); } }
  };

  N.titles = function () { return TITLES; };
  N.get = function (id) { return TITLES.find(function (t) { return t.id === id; }); };

  // User ka active title (expired nahi)
  N.myTitle = function (cb) {
    var u = N.getUser();
    N._load(u.id, function (n) {
      if (n && n.expiresAt > Date.now()) cb(N.get(n.titleId), n);
      else cb(null, null);
    });
  };

  // Title khareedo (ya renew karo)
  N.buy = function (titleId) {
    var t = N.get(titleId); if (!t) return;
    var u = N.getUser();
    if (!confirm(t.emoji + ' ' + t.name + ' — ' + t.price + ' gems (30 din)?')) return;
    if (!N.spendGems(u.id, t.price)) { alert('Gems kam hain! 💎'); return; }
    N._load(u.id, function (cur) {
      var base = (cur && cur.expiresAt > Date.now()) ? cur.expiresAt : Date.now();
      N._save(u.id, { titleId: titleId, expiresAt: base + 30 * DAY });
      alert(t.emoji + ' Mubarak! Ab tum ' + t.name + ' ho 👑');
      N.renderStore();
    });
  };

  /* ============ ENTRY EFFECT ============ */
  // Room enter par lagao: N.onEnterRoom()
  N.onEnterRoom = function () {
    N.myTitle(function (t, n) {
      if (!t) return;
      NobleEntry.show(t, N.getUser().name);
      // TODO: Firebase me room members ko broadcast (room notice)
    });
  };

  var NobleEntry = {
    show: function (title, userName) {
      var ov = document.createElement('div');
      ov.className = 'noble-entry';
      ov.innerHTML =
        '<div class="noble-inner">' +
          '<div class="noble-emoji">' + title.emoji + '</div>' +
          '<div class="noble-title" style="color:' + title.color + '">' + title.name.toUpperCase() + '</div>' +
          '<div class="noble-user">' + escapeHtml(userName) + '</div>' +
          '<div class="noble-sub">room me tashreef laaye hain ✨</div>' +
        '</div>';
      document.body.appendChild(ov);
      requestAnimationFrame(function () { ov.classList.add('show'); });
      setTimeout(function () {
        ov.classList.remove('show');
        setTimeout(function () { ov.remove(); }, 600);
      }, 2600);
    }
  };

  /* ============ STORE UI ============ */
  N.openStore = function () { N.renderStore(true); };
  N.renderStore = function (show) {
    var p = document.getElementById('noblePanel');
    if (!p) {
      p = document.createElement('div');
      p.id = 'noblePanel'; p.className = 'noble-panel';
      document.body.appendChild(p);
    }
    var u = N.getUser();
    N._load(u.id, function (cur) {
      var curId = (cur && cur.expiresAt > Date.now()) ? cur.titleId : null;
      var days = cur && cur.expiresAt > Date.now() ? Math.ceil((cur.expiresAt - Date.now()) / DAY) : 0;
      p.innerHTML =
        '<div class="mg-head"><b>👑 Nobility Store</b><button onclick="document.getElementById(\'noblePanel\').classList.remove(\'show\')">✕</button></div>' +
        (curId ? '<div class="noble-cur">Tumhara title: <b>' + N.get(curId).emoji + ' ' + N.get(curId).name + '</b> (' + days + ' din baqi)</div>' : '') +
        TITLES.map(function (t) {
          var owned = curId === t.id;
          return '<div class="noble-row">' +
            '<div class="noble-ric">' + t.emoji + '</div>' +
            '<div class="noble-rinfo"><b style="color:' + t.color + '">' + t.name + '</b>' +
            '<small>' + t.perks.slice(0, 2).join(' • ') + '</small></div>' +
            '<button class="noble-buy" ' + (owned ? 'disabled' : '') +
            ' onclick="Nobility.buy(\'' + t.id + '\')">' +
            (owned ? 'Active ✓' : '💎 ' + t.price) + '</button></div>';
        }).join('');
      if (show) p.classList.add('show');
    });
  };

  // Naam ke saath badge — chat/member list me istemal karo:
  // Nobility.badgeHtml(titleId) → '<span class="noble-badge">👑</span>'
  N.badgeHtml = function (titleId) {
    var t = N.get(titleId); if (!t) return '';
    return '<span class="noble-badge" style="border-color:' + t.color + '" title="' + t.name + '">' + t.emoji + '</span>';
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  console.log('[live-features] Nobility ready 👑');
})();
