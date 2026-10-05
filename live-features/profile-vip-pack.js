/* ============================================================
   Profile + VIP Pack (audit Sec 2, 4, 10)
   Sec 2: applyAvatarPhoto -> cover + photoPos + 1/1 circle;
          edit-profile me photo position editor (X/Y sliders)
   Sec 4: country select + flag; profile par charm/love stats
   Sec 10: VIP benefits me REAL progress (vipSpend vs tier requirement)
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Sec 2: avatar fix ---------- */
  function installAvatarFix() {
    if (typeof applyAvatarPhoto !== 'function') return false;
    applyAvatarPhoto = function (el, userData) {
      if (!el) return;
      var fallbackLetter = (userData && userData.name ? userData.name.charAt(0).toUpperCase() : '?');
      // Perfect circle enforcement
      el.style.aspectRatio = '1/1';
      el.style.borderRadius = '50%';
      el.style.overflow = 'hidden';
      if (userData && userData.photoURL) {
        el.style.backgroundImage = '';
        el.textContent = fallbackLetter;
        var testImg = new Image();
        testImg.onload = function () {
          el.style.backgroundImage = "url('" + userData.photoURL + "')";
          el.style.backgroundSize = 'cover';
          el.style.backgroundRepeat = 'no-repeat';
          el.style.backgroundPosition = userData.photoPos || '50% 50%';
          el.textContent = '';
        };
        testImg.onerror = function () {
          el.style.backgroundImage = '';
          el.textContent = fallbackLetter;
        };
        testImg.src = userData.photoURL;
      } else {
        el.style.backgroundImage = '';
        el.textContent = fallbackLetter;
      }
    };
    return true;
  }

  /* ---------- Photo position editor ---------- */
  function injectPosEditor() {
    var wrap = document.querySelector('#editProfileView .edit-avatar-wrap');
    if (!wrap || document.getElementById('pfpPosX')) return;
    var d = document.createElement('div');
    d.className = 'pfp-pos-editor';
    d.innerHTML =
      '<div class="pfp-pos-title">Photo position — chehra adjust karo</div>' +
      '<div class="pfp-pos-row"><span>&#8596;</span><input type="range" id="pfpPosX" min="0" max="100" value="50"></div>' +
      '<div class="pfp-pos-row"><span>&#8597;</span><input type="range" id="pfpPosY" min="0" max="100" value="50"></div>';
    wrap.appendChild(d);
    var upd = function () {
      var x = document.getElementById('pfpPosX').value;
      var y = document.getElementById('pfpPosY').value;
      var pv = document.getElementById('editAvatarBig');
      if (pv) pv.style.backgroundPosition = x + '% ' + y + '%';
    };
    var inputs = d.querySelectorAll('input');
    for (var i = 0; i < inputs.length; i++) inputs[i].addEventListener('input', upd);
  }

  /* ---------- Country ---------- */
  var COUNTRIES = [
    ['', 'Not set'], ['SA', 'Saudi Arabia'], ['PK', 'Pakistan'], ['AE', 'UAE'],
    ['QA', 'Qatar'], ['KW', 'Kuwait'], ['BH', 'Bahrain'], ['OM', 'Oman'],
    ['EG', 'Egypt'], ['JO', 'Jordan'], ['IN', 'India'], ['BD', 'Bangladesh'],
    ['PH', 'Philippines'], ['ID', 'Indonesia'], ['MY', 'Malaysia'], ['TR', 'Turkey'],
    ['US', 'USA'], ['GB', 'UK'], ['CA', 'Canada'], ['AU', 'Australia']
  ];

  function flagEmoji(cc) {
    if (!cc || cc.length !== 2) return '';
    try {
      return String.fromCodePoint.apply(null, cc.toUpperCase().split('').map(function (c) {
        return 127397 + c.charCodeAt(0);
      }));
    } catch (e) { return ''; }
  }

  function injectCountryField() {
    if (document.getElementById('editCountryInput')) return;
    var regionInput = document.getElementById('editRegionInput');
    if (!regionInput || !regionInput.parentNode) return;
    var d = document.createElement('div');
    d.className = 'edit-field';
    var opts = COUNTRIES.map(function (c) {
      return '<option value="' + c[0] + '">' + c[1] + '</option>';
    }).join('');
    d.innerHTML = '<label>Country</label><select id="editCountryInput">' + opts + '</select>';
    regionInput.parentNode.parentNode.insertBefore(d, regionInput.parentNode.nextSibling);
  }

  function safeUser() {
    try {
      if (typeof currentUserData !== 'undefined' && currentUserData) return currentUserData;
    } catch (e) {}
    return null;
  }

  /* ---------- Wraps ---------- */
  function wrapEditProfile() {
    if (typeof openEditProfileView !== 'function' || typeof saveEditProfile !== 'function') return false;

    var _open = openEditProfileView;
    openEditProfileView = function () {
      _open();
      try {
        injectPosEditor();
        injectCountryField();
        var u = safeUser();
        var pos = (u && u.photoPos) || '50% 50%';
        var parts = pos.split(' ');
        var xEl = document.getElementById('pfpPosX'), yEl = document.getElementById('pfpPosY');
        if (xEl) xEl.value = parseInt(parts[0], 10) || 50;
        if (yEl) yEl.value = parseInt(parts[1], 10) || 50;
        var pv = document.getElementById('editAvatarBig');
        if (pv && u) applyAvatarPhoto(pv, u);
        var cEl = document.getElementById('editCountryInput');
        if (cEl && u) cEl.value = u.country || '';
      } catch (e) {}
    };

    var _save = saveEditProfile;
    saveEditProfile = function () {
      try {
        var upd = {};
        var x = document.getElementById('pfpPosX'), y = document.getElementById('pfpPosY');
        if (x && y) upd.photoPos = x.value + '% ' + y.value + '%';
        var c = document.getElementById('editCountryInput');
        if (c) upd.country = c.value;
        if (Object.keys(upd).length && typeof currentUser !== 'undefined' && currentUser && typeof db !== 'undefined') {
          db.ref('users/' + currentUser.uid).update(upd);
          var u = safeUser();
          if (u) { for (var k in upd) u[k] = upd[k]; }
        }
      } catch (e) {}
      _save();
    };
    return true;
  }

  function wrapRenderProfile() {
    if (typeof renderProfile !== 'function') return false;
    var _orig = renderProfile;
    renderProfile = function () {
      _orig();
      try {
        var u = safeUser();
        if (!u) return;
        var nameEl = document.getElementById('profileNameBig');
        if (nameEl) nameEl.textContent = u.name + (u.country ? ' ' + flagEmoji(u.country) : '');
        var hero = document.querySelector('#profileMainView .profile-hero');
        if (hero) {
          var s = document.getElementById('pfpStatsRow');
          if (!s) {
            s = document.createElement('div');
            s.id = 'pfpStatsRow';
            s.className = 'pfp-stats';
            hero.appendChild(s);
          }
          var charm = (typeof u.charmScore !== 'undefined') ? u.charmScore : (u.charm || 0);
          s.innerHTML = '<span class="pfp-stat">✨ ' + charm + ' <em>Charm</em></span>' +
                        '<span class="pfp-stat">💕 ' + (u.love || 0) + ' <em>Love</em></span>';
        }
      } catch (e) {}
    };
    return true;
  }

  /* ---------- Sec 10: VIP real progress ---------- */
  function wrapVipBenefits() {
    if (typeof openVipBenefits !== 'function') return false;
    var _orig = openVipBenefits;
    openVipBenefits = function () {
      _orig();
      try {
        var u = safeUser();
        var tier = (u && u.realVipTier) || 0;
        var spend = (u && u.vipSpend) || 0;
        var tiers = (typeof VIP_TIERS !== 'undefined') ? VIP_TIERS : [];
        var next = null;
        for (var i = 0; i < tiers.length; i++) {
          if (tiers[i].tier === tier + 1) { next = tiers[i]; break; }
        }
        var badge = document.getElementById('vtcBadge'),
            amt = document.getElementById('vtcAmount'),
            tlabel = document.getElementById('vtcTierLabel'),
            ptext = document.getElementById('vtcProgressText'),
            pfill = document.getElementById('vtcProgressFill');
        if (badge) badge.textContent = 'VIP ' + tier;
        var note = document.getElementById('vtcRemainNote');
        if (!note && ptext && ptext.parentNode) {
          note = document.createElement('div');
          note.id = 'vtcRemainNote';
          note.className = 'vtc-remain-note';
          ptext.parentNode.insertBefore(note, ptext.nextSibling);
        }
        if (!next) {
          if (tlabel) tlabel.textContent = 'MAX';
          if (ptext) ptext.textContent = 'Highest VIP tier reached';
          if (pfill) pfill.style.width = '100%';
          if (amt && amt.parentNode) amt.parentNode.style.display = 'none';
          if (note) note.textContent = '';
          return;
        }
        var pct = next.usd > 0 ? Math.min(100, Math.round(spend / next.usd * 100)) : 0;
        if (pfill) pfill.style.width = pct + '%';
        if (ptext) ptext.textContent = '$' + spend.toFixed(2) + ' / $' + next.usd.toFixed(2);
        if (tlabel) tlabel.textContent = 'VIP ' + next.tier;
        if (amt && typeof formatLocalPrice === 'function') amt.textContent = formatLocalPrice(next.usd);
        if (note) {
          var rem = Math.max(0, next.usd - spend);
          if (tier > 0 && spend <= 0) {
            note.textContent = 'Your VIP was granted by admin. Future top-ups will track progress here.';
          } else if (rem > 0 && typeof formatLocalPrice === 'function') {
            note.textContent = formatLocalPrice(rem) + ' more to unlock VIP ' + next.tier;
          } else if (rem <= 0) {
            note.textContent = 'Ready for VIP ' + next.tier + '!';
          } else {
            note.textContent = '';
          }
        }
      } catch (e) {}
    };
    return true;
  }

  /* ---------- boot ---------- */
  var tries = 0;
  var boot = setInterval(function () {
    tries++;
    var a = installAvatarFix();
    if (a) {
      wrapEditProfile();
      wrapRenderProfile();
      wrapVipBenefits();
      clearInterval(boot);
    }
    if (tries > 40) clearInterval(boot);
  }, 1000);
})();
