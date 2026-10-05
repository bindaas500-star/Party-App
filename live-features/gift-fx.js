/* ============================================================
   Party App — Live Features: GiftFX (animated gifts)
   Bigo Live / Mico style full-screen gift animations.
   Koi external asset nahi — sab canvas + emoji se banta hai.

   Istemal:
     GiftFX.play({ id:'dragon', name:'Dragon', emoji:'🐉',
                   price: 999, sender: 'Imran' });

   Tiers (price ke hisaab se, badal sakte ho):
     <100 coins   → chhoti animation (banner + emoji pop)
     100–999     → full-screen fly-in + particles
     1000+       → full-screen + flash + screen shake + combo
   ============================================================ */
(function () {
  'use strict';

  var TIERS = { mini: 100, premium: 1000 };

  var queue = [];
  var playing = false;
  var overlay = null;
  var canvas = null;
  var ctx = null;

  /* ---------- overlay setup ---------- */
  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'giftfx-overlay';
    overlay.innerHTML =
      '<canvas class="giftfx-canvas"></canvas>' +
      '<div class="giftfx-banner">' +
        '<div class="giftfx-sender"></div>' +
        '<div class="giftfx-emoji"></div>' +
        '<div class="giftfx-name"></div>' +
        '<div class="giftfx-combo"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    canvas = overlay.querySelector('.giftfx-canvas');
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    overlay.addEventListener('click', function () { finish(true); });
  }

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
    canvas.height = window.innerHeight * (window.devicePixelRatio || 1);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }

  /* ---------- particles ---------- */
  var particles = [];
  function burst(x, y, colors, n, speed) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = (0.3 + Math.random() * 0.7) * (speed || 8);
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2,
        life: 1, decay: 0.008 + Math.random() * 0.012,
        size: 3 + Math.random() * 7,
        color: colors[(Math.random() * colors.length) | 0],
        shape: Math.random() < 0.3 ? 'star' : 'circle'
      });
    }
  }
  function confettiRain(colors, n) {
    var W = canvas.width, dpr = window.devicePixelRatio || 1;
    for (var i = 0; i < n; i++) {
      particles.push({
        x: Math.random() * W, y: -20,
        vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 4,
        life: 1, decay: 0.004,
        size: 4 + Math.random() * 8,
        color: colors[(Math.random() * colors.length) | 0],
        shape: 'rect', rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.2,
        dpr: dpr
      });
    }
  }

  var rafId = null;
  function loop() {
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    particles = particles.filter(function (p) { return p.life > 0; });
    particles.forEach(function (p) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= p.decay;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      if (p.shape === 'star') {
        drawStar(p.x, p.y, p.size, p.life);
      } else if (p.shape === 'rect') {
        ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); p.rot += p.vr || 0;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, 6.29); ctx.fill();
      }
      ctx.restore();
    });
    if (particles.length || playing) {
      rafId = requestAnimationFrame(loop);
    } else { rafId = null; }
  }
  function drawStar(x, y, r, alpha) {
    ctx.beginPath();
    for (var i = 0; i < 5; i++) {
      var a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  }
  function kick() { if (!rafId) loop(); }

  /* ---------- main play ---------- */
  var timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function play(gift) {
    queue.push(gift);
    if (!playing) next();
  }

  function tierOf(price) {
    if (price >= TIERS.premium) return 'luxury';
    if (price >= TIERS.mini) return 'premium';
    return 'mini';
  }

  function next() {
    var gift = queue.shift();
    if (!gift) { playing = false; return; }
    playing = true;
    ensureOverlay();

    var tier = tierOf(gift.price || 0);
    var W = window.innerWidth, H = window.innerHeight;

    overlay.querySelector('.giftfx-sender').textContent = gift.sender || '';
    overlay.querySelector('.giftfx-emoji').textContent = gift.emoji || '🎁';
    overlay.querySelector('.giftfx-name').textContent = (gift.name || 'Gift') + ' ×' + (gift.count || 1);
    var comboEl = overlay.querySelector('.giftfx-combo');
    comboEl.textContent = gift.combo > 1 ? 'COMBO ×' + gift.combo : '';
    comboEl.style.display = gift.combo > 1 ? 'block' : 'none';

    overlay.classList.remove('show', 'luxury', 'premium', 'mini');
    void overlay.offsetWidth; // restart CSS animation
    overlay.classList.add('show', tier);

    var cx = (canvas.width / 2), cy = (canvas.height / 2);
    var gold = ['#ffd76a', '#ffb52e', '#fff3c4', '#ff8a3d'];
    var pink = ['#ff6ec4', '#c86bff', '#ffd6f2', '#ff9e7d'];

    if (tier === 'mini') {
      burst(cx, cy - 60, gold, 40, 6);
      kick();
      later(function () { finish(false); }, 1800);
    } else {
      // premium / luxury: fly-in + particle storm
      burst(cx, cy, tier === 'luxury' ? pink : gold, 90, 10);
      kick();
      later(function () { burst(cx * 0.3, cy * 0.6, gold, 50, 8); kick(); }, 500);
      later(function () { burst(cx * 1.7, cy * 0.5, gold, 50, 8); kick(); }, 900);
      if (tier === 'luxury') {
        later(function () { confettiRain(pink.concat(gold), 120); kick(); }, 400);
        document.body.classList.add('giftfx-shake');
        later(function () { document.body.classList.remove('giftfx-shake'); }, 900);
      }
      later(function () { finish(false); }, tier === 'luxury' ? 3800 : 3000);
    }
  }

  function finish(skipped) {
    timers.forEach(clearTimeout); timers = [];
    document.body.classList.remove('giftfx-shake');
    if (overlay) {
      overlay.classList.add('hide');
      setTimeout(function () {
        overlay.classList.remove('show', 'hide', 'luxury', 'premium', 'mini');
        particles = [];
        playing = false;
        next();
      }, skipped ? 0 : 250);
    } else { playing = false; next(); }
  }

  /* public API */
  window.GiftFX = {
    play: play,
    setTiers: function (mini, premium) { TIERS.mini = mini; TIERS.premium = premium; },
    queueLength: function () { return queue.length + (playing ? 1 : 0); }
  };
})();
