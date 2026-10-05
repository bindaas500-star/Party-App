/* ============================================================
   Live Features — Room Hooks (v2: interval-driven, robust)
   - Toolbar room khulne/band hone par KHUD show/hide hota hai
   - enterRoom ke wrapper par depend nahi karta
   ============================================================ */
(function () {
  'use strict';

  var CSS = [
    '.lf-toolbar{position:fixed;right:12px;bottom:calc(var(--bottomnav-height,66px) + 18px);',
    'z-index:8000;display:none;flex-direction:column;gap:10px;}',
    '.lf-toolbar button{width:52px;height:52px;border-radius:16px;border:1px solid rgba(255,255,255,.25);',
    'background:rgba(20,12,28,.82);backdrop-filter:blur(8px);font-size:24px;color:#fff;cursor:pointer;',
    'box-shadow:0 6px 18px rgba(0,0,0,.45);transition:transform .15s ease;}',
    '.lf-toolbar button:active{transform:scale(.9);}'
  ].join('\n');

  function injectCss() {
    if (document.getElementById('lfToolbarCss')) return;
    var s = document.createElement('style');
    s.id = 'lfToolbarCss';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function ensureToolbar() {
    var t = document.getElementById('lfToolbar');
    if (t) return t;
    t = document.createElement('div');
    t.id = 'lfToolbar';
    t.className = 'lf-toolbar';
    t.innerHTML =
      '<button onclick="MiniGames.open(\'dice\')" title="Mini Games">\uD83C\uDFAE</button>' +
      '<button onclick="Nobility.openStore()" title="Nobility">\uD83D\uDC51</button>';
    document.body.appendChild(t);
    return t;
  }

  function roomIsOpen() {
    var v = document.getElementById('roomInsideView');
    return !!(v && v.style && v.style.display !== 'none');
  }

  function currentRoomIdSafe() {
    try {
      if (typeof currentRoomId !== 'undefined' && currentRoomId) return currentRoomId;
    } catch (e) {}
    return null;
  }
  function currentUserSafe() {
    try {
      if (typeof currentUser !== 'undefined' && currentUser) return currentUser;
      if (typeof currentUserData !== 'undefined' && currentUserData) return currentUserData;
    } catch (e) {}
    return null;
  }

  var wasInRoom = false;
  var pkStartedFor = null;

  function onRoomOpened() {
    var rid = currentRoomIdSafe();
    var u = currentUserSafe();
    // PK battle listener (sirf ek dafa per room)
    try {
      if (window.PKBattle && rid && pkStartedFor !== rid) {
        pkStartedFor = rid;
        PKBattle.startListener(rid);
      }
    } catch (e) {}
    // Nobility entry effect
    try {
      if (window.Nobility && u) Nobility.playEntry(u.uid || u.id);
    } catch (e) {}
  }

  function sync() {
    var inRoom = roomIsOpen();
    ensureToolbar();
    var t = document.getElementById('lfToolbar');
    if (t) t.style.display = inRoom ? 'flex' : 'none';
    if (inRoom && !wasInRoom) onRoomOpened();
    if (!inRoom) pkStartedFor = null;
    wasInRoom = inRoom;
  }

  injectCss();
  // Room state har 800ms check karo — kisi wrapper par depend nahi
  setInterval(sync, 800);
  // Page load ke baad bhi kuch dafa check (late render ke liye)
  setTimeout(sync, 1200);
  setTimeout(sync, 3000);
  setTimeout(sync, 6000);
  // Tab switch / visibility wapas aane par bhi sync
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) sync();
  });
})();
