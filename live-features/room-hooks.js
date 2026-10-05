/* ============================================================
   Party App — Live Features: room hooks
   Room enter/exit par features ko jorna + floating toolbar.

   - enterRoom wrap: PK listeners + Nobility entry effect + toolbar show
   - leaveRoomToBrowse wrap: cleanup + toolbar hide
   - Toolbar: 🎮 Mini Games, 👑 Nobility (sirf room ke andar nazar aata hai)
   ============================================================ */
(function () {
  'use strict';

  /* ---------- floating toolbar ---------- */
  var CSS = [
    '.lf-toolbar{position:fixed;right:12px;bottom:calc(var(--bottomnav-height,66px) + 18px);',
    'z-index:8000;display:none;flex-direction:column;gap:10px;}',
    '.lf-toolbar button{width:52px;height:52px;border-radius:50%;border:2px solid rgba(255,215,106,.5);',
    'background:linear-gradient(135deg,#3a1c5e,#1c1030);font-size:24px;cursor:pointer;',
    'box-shadow:0 4px 16px rgba(0,0,0,.45);transition:transform .12s;}',
    '.lf-toolbar button:active{transform:scale(.9);}'
  ].join('');
  function injectCss() {
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function ensureToolbar() {
    if (document.getElementById('lfToolbar')) return;
    var t = document.createElement('div');
    t.id = 'lfToolbar';
    t.className = 'lf-toolbar';
    t.innerHTML =
      '<button onclick="MiniGames.open(\'dice\')" title="Mini Games">🎮</button>' +
      '<button onclick="Nobility.openStore()" title="Nobility">👑</button>';
    document.body.appendChild(t);
  }

  function showToolbar(v) {
    ensureToolbar();
    var t = document.getElementById('lfToolbar');
    if (t) t.style.display = v ? 'flex' : 'none';
  }

  injectCss();

  /* ---------- enter/leave hooks ---------- */
  function afterEnter() {
    showToolbar(true);
    // Room data load hone do, phir listeners lagao
    setTimeout(function () {
      try { if (window.PKBattle) PKBattle.onEnterRoom(); } catch (e) {}
      try { if (window.Nobility) Nobility.onEnterRoom(); } catch (e) {}
    }, 1500);
  }

  if (typeof enterRoom === 'function') {
    var _enterRoom = enterRoom;
    enterRoom = function () {
      var r = _enterRoom.apply(this, arguments);
      afterEnter();
      return r;
    };
  } else {
    var tries = 0;
    var iv = setInterval(function () {
      if (typeof enterRoom === 'function' || ++tries > 60) {
        clearInterval(iv);
        if (typeof enterRoom === 'function') {
          var _er = enterRoom;
          enterRoom = function () { var r = _er.apply(this, arguments); afterEnter(); return r; };
        }
      }
    }, 500);
  }

  function beforeLeave() {
    showToolbar(false);
    try { if (window.PKBattle) PKBattle.onExitRoom(); } catch (e) {}
  }

  if (typeof leaveRoomToBrowse === 'function') {
    var _leave = leaveRoomToBrowse;
    leaveRoomToBrowse = function () {
      beforeLeave();
      return _leave.apply(this, arguments);
    };
  }

  // Page reload par agar pehle se room me tha
  setTimeout(function () {
    if (window.currentRoomId) afterEnter();
  }, 3000);

  console.log('[live-features] room hooks ready ✅');
})();
