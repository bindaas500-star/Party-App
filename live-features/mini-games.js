/* ============================================================
   Party App — Live Features: Mini Games (room ke andar)
   1. Dice Roll — sab roll karte hain, sab se bara jeetta hai
   2. Lucky Wheel — ghumao, jeeto coins

   ------------------------------------------------------------
   ADAPTER — apni app ke hisaab se ye functions bharnay hain:
     MG.getRoomId() / MG.getUser()  (TreasureBox jaisa)
     MG.addCoins(uid, amount)
     MG.spendCoins(uid, amount) → true/false (balance check)
   Default local demo mode hai.
   ============================================================ */
(function () {
  'use strict';

  var MG = window.MiniGames = {};

  /* ---------------- ADAPTER ---------------- */
  MG.getRoomId = function () { return window.currentRoomId || 'demo-room'; };
  MG.getUser = function () {
    return { id: window.currentUserId || 'demo-user', name: window.currentUserName || 'Guest' };
  };
  MG.addCoins = function (uid, amount) {
    console.log('[MiniGames] +' + amount + ' coins →', uid);
    if (window.addCoinsToUser) window.addCoinsToUser(uid, amount);
  };
  MG.spendCoins = function (uid, amount) {
    if (window.spendCoinsOfUser) return window.spendCoinsOfUser(uid, amount);
    console.log('[MiniGames] -' + amount + ' coins →', uid);
    return true; // demo: hamesha kaamyaab
  };

  /* ============ DICE ROLL ============ */
  var dice = { players: {}, roundId: null };

  // Round start karo (koi bhi room me)
  MG.diceStart = function () {
    dice.roundId = 'dice' + Date.now();
    dice.players = {};
    MG.diceRender();
    showPanel('dice');
  };

  MG.diceRoll = function () {
    var me = MG.getUser();
    if (dice.players[me.id]) return; // ek round me ek dafa
    var v = 1 + Math.floor(Math.random() * 6);
    dice.players[me.id] = { name: me.name, roll: v };
    MG.diceRender(true);
    // sab ne roll kar liya? (kam az kam 2 players par result)
    var ids = Object.keys(dice.players);
    if (ids.length >= 2) {
      setTimeout(MG.diceFinish, 1200);
    }
  };

  MG.diceFinish = function () {
    var ids = Object.keys(dice.players);
    if (!ids.length) return;
    var win = ids.sort(function (a, b) { return dice.players[b].roll - dice.players[a].roll; })[0];
    var w = dice.players[win];
    var prize = 20 * ids.length;
    MG.addCoins(win, prize);
    var list = document.getElementById('mgDiceList');
    if (list) {
      list.innerHTML += '<div class="mg-winner">🏆 ' + esc(w.name) + ' jeet gaya! +' + prize + ' coins</div>';
    }
    dice.roundId = null;
  };

  MG.diceRender = function (anim) {
    var list = document.getElementById('mgDiceList');
    if (!list) return;
    var ids = Object.keys(dice.players);
    list.innerHTML = ids.length
      ? ids.map(function (id) {
          var p = dice.players[id];
          return '<div class="mg-prow"><span>' + esc(p.name) + '</span>' +
                 '<span class="mg-dice' + (anim ? ' rolling' : '') + '">' + diceEmoji(p.roll) + '</span></div>';
        }).join('')
      : '<div class="mg-empty">Abhi kisi ne roll nahi kiya — pehle tum karo! 🎲</div>';
  };

  function diceEmoji(v) { return ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][v - 1]; }

  /* ============ LUCKY WHEEL ============ */
  var wheelPrizes = [10, 25, 50, 100, 250, 500, 25, 10];
  var spinning = false;

  MG.wheelSpin = function () {
    if (spinning) return;
    var me = MG.getUser();
    var cost = 20;
    if (!MG.spendCoins(me.id, cost)) { toast('Coins kam hain!'); return; }
    spinning = true;
    var wheel = document.getElementById('mgWheel');
    var idx = Math.floor(Math.random() * wheelPrizes.length);
    var prize = wheelPrizes[idx];
    // wheel ko prize wali position par ghumao (3 full turns + offset)
    var seg = 360 / wheelPrizes.length;
    var target = 1080 + (360 - idx * seg - seg / 2);
    if (wheel) {
      wheel.style.transition = 'transform 3.2s cubic-bezier(.15,.85,.25,1)';
      wheel.style.transform = 'rotate(' + target + 'deg)';
    }
    setTimeout(function () {
      spinning = false;
      MG.addCoins(me.id, prize);
      toast('🎉 +' + prize + ' coins jeet liye!');
      var log = document.getElementById('mgWheelLog');
      if (log) log.innerHTML = '<div class="mg-winner">🎡 ' + esc(me.name) + ' ne <b>+' + prize + '</b> jeeta!</div>' + log.innerHTML;
      if (wheel) { wheel.style.transition = 'none'; wheel.style.transform = 'rotate(0deg)'; }
    }, 3400);
  };

  MG.wheelRender = function () {
    var wheel = document.getElementById('mgWheel');
    if (!wheel || wheel.children.length) return;
    var colors = ['#ffb52e', '#c86bff', '#ff6ec4', '#4fc3ff'];
    wheelPrizes.forEach(function (p, i) {
      var seg = document.createElement('div');
      seg.className = 'mg-seg';
      seg.style.transform = 'rotate(' + (i * 45) + 'deg)';
      seg.style.background = colors[i % colors.length];
      seg.innerHTML = '<span>' + p + '</span>';
      wheel.appendChild(seg);
    });
  };

  /* ============ panel ============ */
  function showPanel(game) {
    var p = document.getElementById('mgPanel');
    if (!p) {
      p = document.createElement('div');
      p.id = 'mgPanel';
      p.className = 'mg-panel';
      p.innerHTML =
        '<div class="mg-head"><b>🎮 Mini Games</b>' +
        '<button onclick="MiniGames.close()">✕</button></div>' +
        '<div class="mg-tabs">' +
          '<button id="mgTabDice" onclick="MiniGames.tab(\'dice\')">🎲 Dice</button>' +
          '<button id="mgTabWheel" onclick="MiniGames.tab(\'wheel\')">🎡 Wheel</button>' +
        '</div>' +
        '<div class="mg-body" id="mgDice">' +
          '<div id="mgDiceList"></div>' +
          '<button class="mg-bigbtn" onclick="MiniGames.diceRoll()">🎲 ROLL</button>' +
          '<button class="mg-linkbtn" onclick="MiniGames.diceStart()">Naya round</button>' +
        '</div>' +
        '<div class="mg-body" id="mgWheelWrap" style="display:none">' +
          '<div class="mg-wheel-outer"><div class="mg-wheel" id="mgWheel"></div><div class="mg-pin">🔻</div></div>' +
          '<button class="mg-bigbtn" onclick="MiniGames.wheelSpin()">SPIN (20 coins)</button>' +
          '<div id="mgWheelLog"></div>' +
        '</div>';
      document.body.appendChild(p);
      MG.wheelRender();
    }
    p.classList.add('show');
    MG.tab(game || 'dice');
  }

  MG.open = function (game) { showPanel(game || 'dice'); };
  MG.close = function () {
    var p = document.getElementById('mgPanel');
    if (p) p.classList.remove('show');
  };
  MG.tab = function (which) {
    document.getElementById('mgDice').style.display = which === 'dice' ? 'block' : 'none';
    document.getElementById('mgWheelWrap').style.display = which === 'wheel' ? 'block' : 'none';
    document.getElementById('mgTabDice').classList.toggle('active', which === 'dice');
    document.getElementById('mgTabWheel').classList.toggle('active', which === 'wheel');
    if (which === 'dice') MG.diceRender();
  };

  function toast(msg) {
    if (window.showToast) window.showToast(msg);
    else console.log('[MiniGames]', msg);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
