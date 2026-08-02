  const firebaseConfig = {
    apiKey: "AIzaSyCWFsDRzavLObytahjDj3cRYwsoSNuttaA",
    authDomain: "party-app-f2413.firebaseapp.com",
    databaseURL: "https://party-app-f2413-default-rtdb.firebaseio.com",
    projectId: "party-app-f2413",
    storageBucket: "party-app-f2413.firebasestorage.app",
    messagingSenderId: "1016955843509",
    appId: "1:1016955843509:web:db4f2393b4dc83c0cb5ffc",
    measurementId: "G-9QEVZLLM1Y"
  };

  firebase.initializeApp(firebaseConfig);

  // Fix mobile browser viewport height (address bar / keyboard) issues
  function setAppHeight() {
    document.documentElement.style.setProperty('--app-height', window.innerHeight + 'px');
    const topbarEl = document.querySelector('.topbar');
    const bottomNavEl = document.querySelector('.bottom-nav');
    if (topbarEl) {
      document.documentElement.style.setProperty('--topbar-height', topbarEl.getBoundingClientRect().height + 'px');
    }
    if (bottomNavEl) {
      document.documentElement.style.setProperty('--bottomnav-height', bottomNavEl.getBoundingClientRect().height + 'px');
    }
  }
  setAppHeight();
  window.addEventListener('resize', setAppHeight);
  window.addEventListener('orientationchange', setAppHeight);
  setTimeout(setAppHeight, 300);
  setTimeout(setAppHeight, 1000);

  (function setupPullToRefresh() {
    const indicator = document.getElementById('pullRefreshIndicator');
    let startY = 0;
    let pulling = false;
    let scrollEl = null;

    function getScrollableAncestor(el) {
      while (el && el !== document.body) {
        if (el.scrollHeight > el.clientHeight + 2) {
          const style = window.getComputedStyle(el);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') return el;
        }
        el = el.parentElement;
      }
      return document.body;
    }

    document.addEventListener('touchstart', (e) => {
      scrollEl = getScrollableAncestor(e.target);
      pulling = !scrollEl || scrollEl.scrollTop <= 0;
      startY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0 && (!scrollEl || scrollEl.scrollTop <= 0)) {
        const pull = Math.min(dy * 0.5, 90);
        indicator.style.transition = 'none';
        indicator.style.transform = `translateY(${pull}px)`;
        indicator.style.opacity = Math.min(pull / 55, 1);
        indicator.textContent = pull > 55 ? '↻ Release to refresh' : '↓ Pull to refresh';
        if (dy > 10) e.preventDefault();
      }
    }, { passive: false });

    document.addEventListener('touchend', () => {
      if (!pulling) return;
      pulling = false;
      const match = /translateY\(([\d.]+)px\)/.exec(indicator.style.transform || '');
      const pullAmount = match ? parseFloat(match[1]) : 0;
      indicator.style.transition = 'transform 0.15s ease, opacity 0.15s ease';
      if (pullAmount > 55) {
        indicator.textContent = '↻ Refreshing...';
        indicator.style.transform = 'translateY(20px)';
        indicator.style.opacity = '1';
        setTimeout(() => location.reload(), 250);
      } else {
        indicator.style.transform = '';
        indicator.style.opacity = '';
      }
    }, { passive: true });
  })();

  (function setupBackButtonHandling() {
    history.pushState({ trap: true }, '');

    function closeTopmostSimpleOverlay() {
      const overlays = document.querySelectorAll('.ttt-overlay.show, .profile-overlay.show, .rank-overlay.show');
      if (overlays.length === 0) return false;
      overlays[overlays.length - 1].classList.remove('show');
      return true;
    }

    function showExitConfirm() {
      if (confirm('Exit Party App?')) {
        window.close();
        setTimeout(() => { history.back(); }, 150);
      } else {
        history.pushState({ trap: true }, '');
      }
    }

    window.addEventListener('popstate', () => {
      if (document.getElementById('profileOverlay').classList.contains('show') && currentProfileSubView) {
        hideAllProfileSubViews();
        history.pushState({ trap: true }, '');
        return;
      }
      if (closeTopmostSimpleOverlay()) {
        history.pushState({ trap: true }, '');
        return;
      }
      if (currentRoomId) {
        leaveRoomToBrowse();
        history.pushState({ trap: true }, '');
        return;
      }
      if (getActiveTab() !== 'hifami') {
        switchTab('hifami');
        history.pushState({ trap: true }, '');
        return;
      }
      showExitConfirm();
    });
  })();

  const auth = firebase.auth();
  const db = firebase.database();

  const LEVEL_REQUIRED_TO_CREATE = 5;
  const XP_PER_LEVEL = 150;
  const XP_PER_MESSAGE = 5;
  const HARVEST_CYCLE_MS = 30 * 60 * 1000; // reference window used to derive per-second rate
  const BASE_PRODUCTION = 50; // coins per harvest at farm/VIP level 1
  const PRODUCTION_PER_LEVEL = 25; // extra coins per VIP level
  const UPGRADE_INCREMENT = 1000; // cost = level * 1000 gems
  const PLOTS = [
    { label: 'Lv.1', requiredLevel: 1, bonus: 10000 },
    { label: 'Lv.2', requiredLevel: 2, bonus: 15000 },
    { label: 'Lv.3', requiredLevel: 3, bonus: 20000 },
    { label: 'Lv.4', requiredLevel: 4, bonus: 27000 },
    { label: 'Lv.5', requiredLevel: 5, bonus: 35000 },
    { label: 'Lv.6', requiredLevel: 6, bonus: 45000 },
    { label: 'VIP8', requiredLevel: 8, bonus: 70000 },
    { label: 'VIP10', requiredLevel: 10, bonus: 120000 },
    { label: 'VIP12', requiredLevel: 12, bonus: 200000 },
    { label: 'VIP15', requiredLevel: 15, bonus: 350000 }
  ];

  let isSignupMode = false;
  let currentUser = null;
  let currentUserData = null;
  let currentFamilyId = null;
  let familyListListenerAttached = false;

  // ---------- AUTH MODE TOGGLE ----------
  function toggleAuthMode() {
    isSignupMode = !isSignupMode;
    document.getElementById('authTitle').textContent = isSignupMode ? "Create Account" : "Welcome Back";
    document.getElementById('authSubmitBtn').textContent = isSignupMode ? "Sign Up" : "Login";
    document.getElementById('toggleAuthMode').textContent = isSignupMode ? "Already have an account? Login" : "New here? Create an account";
    document.getElementById('nameInput').style.display = isSignupMode ? "block" : "none";
    document.getElementById('forgotPasswordLink').style.display = isSignupMode ? "none" : "block";
    document.getElementById('authError').textContent = "";
  }

  function handleForgotPassword() {
    const email = document.getElementById('emailInput').value.trim();
    const errorEl = document.getElementById('authError');
    errorEl.style.color = '';
    if (!email) {
      errorEl.textContent = "Enter your email above first, then tap 'Forgot password?'";
      return;
    }
    auth.sendPasswordResetEmail(email).then(() => {
      errorEl.style.color = '#9df5c5';
      errorEl.textContent = "✅ Reset link sent! Check your email inbox.";
    }).catch((err) => {
      errorEl.style.color = '';
      errorEl.textContent = err.message;
    });
  }

  function handleAuth() {
    const email = document.getElementById('emailInput').value.trim();
    const pass = document.getElementById('passInput').value;
    const name = document.getElementById('nameInput').value.trim();
    const errorEl = document.getElementById('authError');
    errorEl.textContent = "";

    if (!email || !pass) { errorEl.textContent = "Please fill email and password."; return; }
    if (isSignupMode && !name) { errorEl.textContent = "Please enter your name."; return; }
    if (isSignupMode && containsBadWords(name)) { errorEl.textContent = "Please choose an appropriate name."; return; }

    if (isSignupMode) {
      auth.createUserWithEmailAndPassword(email, pass)
        .then((cred) => {
          return db.ref('users/' + cred.user.uid).set({
            name: name,
            email: email,
            vip: 1,
            coins: 0,
            gems: 0,
            love: 0,
            xp: 0,
            level: 1,
            farmLevel: 1,
            familyId: null,
            profileId: String(Math.floor(10000000 + Math.random() * 90000000)),
            lastHarvestAt: Date.now(),
            createdAt: Date.now()
          });
        })
        .catch((err) => { errorEl.textContent = err.message; });
    } else {
      auth.signInWithEmailAndPassword(email, pass)
        .catch((err) => { errorEl.textContent = err.message; });
    }
  }

  function handleLogout() {
    auth.signOut();
  }

  // ---------- AUTH STATE ----------
  let initialRestoreDone = false;

  auth.onAuthStateChanged((user) => {
    if (user) {
      currentUser = user;
      db.ref('users/' + user.uid).on('value', (snap) => {
        currentUserData = snap.val() || { name: "User", level: 1, xp: 0, familyId: null, coins: 0, gems: 0, lastHarvestAt: Date.now() };
        renderUserHeader();
        renderLevelCard();
        renderHome();
        if (currentUserData.familyId) {
          currentFamilyId = currentUserData.familyId;
          showInsideFamily(currentFamilyId);
        } else {
          currentFamilyId = null;
          showBrowseFamilies();
        }
        updateFamilyBubble(getActiveTab());

        if (!initialRestoreDone) {
          initialRestoreDone = true;
          const lastTab = localStorage.getItem('lastTab') || 'hifami';
          const lastRoomId = localStorage.getItem('lastRoomId');
          const lastRoomName = localStorage.getItem('lastRoomName');
          if (lastTab === 'room' && lastRoomId) {
            switchTab('room');
            enterRoom(lastRoomId, lastRoomName || 'Room');
          } else {
            switchTab(lastTab);
          }
          maybeShowOnboarding();
        }
      });

      document.getElementById('authScreen').classList.remove('active');
      document.getElementById('mainScreen').style.display = 'flex';
      document.getElementById('splashScreen').style.display = 'none';
      listenToChat();
      listenToFamilyList();
      listenToRoomList();
      listenToMoments();
    } else {
      currentUser = null;
      currentUserData = null;
      document.getElementById('mainScreen').style.display = 'none';
      document.getElementById('authScreen').classList.add('active');
      document.getElementById('splashScreen').style.display = 'none';
    }
  });

  function renderUserHeader() {
    document.getElementById('userName').textContent = currentUserData.name;
    applyAvatarPhoto(document.getElementById('userAvatar'), currentUserData);
    document.getElementById('userLevelLabel').textContent = "ID Lv. " + (currentUserData.level || 1);
    renderProfile();
    requestAnimationFrame(setAppHeight);
    setTimeout(setAppHeight, 150);
  }

  function applyAvatarPhoto(el, userData) {
    const fallbackLetter = (userData && userData.name ? userData.name.charAt(0).toUpperCase() : '?');
    if (userData && userData.photoURL) {
      // Show the letter immediately as a placeholder while we verify the image loads
      el.style.backgroundImage = '';
      el.textContent = fallbackLetter;
      const testImg = new Image();
      testImg.onload = () => {
        el.style.backgroundImage = `url('${userData.photoURL}')`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.textContent = '';
      };
      testImg.onerror = () => {
        el.style.backgroundImage = '';
        el.textContent = fallbackLetter;
      };
      testImg.src = userData.photoURL;
    } else {
      el.style.backgroundImage = '';
      el.textContent = fallbackLetter;
    }
  }

  let profileIdBeingGenerated = false;

  function renderProfile() {
    if (!currentUserData) return;
    applyAvatarPhoto(document.getElementById('profileAvatarBig'), currentUserData);
    document.getElementById('profileNameBig').textContent = currentUserData.name;
    document.getElementById('profileIdLevelBadge').textContent = "🆔 ID Lv. " + (currentUserData.level || 1);
    document.getElementById('profileVipLevelBadge').textContent = "👑 VIP " + (currentUserData.farmLevel || 1);
    document.getElementById('profileWalletValue').textContent = "🪙" + formatNum(currentUserData.coins || 0) + " 💎" + formatNum(currentUserData.gems || 0);
    document.getElementById('profileFamilyValue').textContent = currentFamilyId ? 'Joined' : 'None';
    document.getElementById('profileLangValue').textContent = currentUserData.language || 'English';

    if (!currentUserData.profileId && !profileIdBeingGenerated) {
      profileIdBeingGenerated = true;
      const newId = String(Math.floor(10000000 + Math.random() * 90000000));
      db.ref('users/' + currentUser.uid).update({ profileId: newId }).then(() => {
        profileIdBeingGenerated = false;
      });
      document.getElementById('profileIdNumber').textContent = newId;
      document.getElementById('myReferralCode').textContent = newId;
    } else {
      document.getElementById('profileIdNumber').textContent = currentUserData.profileId || '—';
      document.getElementById('myReferralCode').textContent = currentUserData.profileId || '—';
    }

    document.getElementById('referredStatusText').textContent = currentUserData.referredBy
      ? "✅ You've already used a referral code."
      : "";
    renderMilestones();
  }

  function openProfile() {
    renderProfile();
    renderLanguageList();
    renderMilestones();
    document.getElementById('profileOverlay').classList.add('show');
  }

  function closeProfile() {
    document.getElementById('profileOverlay').classList.remove('show');
    hideAllProfileSubViews();
  }

  function hideAllProfileSubViews() {
    document.getElementById('inviteView').style.display = 'none';
    document.getElementById('languageView').style.display = 'none';
    document.getElementById('settingsView').style.display = 'none';
    document.getElementById('editProfileView').style.display = 'none';
    document.getElementById('accountSecurityView').style.display = 'none';
    document.getElementById('infoPageView').style.display = 'none';
    document.getElementById('profileMainView').style.display = 'block';
    currentProfileSubView = null;
  }

  function copyProfileId() {
    const id = document.getElementById('profileIdNumber').textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(id).then(() => toast('ID copied: ' + id));
    }
  }

  function goToFamilyFromProfile() {
    closeProfile();
    switchTab('family');
  }

  let currentRankTab = 'honor';
  let currentRankSubtab = 'today';

  function openRankView() {
    document.getElementById('rankOverlay').classList.add('show');
    loadLeaderboard();
  }

  function closeRankView() {
    document.getElementById('rankOverlay').classList.remove('show');
  }

  // ---------- VIP BENEFITS (currency-localized, payment not yet connected) ----------
  const VIP_TIERS = [
    { tier: 1, usd: 1 }, { tier: 2, usd: 5 }, { tier: 3, usd: 10 },
    { tier: 4, usd: 20 }, { tier: 5, usd: 40 }, { tier: 6, usd: 75 },
    { tier: 7, usd: 150 }, { tier: 8, usd: 300 }, { tier: 9, usd: 600 },
    { tier: 10, usd: 1200 }, { tier: 11, usd: 2500 }, { tier: 12, usd: 5000 }
  ];

  const CURRENCY_MAP = {
    'SA': { code: 'SAR', rate: 3.75, symbol: 'ر.س' },
    'PK': { code: 'PKR', rate: 278, symbol: 'Rs' },
    'AE': { code: 'AED', rate: 3.67, symbol: 'د.إ' },
    'IN': { code: 'INR', rate: 83, symbol: '₹' },
    'GB': { code: 'GBP', rate: 0.79, symbol: '£' },
    'US': { code: 'USD', rate: 1, symbol: '$' }
  };

  function detectUserCurrency() {
    const lang = navigator.language || 'en-US';
    const region = (lang.split('-')[1] || '').toUpperCase();
    return CURRENCY_MAP[region] || CURRENCY_MAP['US'];
  }

  function formatLocalPrice(usdAmount) {
    const cur = detectUserCurrency();
    const localAmount = usdAmount * cur.rate;
    const decimals = localAmount < 10 ? 2 : 1;
    return cur.symbol + localAmount.toFixed(decimals);
  }

  const GEMS_PACKAGES = [
    { gems: 50, usd: 1.99 },
    { gems: 100, usd: 3.99 },
    { gems: 250, usd: 8.99 },
    { gems: 500, usd: 16.99 },
    { gems: 1000, usd: 29.99 }
  ];

  function renderGemsPackages() {
    const listEl = document.getElementById('gemsPackagesList');
    listEl.innerHTML = '';
    GEMS_PACKAGES.forEach((pkg) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:16px; padding:12px 16px;';
      row.innerHTML = `
        <div style="font-weight:700; font-family:'Fredoka','Inter',sans-serif; color:#fff; font-size:14px;">💎 ${formatNum(pkg.gems)} Gems</div>
        <button onclick="rechargeVip()" style="background:linear-gradient(90deg,#ff6b9d,#c44dff); border:none; color:#fff; padding:8px 16px; border-radius:14px; font-weight:700; font-size:13px; cursor:pointer;">${formatLocalPrice(pkg.usd)}</button>
      `;
      listEl.appendChild(row);
    });
  }

  function openVipBenefits() {
    const currentTier = (currentUserData && currentUserData.realVipTier) || 0;
    const nextTierInfo = VIP_TIERS.find(t => t.tier === currentTier + 1) || VIP_TIERS[VIP_TIERS.length - 1];

    document.getElementById('vtcBadge').textContent = 'VIP ' + currentTier;
    document.getElementById('vtcTierLabel').textContent = 'VIP' + nextTierInfo.tier;
    document.getElementById('vtcAmount').textContent = formatLocalPrice(nextTierInfo.usd);
    document.getElementById('vtcProgressText').textContent = '0 / 100';
    document.getElementById('vtcProgressFill').style.width = '0%';
    renderGemsPackages();

    document.getElementById('vipBenefitsOverlay').classList.add('show');
  }

  function closeVipBenefits() {
    document.getElementById('vipBenefitsOverlay').classList.remove('show');
  }

  function rechargeVip() {
    toast('Real payments are coming soon in ' + detectUserCurrency().code + '!');
  }

  function switchRankTab(tab) {
    currentRankTab = tab;
    document.querySelectorAll('.rank-tab').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    loadLeaderboard();
  }

  function switchRankSubtab(sub) {
    currentRankSubtab = sub;
    document.querySelectorAll('.rank-subtab').forEach(el => {
      el.classList.toggle('active', el.dataset.sub === sub);
    });
    loadLeaderboard();
  }

  function loadLeaderboard() {
    const listEl = document.getElementById('rankList');
    listEl.innerHTML = '<div class="loading">Loading leaderboard...</div>';

    if (currentRankTab !== 'honor') {
      listEl.innerHTML = '<div class="loading">Coming soon for this category.</div>';
      return;
    }
    if (currentRankSubtab !== 'today') {
      listEl.innerHTML = '<div class="loading">Coming soon — check back later.</div>';
      return;
    }

    db.ref('users').orderByChild('coins').limitToLast(30).once('value').then((snap) => {
      const data = snap.val();
      listEl.innerHTML = '';
      if (!data) {
        listEl.innerHTML = '<div class="loading">No players yet.</div>';
        return;
      }
      const players = Object.values(data).sort((a, b) => (b.coins || 0) - (a.coins || 0));
      players.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'rank-row';
        row.innerHTML = `
          <div class="rank-num">${i + 1}</div>
          <div class="rank-avatar">${escapeHtml((p.name || 'U').charAt(0).toUpperCase())}</div>
          <div class="rank-info">
            <div class="rank-name">${escapeHtml(p.name || 'User')}</div>
            <div class="rank-sub">ID Lv. ${p.level || 1}</div>
          </div>
          <div class="rank-value">🪙 ${formatNum(p.coins || 0)}</div>
        `;
        listEl.appendChild(row);
      });
    });
  }

  // ---------- NOTIFICATIONS / ACTIVITY / FRIENDS ----------
  let currentListMode = 'notifications';

  function openListOverlay(mode) {
    currentLis
