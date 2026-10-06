/* ============================================================
   Resilience Pack (audit Sec 25, 26)
   - Offline/Online/Reconnecting indicator (Firebase .info/connected)
   - Leaderboard watchdog: 12s me data na aaye to
     "Unable to load data. Tap Retry." + Retry button
   - Koi infinite spinner nahi
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. Connection indicator ---------- */
  function ensureBadge() {
    var b = document.getElementById('pfxConnBadge');
    if (b) return b;
    b = document.createElement('div');
    b.id = 'pfxConnBadge';
    b.className = 'pfx-conn pfx-conn-online';
    b.innerHTML = '<span class="pfx-conn-dot"></span><span class="pfx-conn-text">Online</span>';
    document.body.appendChild(b);
    return b;
  }

  function setConn(state) {
    var b = ensureBadge();
    b.className = 'pfx-conn pfx-conn-' + state;
    var t = b.querySelector('.pfx-conn-text');
    if (t) t.textContent = state === 'online' ? 'Online' : (state === 'offline' ? 'Offline' : 'Reconnecting…');
  }

  function installIndicator() {
    ensureBadge();
    var onlineNow = function () { setConn(navigator.onLine ? 'online' : 'offline'); };
    window.addEventListener('online', onlineNow);
    window.addEventListener('offline', onlineNow);
    // Firebase realtime connection state (more truthful than navigator.onLine)
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      try {
        if (typeof db === 'undefined') { if (tries > 40) clearInterval(t); return; }
        clearInterval(t);
        db.ref('.info/connected').on('value', function (snap) {
          if (snap.val() === true) {
            setConn('online');
          } else {
            setConn(navigator.onLine ? 'reconnecting' : 'offline');
          }
        });
      } catch (e) {}
    }, 1000);
    onlineNow();
  }

  /* ---------- 2. Leaderboard watchdog ---------- */
  function wrapLeaderboard() {
    if (typeof loadLeaderboard !== 'function') return false;
    var _orig = loadLeaderboard;
    var watchdog = null;
    loadLeaderboard = function () {
      _orig();
      try {
        if (watchdog) clearTimeout(watchdog);
        var listEl = document.getElementById('rankList');
        if (!listEl) return;
        watchdog = setTimeout(function () {
          try {
            var stillLoading = listEl.querySelector('.loading') &&
              listEl.textContent.indexOf('Loading leaderboard') >= 0;
            if (!stillLoading) return;
            listEl.innerHTML =
              '<div class="pfx-empty">' +
              '<div class="pfx-empty-title">Unable to load data.</div>' +
              '<div class="pfx-empty-sub">Check your connection and try again.</div>' +
              '<button class="pfx-retry-btn" id="pfxRankRetry">Tap Retry</button>' +
              '</div>';
            var btn = document.getElementById('pfxRankRetry');
            if (btn) btn.onclick = function () { loadLeaderboard(); };
          } catch (e) {}
        }, 12000);
      } catch (e) {}
    };
    return true;
  }

  /* ---------- boot ---------- */
  installIndicator();
  var tries = 0;
  var boot = setInterval(function () {
    tries++;
    if (wrapLeaderboard()) clearInterval(boot);
    if (tries > 40) clearInterval(boot);
  }, 1000);
})();
