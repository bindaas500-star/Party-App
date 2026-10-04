/* ============================================================
   Party App — Native Feel Pack (JS)
   Ise </body> se PEHLE script tag me lagao:
     <script src="native-feel.js"></script>
   Tumhare existing functions ko wrap karta hai — unme koi
   change nahi karta.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. Tab switch direction (slide left/right) ---------- */
  var TAB_ORDER = ['messages', 'moments', 'hifami', 'room', 'family'];
  var lastTab = 'hifami';

  function setDirection(nextTab) {
    var wrap = document.getElementById('panelsWrap');
    if (!wrap) return;
    var a = TAB_ORDER.indexOf(lastTab);
    var b = TAB_ORDER.indexOf(nextTab);
    // Pehli dafa ya unknown tab: default direction
    wrap.dataset.dir = (a === -1 || b === -1 || b >= a) ? 'fwd' : 'back';
    lastTab = nextTab;
  }

  // switchTab global hai (onclick me use hota hai) — ise wrap karo
  if (typeof window.switchTab === 'function') {
    var originalSwitchTab = window.switchTab;
    window.switchTab = function (tab) {
      setDirection(tab);
      return originalSwitchTab.apply(this, arguments);
    };
  } else {
    // Agar switchTab abhi load nahi hua, thoda wait karo
    var tries = 0;
    var timer = setInterval(function () {
      if (typeof window.switchTab === 'function' || ++tries > 50) {
        clearInterval(timer);
        if (typeof window.switchTab === 'function') {
          var orig = window.switchTab;
          window.switchTab = function (tab) {
            setDirection(tab);
            return orig.apply(this, arguments);
          };
        }
      }
    }, 100);
  }

  /* ---------- 2. Ripple — nav items aur buttons par ---------- */
  function addRipple(el, x, y) {
    var rect = el.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height);
    var span = document.createElement('span');
    span.className = 'ripple';
    span.style.width = span.style.height = size + 'px';
    span.style.left = (x - rect.left - size / 2) + 'px';
    span.style.top = (y - rect.top - size / 2) + 'px';
    el.appendChild(span);
    setTimeout(function () { span.remove(); }, 500);
  }

  document.addEventListener('pointerdown', function (e) {
    var target = e.target.closest('.nav-item, .btn');
    if (target) addRipple(target, e.clientX, e.clientY);
  }, { passive: true });

  /* ---------- 3. Double-tap zoom band (mobile browser-ism) ---------- */
  var lastTouchEnd = 0;
  document.addEventListener('touchend', function (e) {
    var now = Date.now();
    if (now - lastTouchEnd < 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
})();
