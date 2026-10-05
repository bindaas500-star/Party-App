/* ============================================================
   Party App — Live Features: Treasure Box
   Room me waqt par zahir hone wala reward box — users ko
   room me ruke rehne ki wajah deta hai (Bigo/Mico style).

   Flow:
     1. Room owner (ya auto-timer) box start karta hai
     2. Sab ko box nazar aata hai + countdown
     3. Tap karne par random coins (pehle aao pehle pao / sab ko)
     4. Box khatam → winner list

   ------------------------------------------------------------
   ADAPTER — apni app ke hisaab se ye functions bharnay hain:
     TB.getRoomId()   → current room ka id
     TB.getUser()     → { id, name } current user ka
     TB.addCoins(uid, amount) → user ko coins do (Firebase)
     TB.broadcast(box) / TB.onBoxUpdate(cb) → Firebase sync
   Default me local-only demo mode hai (bina Firebase ke chalta hai).
   ============================================================ */
(function () {
  'use strict';

  var TB = window.TreasureBox = {};

  /* ---------------- ADAPTER (fill in) ---------------- */
  TB.getRoomId = function () { return (window.currentRoomId || 'demo-room'); };
  TB.getUser = function () {
    return { id: (window.currentUserId || 'demo-user'), name: (window.currentUserName || 'Guest') };
  };
  // coins dena — Firebase lagne ke baad yahan real logic aayegi
  TB.addCoins = function (uid, amount) {
    console.log('[TreasureBox] +' + amount + ' coins →', uid);
    if (window.addCoinsToUser) window.addCoinsToUser(uid, amount);
  };
  // multi-user sync — Firebase lagne par broadcast/onUpdate lagao
  var updateCbs = [];
  TB.onBoxUpdate = function (cb) { updateCbs.push(cb); };
  TB._emit = function (box) { updateCbs.forEach(function (cb) { try { cb(box); } catch (e) {} }); };

  /* ---------------- state ---------------- */
  var box = null;   // { id, totalCoins, perUser, endsAt, claimedBy:{uid:{name,amount}}, startedBy }
  var timer = null;
  var el = null;

  function ensureEl() {
    if (el) return;
    el = document.createElement('div');
    el.className = 'tbox-wrap';
    el.innerHTML =
      '<div class="tbox-box" id="tboxBox">' +
        '<div class="tbox-emoji">🎁</div>' +
        '<div class="tbox-timer" id="tboxTimer"></div>' +
        '<div class="tbox-label" id="tboxLabel"></div>' +
      '</div>' +
      '<div class="tbox-result" id="tboxResult"></div>';
    document.body.appendChild(el);
    el.querySelector('#tboxBox').addEventListener('click', claim);
  }

  /* ---------------- public API ---------------- */

  // Box start karo (owner ya auto-timer se)
  TB.start = function (opts) {
    opts = opts || {};
    var me = TB.getUser();
    box = {
      id: 'tb' + Date.now(),
      totalCoins: opts.totalCoins || 1000,
      perUser: opts.perUser || 50,
      endsAt: Date.now() + (opts.durationSec || 60) * 1000,
      claimedBy: {},
      startedBy: opts.startedBy || me.name
    };
    ensureEl();
    el.classList.add('show');
    el.querySelector('#tboxResult').classList.remove('show');
    el.querySelector('#tboxBox').classList.remove('opened');
    TB._emit(box);
    tick();
    clearInterval(timer);
    timer = setInterval(tick, 500);
  };

  // Remote update aayi (doosre user ne start/claim kiya)
  TB.applyRemote = function (remoteBox) {
    box = remoteBox;
    ensureEl();
    el.classList.add('show');
    tick();
    clearInterval(timer);
    timer = setInterval(tick, 500);
  };

  TB.hide = function () {
    clearInterval(timer);
    if (el) el.classList.remove('show');
    box = null;
  };

  /* ---------------- internal ---------------- */

  function tick() {
    if (!box) return;
    var left = Math.max(0, Math.ceil((box.endsAt - Date.now()) / 1000));
    var timerEl = el.querySelector('#tboxTimer');
    var labelEl = el.querySelector('#tboxLabel');
    var me = TB.getUser();
    if (left <= 0) { endBox(); return; }
    timerEl.textContent = left + 's';
    if (box.claimedBy[me.id]) {
      labelEl.textContent = '+' + box.claimedBy[me.id].amount + ' coins mil gaye! 🎉';
      el.querySelector('#tboxBox').classList.add('opened');
    } else {
      labelEl.textContent = 'Tap karo — ' + box.perUser + ' coins!';
    }
  }

  function claim() {
    if (!box) return;
    var me = TB.getUser();
    if (box.claimedBy[me.id]) return;             // ek dafa hi
    if (Date.now() > box.endsAt) { endBox(); return; }
    var amount = box.perUser + Math.floor(Math.random() * box.perUser); // thoda random
    box.claimedBy[me.id] = { name: me.name, amount: amount };
    TB.addCoins(me.id, amount);
    TB._emit(box);
    tick();
    // chhoti celebration
    if (window.GiftFX) { /* halki si khushi — GiftFX optional */ }
  }

  function endBox() {
    clearInterval(timer);
    var winners = Object.keys(box.claimedBy).map(function (uid) {
      return box.claimedBy[uid];
    }).sort(function (a, b) { return b.amount - a.amount; }).slice(0, 5);
    var resEl = el.querySelector('#tboxResult');
    resEl.innerHTML = '<div class="tbox-rtitle">🎁 Box khatam!</div>' +
      (winners.length
        ? winners.map(function (w, i) {
            return '<div class="tbox-rrow">' + (i + 1) + '. ' + escapeHtml(w.name) +
                   ' <b>+' + w.amount + '</b></div>';
          }).join('')
        : '<div class="tbox-rrow">Kisi ne claim nahi kiya 😅</div>') +
      '<button class="tbox-close" onclick="TreasureBox.hide()">Band karo</button>';
    resEl.classList.add('show');
    el.querySelector('#tboxBox').classList.add('opened');
    el.querySelector('#tboxLabel').textContent = 'Waqt khatam!';
    TB._emit(box);
    setTimeout(TB.hide, 15000); // 15s baad auto-hide
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Auto treasure box: har N minute baad khud start (owner setting)
  TB.autoStart = function (everyMin, totalCoins, perUser) {
    setInterval(function () {
      if (!box) TB.start({ totalCoins: totalCoins || 1000, perUser: perUser || 50, durationSec: 60, startedBy: 'System 🤖' });
    }, (everyMin || 15) * 60 * 1000);
  };
})();
