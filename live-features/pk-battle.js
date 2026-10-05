/* ============================================================
   Party App — Live Features: PK Battle ⚔️
   Do rooms ka live muqabla — gifts = points, jeetne wale ka jashn.
   Bigo Live / Mico ka sab se popular feature.

   Flow:
     1. Room owner "⚔️ PK" dabata hai → opponent ka room number dalta hai
     2. Opponent room ke owner ko challenge aata hai → Accept/Decline
     3. 5 min battle: har room me bheje gaye gifts = points (1 love = 1 pt)
     4. Live score bars + timer → end par winner celebration

   Firebase:
     liveRooms/{id}/pkChallenge = { fromRoomId, fromRoomName, at }
     liveRooms/{id}/pk = { oppRoomId, oppRoomName, status, endsAt,
                            myScore, winner }

   Sirf room owner challenge bhej/accept kar sakta hai.
   ============================================================ */
(function () {
  'use strict';

  var PK = window.PKBattle = {};
  var DURATION_MIN = 5;

  var listeners = [];
  var timerInt = null;
  var el = null;

  function db() { return window.db || (window.firebase && firebase.database()); }
  function me() { return (window.currentUser && window.currentUser.uid) || null; }
  function myRoom() { return window.currentRoomId || null; }
  function isOwner() { return window.currentRoomOwnerUid && me() && window.currentRoomOwnerUid === me(); }
  function myName() {
    return (window.currentUserData && window.currentUserData.name) || 'Room';
  }

  function toast(m) { if (window.showToast) window.showToast(m); else alert(m); }

  /* ============ CHALLENGE ============ */

  // Owner: challenge dialog kholo
  PK.openChallenge = function () {
    if (!isOwner()) { toast('Sirf room owner PK start kar sakta hai'); return; }
    var num = prompt('Opponent ka Room Number dalo:');
    if (!num) return;
    PK.sendChallenge(num.trim());
  };

  PK.sendChallenge = function (roomNumericId) {
    var d = db(); if (!d) return;
    d.ref('liveRooms').orderByChild('roomNumericId')
      .equalTo(parseInt(roomNumericId, 10)).once('value').then(function (snap) {
        var found = null;
        snap.forEach(function (c) { found = { id: c.key, data: c.val() }; });
        if (!found) { toast('Room nahi mila ❌'); return; }
        if (found.id === myRoom()) { toast('Apne hi room ko challenge nahi kar sakte 😅'); return; }
        d.ref('liveRooms/' + found.id + '/pkChallenge').set({
          fromRoomId: myRoom(),
          fromRoomName: myName() + "'s Room",
          fromNumericId: null,
          at: Date.now()
        }).then(function () {
          toast('⚔️ Challenge bhej diya! Jawab ka intezar...');
          // 60s me jawab na aaye to cancel
          setTimeout(function () {
            d.ref('liveRooms/' + found.id + '/pkChallenge').once('value').then(function (s) {
              var c = s.val();
              if (c && c.fromRoomId === myRoom()) {
                d.ref('liveRooms/' + found.id + '/pkChallenge').remove();
                toast('Koi jawab nahi aaya ⏰');
              }
            });
          }, 60000);
        });
      });
  };

  // Incoming challenge suno (har room enter par lagao)
  PK.listenChallenges = function () {
    var d = db(); var roomId = myRoom();
    if (!d || !roomId) return;
    PK.stopListeners();
    var ref = d.ref('liveRooms/' + roomId + '/pkChallenge');
    var h = ref.on('value', function (snap) {
      var c = snap.val();
      if (c && isOwner()) showIncoming(c);
      else hideIncoming();
    });
    listeners.push({ ref: ref, h: h });
  };

  PK.acceptChallenge = function () {
    var d = db(); if (!d) return;
    d.ref('liveRooms/' + myRoom() + '/pkChallenge').once('value').then(function (snap) {
      var c = snap.val(); if (!c) return;
      d.ref('liveRooms/' + myRoom() + '/pkChallenge').remove();
      // Dono rooms me battle state likho
      var endsAt = Date.now() + DURATION_MIN * 60 * 1000;
      var myPk = { oppRoomId: c.fromRoomId, oppRoomName: c.fromRoomName, status: 'active', endsAt: endsAt, myScore: 0, winner: null };
      var oppPk = { oppRoomId: myRoom(), oppRoomName: myName() + "'s Room", status: 'active', endsAt: endsAt, myScore: 0, winner: null };
      d.ref('liveRooms/' + myRoom() + '/pk').set(myPk);
      d.ref('liveRooms/' + c.fromRoomId + '/pk').set(oppPk);
    });
  };

  PK.declineChallenge = function () {
    var d = db(); if (!d) return;
    d.ref('liveRooms/' + myRoom() + '/pkChallenge').remove();
    hideIncoming();
  };

  /* ============ BATTLE ============ */

  // Battle state suno
  PK.listenBattle = function () {
    var d = db(); var roomId = myRoom();
    if (!d || !roomId) return;
    var ref = d.ref('liveRooms/' + roomId + '/pk');
    var h = ref.on('value', function (snap) {
      var pk = snap.val();
      if (pk && pk.status === 'active') onBattleActive(pk);
      else if (pk && pk.status === 'ended') onBattleEnded(pk);
      else onBattleIdle();
    });
    listeners.push({ ref: ref, h: h });
  };

  function onBattleActive(pk) {
    ensureEl();
    el.classList.add('show');
    // Opponent ka score suno
    var d = db();
    var oppRef = d.ref('liveRooms/' + pk.oppRoomId + '/pk/myScore');
    var oh = oppRef.on('value', function (s) {
      updateScores(pk.myScore || 0, s.val() || 0, pk);
    });
    listeners.push({ ref: oppRef, h: oh });
    updateScores(pk.myScore || 0, 0, pk);
    startTimer(pk.endsAt);
    // Apna score bhi live update ho (khud ke writes par)
    var myRef = d.ref('liveRooms/' + myRoom() + '/pk/myScore');
    var mh = myRef.on('value', function (s) {
      d.ref('liveRooms/' + pk.oppRoomId + '/pk/myScore').once('value').then(function (os) {
        updateScores(s.val() || 0, os.val() || 0, pk);
      });
    });
    listeners.push({ ref: myRef, h: mh });
  }

  // Gift se score — wiring.js se call hota hai
  PK.addScore = function (points) {
    var d = db(); var roomId = myRoom();
    if (!d || !roomId || !points) return;
    d.ref('liveRooms/' + roomId + '/pk/myScore').transaction(function (cur) {
      return (cur || 0) + points;
    });
  };

  function updateScores(my, opp, pk) {
    if (!el) return;
    var total = my + opp;
    var myPct = total ? Math.round((my / total) * 100) : 50;
    el.querySelector('#pkMyFill').style.width = myPct + '%';
    el.querySelector('#pkOppFill').style.width = (100 - myPct) + '%';
    el.querySelector('#pkMyScore').textContent = fmt(my);
    el.querySelector('#pkOppScore').textContent = fmt(opp);
    el.querySelector('#pkMyName').textContent = 'Tumhara Room';
    el.querySelector('#pkOppName').textContent = pk.oppRoomName || 'Opponent';
    el.querySelector('.pk-vs').textContent = my > opp ? '🔥 AAGE HO!' : (opp > my ? '😰 PEECHE HO!' : '⚔️ BARABAR');
  }

  function fmt(n) {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return '' + n;
  }

  function startTimer(endsAt) {
    clearInterval(timerInt);
    var tEl = el && el.querySelector('#pkTimer');
    function upd() {
      var left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      if (tEl) tEl.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
      if (left <= 0) { clearInterval(timerInt); PK.finishBattle(); }
    }
    upd(); timerInt = setInterval(upd, 500);
  }

  // Battle khatam — winner decide karo
  PK.finishBattle = function () {
    var d = db(); var roomId = myRoom();
    if (!d || !roomId) return;
    d.ref('liveRooms/' + roomId + '/pk').once('value').then(function (snap) {
      var pk = snap.val();
      if (!pk || pk.status !== 'active') return;
      d.ref('liveRooms/' + pk.oppRoomId + '/pk/myScore').once('value').then(function (os) {
        var my = pk.myScore || 0, opp = os.val() || 0;
        var iWon = my >= opp; // tie → defender (main) jeetta hai
        d.ref('liveRooms/' + roomId + '/pk').update({ status: 'ended', winner: iWon ? 'me' : 'opp', finalMy: my, finalOpp: opp });
      });
    });
  };

  function onBattleEnded(pk) {
    clearInterval(timerInt);
    ensureEl();
    var won = pk.winner === 'me';
    el.querySelector('.pk-battle').style.display = 'none';
    var endEl = el.querySelector('.pk-end');
    endEl.style.display = 'block';
    endEl.innerHTML =
      '<div class="pk-trophy">' + (won ? '🏆' : '💔') + '</div>' +
      '<div class="pk-endtitle">' + (won ? 'JEET GAYE! 🎉' : 'HAAR GAYE 😅') + '</div>' +
      '<div class="pk-endscore">' + fmt(pk.finalMy || 0) + ' — ' + fmt(pk.finalOpp || 0) + '</div>' +
      '<div class="pk-endsub">' + (won ? 'Mubarak ho! Room ka jashn manao 🥳' : 'Koi baat nahi — agli dafa sahi! 💪') + '</div>' +
      '<button class="pk-closebtn" onclick="PKBattle.closeBattle()">Theek hai</button>';
    el.classList.add('show');
    if (won && window.GiftFX) { /* jeet par confetti jaisa effect */ }
    // 30s baad safai
    setTimeout(function () {
      var d = db();
      if (d && myRoom()) d.ref('liveRooms/' + myRoom() + '/pk').remove();
    }, 30000);
  }

  function onBattleIdle() {
    clearInterval(timerInt);
    if (el) {
      el.classList.remove('show');
      var b = el.querySelector('.pk-battle'); if (b) b.style.display = 'block';
      var e = el.querySelector('.pk-end'); if (e) e.style.display = 'none';
    }
  }

  PK.closeBattle = function () {
    if (el) el.classList.remove('show');
    var d = db();
    if (d && myRoom()) d.ref('liveRooms/' + myRoom() + '/pk').remove();
  };

  PK.stopListeners = function () {
    listeners.forEach(function (l) { try { l.ref.off('value', l.h); } catch (e) {} });
    listeners = [];
    clearInterval(timerInt);
  };

  /* ============ UI ============ */

  function ensureEl() {
    if (el) return;
    el = document.createElement('div');
    el.className = 'pk-wrap';
    el.innerHTML =
      '<div class="pk-battle">' +
        '<div class="pk-top"><span id="pkMyName">Tum</span><span id="pkTimer">5:00</span><span id="pkOppName">Opp</span></div>' +
        '<div class="pk-bar"><div class="pk-fill-my" id="pkMyFill"></div><div class="pk-fill-opp" id="pkOppFill"></div></div>' +
        '<div class="pk-scores"><span id="pkMyScore">0</span><span class="pk-vs">⚔️</span><span id="pkOppScore">0</span></div>' +
        '<div class="pk-hint">Gifts bhejo — har 1 love coin = 1 point!</div>' +
      '</div>' +
      '<div class="pk-end" style="display:none"></div>' +
      '<div class="pk-incoming" id="pkIncoming" style="display:none">' +
        '<div class="pk-inctitle">⚔️ PK Challenge!</div>' +
        '<div class="pk-incsub" id="pkIncSub"></div>' +
        '<div class="pk-incbtns">' +
          '<button class="pk-accept" onclick="PKBattle.acceptChallenge()">Qubool ✅</button>' +
          '<button class="pk-decline" onclick="PKBattle.declineChallenge()">Inkaar ✖</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
  }

  function showIncoming(c) {
    ensureEl();
    el.classList.add('show');
    var inc = el.querySelector('#pkIncoming');
    inc.style.display = 'block';
    el.querySelector('#pkIncSub').textContent = (c.fromRoomName || 'Ek room') + ' ne tumhe PK ka challenge diya hai!';
    el.querySelector('.pk-battle').style.display = 'none';
  }
  function hideIncoming() {
    if (!el) return;
    var inc = el.querySelector('#pkIncoming');
    if (inc) inc.style.display = 'none';
    // agar battle nahi chal rahi to poora overlay hatao
    var d = db();
    if (d && myRoom()) {
      d.ref('liveRooms/' + myRoom() + '/pk').once('value').then(function (s) {
        var pk = s.val();
        if (!pk || pk.status !== 'active') el.classList.remove('show');
        else el.querySelector('.pk-battle').style.display = 'block';
      });
    }
  }

  // Room enter/exit par ye lagao:
  PK.onEnterRoom = function () { PK.listenChallenges(); PK.listenBattle(); };
  PK.onExitRoom = function () { PK.stopListeners(); if (el) el.classList.remove('show'); };

  console.log('[live-features] PKBattle ready ⚔️');
})();
