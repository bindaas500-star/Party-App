/* ============================================================
   BFF Relationships Pack (audit Sec 5)
   Soulmate wale proven economy pattern par BFF system:
   - Central config: relationshipConfig/bff (cost/receiverPct/poolPct)
   - Sender pays cost (confirmation ke baad), receiver ko %,
     baqi system pool me, reject par refund
   - Duplicate requests/bonds blocked
   - Admin panel me BFF settings
   ============================================================ */
(function () {
  'use strict';

  var BFF_DEFAULT_CONFIG = { cost: 300, receiverPct: 20, poolPct: 80, refundOnReject: true };

  function safeUser() {
    try { if (typeof currentUserData !== 'undefined' && currentUserData) return currentUserData; } catch (e) {}
    return null;
  }
  function safeUid() {
    try { if (typeof currentUser !== 'undefined' && currentUser) return currentUser.uid; } catch (e) {}
    return null;
  }
  function targetUid() {
    try { if (typeof seatProfileUid !== 'undefined') return seatProfileUid; } catch (e) {}
    return null;
  }
  function targetName() {
    try { if (typeof seatProfileName !== 'undefined') return seatProfileName; } catch (e) {}
    return 'user';
  }

  function getBffConfig() {
    return db.ref('relationshipConfig/bff').once('value').then(function (snap) {
      return snap.val() || BFF_DEFAULT_CONFIG;
    });
  }

  function sendBffRequest() {
    var uid = safeUid(), u = safeUser(), toUid = targetUid();
    if (!uid || !u || !toUid) return;
    if (toUid === uid) { alert("You can't become BFFs with yourself."); return; }
    if (u.bffUid === toUid) { toast('You are already BFFs with ' + targetName() + '!'); return; }
    if (u.bffUid) { toast('You already have a BFF. End that bond first.', 'error'); return; }
    getBffConfig().then(function (cfg) {
      if (!confirm('Send BFF request to ' + targetName() + ' for 💕 ' + cfg.cost + ' Love Coins?')) return;
      if ((safeUser().love || 0) < cfg.cost) { toast('You need 💕 ' + cfg.cost + ' Love Coins.', 'error'); return; }
      db.ref('users/' + toUid).once('value').then(function (snap) {
        var target = snap.val();
        if (!target) return;
        if (target.bffUid) { toast(targetName() + ' already has a BFF.', 'error'); return; }
        db.ref('bffRequests/' + toUid + '/' + uid).once('value').then(function (reqSnap) {
          if (reqSnap.val()) { toast('Request already sent.', 'error'); return; }
          var me = safeUser();
          db.ref('users/' + uid).update({ love: (me.love || 0) - cfg.cost });
          db.ref('bffRequests/' + toUid + '/' + uid).set({
            fromName: me.name, timestamp: Date.now(),
            cost: cfg.cost, receiverPct: cfg.receiverPct
          });
          if (typeof addActivity === 'function') addActivity(toUid, 'social', me.name + ' sent you a BFF request! 🤝');
          toast('BFF request sent to ' + targetName() + '! 🤝');
        });
      });
    });
  }

  function acceptBffRequest(fromUid, fromName) {
    var uid = safeUid(), u = safeUser();
    if (!uid || !u) return;
    if (u.bffUid) { toast('You already have a BFF.', 'error'); return; }
    db.ref('bffRequests/' + uid + '/' + fromUid).once('value').then(function (reqSnap) {
      var req = reqSnap.val() || {};
      var cost = req.cost || BFF_DEFAULT_CONFIG.cost;
      var receiverPct = (req.receiverPct != null) ? req.receiverPct : BFF_DEFAULT_CONFIG.receiverPct;
      var receiverAmount = Math.round(cost * receiverPct / 100);
      var poolAmount = cost - receiverAmount;
      db.ref('users/' + fromUid).once('value').then(function (snap) {
        var other = snap.val();
        if (other && other.bffUid) {
          toast(fromName + ' already has a BFF.', 'error');
          db.ref('bffRequests/' + uid + '/' + fromUid).remove();
          db.ref('users/' + fromUid).update({ love: (other.love || 0) + cost });
          return;
        }
        var me = safeUser();
        db.ref('users/' + uid).update({ bffUid: fromUid, bffScore: 0, love: (me.love || 0) + receiverAmount });
        db.ref('users/' + fromUid).update({ bffUid: uid, bffScore: 0 });
        db.ref('bffRequests/' + uid + '/' + fromUid).remove();
        if (typeof addToSystemPool === 'function') addToSystemPool('love', poolAmount, 'BFF request: ' + fromName + ' → ' + me.name);
        if (typeof addActivity === 'function') addActivity(fromUid, 'social', me.name + ' accepted your BFF request! 🤝');
        toast('You are now BFFs with ' + fromName + '! 🤝');
        if (typeof loadActivityList === 'function') {
          try {
            var el = document.querySelector('#listOverlay .rank-list, #listOverlayContent');
            if (el) loadActivityList(el, 'social');
          } catch (e) {}
        }
      });
    });
  }

  function rejectBffRequest(fromUid) {
    var uid = safeUid();
    if (!uid) return;
    db.ref('bffRequests/' + uid + '/' + fromUid).once('value').then(function (reqSnap) {
      var req = reqSnap.val() || {};
      var cost = req.cost || BFF_DEFAULT_CONFIG.cost;
      getBffConfig().then(function (cfg) {
        db.ref('bffRequests/' + uid + '/' + fromUid).remove().then(function () {
          if (cfg.refundOnReject !== false) {
            db.ref('users/' + fromUid).once('value').then(function (s) {
              var sender = s.val() || {};
              db.ref('users/' + fromUid).update({ love: (sender.love || 0) + cost });
            });
            toast('Request rejected — sender refunded.');
          } else {
            toast('Request rejected.');
          }
          if (typeof loadActivityList === 'function') {
            try {
              var el = document.querySelector('#listOverlay .rank-list, #listOverlayContent');
              if (el) loadActivityList(el, 'social');
            } catch (e) {}
          }
        });
      });
    });
  }

  function endBffBond() {
    var uid = safeUid(), u = safeUser();
    if (!uid || !u || !u.bffUid) return;
    if (!confirm('End your BFF bond?')) return;
    var otherUid = u.bffUid;
    db.ref('users/' + uid).update({ bffUid: null });
    db.ref('users/' + otherUid).update({ bffUid: null });
    if (typeof addActivity === 'function') addActivity(otherUid, 'social', u.name + ' ended the BFF bond.');
    toast('BFF bond ended.');
  }

  function saveBffConfig() {
    try {
      if (typeof isAdminUser !== 'undefined' && !isAdminUser) { toast('Admin access only.', 'error'); return; }
    } catch (e) {}
    var cost = parseInt(document.getElementById('adminBffCost').value, 10);
    var receiverPct = parseInt(document.getElementById('adminBffReceiverPct').value, 10);
    if (isNaN(cost) || cost < 0) { alert('Enter a valid cost.'); return; }
    if (isNaN(receiverPct) || receiverPct < 0 || receiverPct > 100) { alert('Receiver % must be 0–100.'); return; }
    db.ref('relationshipConfig/bff').set({ cost: cost, receiverPct: receiverPct, poolPct: 100 - receiverPct, refundOnReject: true })
      .then(function () { toast('BFF settings saved!'); });
  }

  /* ---------- Admin UI: BFF settings inject ---------- */
  function injectBffAdminUI() {
    var tab = document.getElementById('adminRelationshipsTab');
    if (!tab || document.getElementById('adminBffCost')) return;
    var d = document.createElement('div');
    d.innerHTML =
      '<div class="admin-adjust-label" style="margin-bottom:10px;">🤝 BFF Request Settings</div>' +
      '<div class="admin-adjust-box" style="margin:0 0 12px;">' +
      '<div class="admin-adjust-label">Request Cost (Love Coins)</div>' +
      '<div class="admin-adjust-row"><input type="number" id="adminBffCost" placeholder="300"></div></div>' +
      '<div class="admin-adjust-box" style="margin:0 0 12px;">' +
      '<div class="admin-adjust-label">Receiver % (System Pool gets the rest)</div>' +
      '<div class="admin-adjust-row"><input type="number" id="adminBffReceiverPct" placeholder="20"></div></div>' +
      '<button class="detail-action-btn" style="width:100%; margin:6px 0 20px;" id="saveBffConfigBtn">Save BFF Settings</button>';
    tab.appendChild(d);
    var btn = document.getElementById('saveBffConfigBtn');
    if (btn) btn.onclick = saveBffConfig;
  }

  function wrapAdminConfig() {
    if (typeof loadAdminRelationshipsConfig !== 'function') return false;
    var _orig = loadAdminRelationshipsConfig;
    loadAdminRelationshipsConfig = function () {
      _orig();
      try {
        injectBffAdminUI();
        getBffConfig().then(function (cfg) {
          var c = document.getElementById('adminBffCost'), r = document.getElementById('adminBffReceiverPct');
          if (c) c.value = cfg.cost;
          if (r) r.value = cfg.receiverPct;
        });
      } catch (e) {}
    };
    return true;
  }

  /* ---------- BFF requests in notifications list ---------- */
  function wrapActivityList() {
    if (typeof loadActivityList !== 'function') return false;
    var _orig = loadActivityList;
    loadActivityList = function (contentEl, filterType) {
      _orig(contentEl, filterType);
      if (filterType !== 'social') return;
      try {
        var uid = safeUid();
        if (!uid || typeof db === 'undefined') return;
        db.ref('bffRequests/' + uid).once('value').then(function (snap) {
          var requests = snap.val() || {};
          Object.keys(requests).forEach(function (fromUid) {
            var req = requests[fromUid];
            var row = document.createElement('div');
            row.className = 'rank-row';
            var nm = (typeof escapeHtml === 'function') ? escapeHtml(req.fromName) : req.fromName;
            var ago = (typeof timeAgo === 'function') ? timeAgo(req.timestamp) : '';
            row.innerHTML = '<div class="rank-info"><div class="rank-name">🤝 ' + nm + ' wants to be your BFF</div>' +
              '<div class="rank-sub">' + ago + ' • 💕' + (req.cost || 300) + '</div></div>' +
              '<button style="background:linear-gradient(90deg,#ff6b9d,#c44dff);border:none;color:#fff;padding:7px 12px;border-radius:12px;font-size:11.5px;font-weight:700;cursor:pointer;margin-right:6px;">Accept</button>' +
              '<button style="background:rgba(255,255,255,0.1);border:none;color:#fff;padding:7px 12px;border-radius:12px;font-size:11.5px;font-weight:700;cursor:pointer;">✕</button>';
            var btns = row.querySelectorAll('button');
            (function (fu, fn) {
              btns[0].onclick = function () { acceptBffRequest(fu, fn); };
              btns[1].onclick = function () { rejectBffRequest(fu); };
            })(fromUid, req.fromName);
            contentEl.insertBefore(row, contentEl.firstChild);
          });
        });
      } catch (e) {}
    };
    return true;
  }

  /* ---------- Rewire BFF banner ---------- */
  function rewireBanner() {
    var banner = document.querySelector('.seat-prof-banner.bff');
    if (banner) banner.onclick = function () { sendBffRequest(); };
  }

  /* ---------- expose globals ---------- */
  window.sendBffRequest = sendBffRequest;
  window.acceptBffRequest = acceptBffRequest;
  window.rejectBffRequest = rejectBffRequest;
  window.endBffBond = endBffBond;
  window.getBffConfig = getBffConfig;
  window.saveBffConfig = saveBffConfig;

  /* ---------- boot ---------- */
  var tries = 0;
  var boot = setInterval(function () {
    tries++;
    if (typeof db === 'undefined') { if (tries > 40) clearInterval(boot); return; }
    rewireBanner();
    wrapAdminConfig();
    wrapActivityList();
    clearInterval(boot);
  }, 1000);
})();
