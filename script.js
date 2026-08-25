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

  (function setupBannerSlider() {
    const track = document.getElementById('topbarBannerTrack');
    if (!track) return;
    const slideCount = track.children.length;
    let current = 0;

    function goToSlide(i) {
      current = i;
      track.style.transform = `translateX(-${i * 100}%)`;
    }

    setInterval(() => {
      goToSlide((current + 1) % slideCount);
    }, 4000);
  })();

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
      const overlays = document.querySelectorAll('.ttt-overlay.show, .profile-overlay.show, .rank-overlay.show, .seat-actions-sheet.show');
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
  const MAX_OFFLINE_FARMING_MS = 8 * 60 * 60 * 1000; // coins stop accumulating past 8 hours offline

  // ---- FARM ECONOMY CONFIG (edit these to rebalance the whole game) ----
  // Coins produced per 30-minute cycle at each Account/Farm Level checkpoint.
  // Levels between checkpoints are smoothly interpolated; levels beyond the
  // last checkpoint keep growing at that checkpoint's growth rate.
  const FARM_PRODUCTION_CHECKPOINTS = [
    { level: 1, coins: 50 },
    { level: 2, coins: 75 },
    { level: 3, coins: 100 },
    { level: 4, coins: 140 },
    { level: 5, coins: 200 },
    { level: 6, coins: 280 },
    { level: 7, coins: 400 },
    { level: 8, coins: 550 },
    { level: 9, coins: 750 },
    { level: 10, coins: 1000 },
    { level: 11, coins: 1500 },
    { level: 12, coins: 2200 },
    { level: 15, coins: 5000 },
    { level: 20, coins: 15000 },
    { level: 30, coins: 50000 },
    { level: 40, coins: 150000 },
    { level: 50, coins: 350000 },
    { level: 60, coins: 700000 },
    { level: 75, coins: 1500000 },
    { level: 100, coins: 5000000 }
  ];
  // Gem cost to upgrade to the NEXT level, as a function of the level being left.
  // Superlinear growth so higher levels take meaningfully longer to reach.
  // Farm Tier upgrades now cost GOLD, scaled to the balanced production curve above —
  // roughly this many 30-minute harvest cycles worth of gold per upgrade.
  const UPGRADE_COST_CYCLES = 30;

  function getProductionForLevel(level) {
    const cps = FARM_PRODUCTION_CHECKPOINTS;
    if (level <= cps[0].level) return cps[0].coins;
    for (let i = 0; i < cps.length - 1; i++) {
      const lo = cps[i], hi = cps[i + 1];
      if (level >= lo.level && level <= hi.level) {
        if (level === lo.level) return lo.coins;
        if (level === hi.level) return hi.coins;
        const frac = (level - lo.level) / (hi.level - lo.level);
        return Math.round(lo.coins * Math.pow(hi.coins / lo.coins, frac));
      }
    }
    // Beyond the last checkpoint: keep growing at the final segment's per-level rate
    const last = cps[cps.length - 1];
    const prev = cps[cps.length - 2];
    const ratioPerLevel = Math.pow(last.coins / prev.coins, 1 / (last.level - prev.level));
    const extraLevels = level - last.level;
    return Math.round(last.coins * Math.pow(ratioPerLevel, extraLevels));
  }

  const PLOTS = [
    { label: 'Lv.1', requiredLevel: 1, bonus: 50 },
    { label: 'Lv.2', requiredLevel: 2, bonus: 25 },
    { label: 'Lv.3', requiredLevel: 3, bonus: 25 },
    { label: 'Lv.4', requiredLevel: 4, bonus: 40 },
    { label: 'Lv.5', requiredLevel: 5, bonus: 60 },
    { label: 'Lv.6', requiredLevel: 6, bonus: 80 },
    { label: 'VIP8', requiredLevel: 8, bonus: 270 },
    { label: 'VIP10', requiredLevel: 10, bonus: 450 },
    { label: 'VIP12', requiredLevel: 12, bonus: 1200 },
    { label: 'VIP15', requiredLevel: 15, bonus: 2800 }
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
          checkAdminStatus();
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
    document.getElementById('profileVipLevelBadge').textContent = "👑 VIP " + (currentUserData.realVipTier || 0);
    document.getElementById('profileRoomLevelBadge').textContent = "🎁 Room Lv. " + getGroupLevelInfo(currentUserData.roomXP || 0).level;
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

  const RANK_CATEGORY_CONFIG = {
    honor: { field: 'coins', icon: '🪙', label: 'ID Lv.', labelField: 'level' },
    vip: { field: 'realVipTier', icon: '👑', label: 'VIP', labelField: null },
    charm: { field: 'charmScore', icon: '💖', label: 'Charm', labelField: null },
    boss: { field: 'bossScore', icon: '💸', label: 'Boss', labelField: null }
  };

  function loadLeaderboard() {
    const listEl = document.getElementById('rankList');
    listEl.innerHTML = '<div class="loading">Loading leaderboard...</div>';

    if (currentRankSubtab !== 'today') {
      listEl.innerHTML = '<div class="loading">Coming soon — check back later.</div>';
      return;
    }

    if (currentRankTab === 'rooms') {
      loadRoomsLeaderboard(listEl);
      return;
    }

    const config = RANK_CATEGORY_CONFIG[currentRankTab];
    if (!config) {
      listEl.innerHTML = '<div class="loading">Coming soon for this category.</div>';
      return;
    }

    db.ref('users').orderByChild(config.field).limitToLast(30).once('value').then((snap) => {
      const data = snap.val();
      listEl.innerHTML = '';
      if (!data) {
        listEl.innerHTML = '<div class="loading">No players yet.</div>';
        return;
      }
      const players = Object.values(data).sort((a, b) => (b[config.field] || 0) - (a[config.field] || 0));
      players.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'rank-row';
        const subText = config.labelField ? (config.label + ' ' + (p[config.labelField] || 1)) : ('ID Lv. ' + (p.level || 1));
        row.innerHTML = `
          <div class="rank-num">${i + 1}</div>
          <div class="rank-avatar">${escapeHtml((p.name || 'U').charAt(0).toUpperCase())}</div>
          <div class="rank-info">
            <div class="rank-name">${escapeHtml(p.name || 'User')}</div>
            <div class="rank-sub">${subText}</div>
          </div>
          <div class="rank-value">${config.icon} ${formatNum(p[config.field] || 0)}</div>
        `;
        listEl.appendChild(row);
      });
    });
  }

  function loadRoomsLeaderboard(listEl) {
    db.ref('liveRooms').orderByChild('activityScore').limitToLast(30).once('value').then((snap) => {
      const data = snap.val();
      listEl.innerHTML = '';
      if (!data) {
        listEl.innerHTML = '<div class="loading">No active rooms yet.</div>';
        return;
      }
      const rooms = Object.entries(data)
        .map(([id, r]) => ({ id, ...r }))
        .sort((a, b) => (b.activityScore || 0) - (a.activityScore || 0));
      rooms.forEach((r, i) => {
        const onlineCount = r.seats ? Object.keys(r.seats).length : 0;
        const row = document.createElement('div');
        row.className = 'rank-row';
        row.style.cursor = 'pointer';
        row.innerHTML = `
          <div class="rank-num">${i + 1}</div>
          <div class="rank-avatar">${escapeHtml((r.name || 'R').charAt(0).toUpperCase())}</div>
          <div class="rank-info">
            <div class="rank-name">${escapeHtml(r.name || 'Room')}</div>
            <div class="rank-sub">🟢 ${onlineCount} online</div>
          </div>
          <div class="rank-value">🔥 ${formatNum(r.activityScore || 0)}</div>
        `;
        row.onclick = () => { closeRankView(); switchTab('room'); enterRoom(r.id, r.name); };
        listEl.appendChild(row);
      });
    });
  }

  // ---------- NOTIFICATIONS / ACTIVITY / FRIENDS ----------
  let currentListMode = 'notifications';

  function openListOverlay(mode) {
    currentListMode = mode;
    document.getElementById('listOverlay').classList.add('show');
    const titleMap = { notifications: '🔔 Notifications', activity: '🎁 Activity', friends: '❤️ Friends', quickgift: '🎁 Pick Recipient', giftlog: '📦 Gift Log', blocked: '🚫 Blocked Users' };
    document.getElementById('listOverlayTitle').textContent = titleMap[mode];
    document.getElementById('friendsAddBox').style.display = mode === 'friends' ? 'block' : 'none';
    loadListOverlayContent();
  }

  function closeListOverlay() {
    document.getElementById('listOverlay').classList.remove('show');
  }

  function openQuickGiftPicker() { openListOverlay('quickgift'); }
  function openGiftLog() { openListOverlay('giftlog'); }

  function loadListOverlayContent() {
    const contentEl = document.getElementById('listOverlayContent');
    contentEl.innerHTML = '<div class="loading">Loading...</div>';
    if (currentListMode === 'friends') {
      loadFriendsList(contentEl);
    } else if (currentListMode === 'quickgift') {
      loadQuickGiftList(contentEl);
    } else if (currentListMode === 'giftlog') {
      loadGiftLog(contentEl);
    } else if (currentListMode === 'blocked') {
      loadBlockedList(contentEl);
    } else {
      loadActivityList(contentEl, currentListMode === 'notifications' ? 'social' : 'personal');
    }
  }

  function loadBlockedList(contentEl) {
    const blocked = (currentUserData && currentUserData.blocked) || {};
    const uids = Object.keys(blocked);
    if (!uids.length) { contentEl.innerHTML = '<div class="loading">You haven\'t blocked anyone.</div>'; return; }
    contentEl.innerHTML = '';
    uids.forEach((uid) => {
      db.ref('users/' + uid).once('value').then((snap) => {
        const u = snap.val();
        const name = u ? u.name : 'Unknown User';
        const row = document.createElement('div');
        row.className = 'rank-row';
        row.innerHTML = `<div class="m-avatar" style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#ff6b9d,#c44dff);display:flex;align-items:center;justify-content:center;font-weight:700;">${escapeHtml(name.charAt(0).toUpperCase())}</div>
          <div style="flex:1;padding-left:10px;font-weight:600;">${escapeHtml(name)}</div>
          <button style="background:rgba(255,255,255,0.1);border:none;color:#fff;padding:8px 14px;border-radius:14px;font-size:12px;font-weight:600;cursor:pointer;">Unblock</button>`;
        row.querySelector('button').onclick = () => unblockUser(uid);
        contentEl.appendChild(row);
      });
    });
  }

  function unblockUser(uid) {
    db.ref('users/' + currentUser.uid + '/blocked/' + uid).remove().then(() => {
      loadListOverlayContent();
    });
  }

  function loadQuickGiftList(contentEl) {
    if (!currentRoomId) { contentEl.innerHTML = '<div class="loading">Join a room first.</div>'; return; }
    db.ref('liveRooms/' + currentRoomId + '/seats').once('value').then((snap) => {
      const seats = snap.val() || {};
      const others = Object.values(seats).filter(s => currentUser && s.uid !== currentUser.uid);
      contentEl.innerHTML = '';
      if (!others.length) { contentEl.innerHTML = '<div class="loading">No one else is seated yet.</div>'; return; }
      others.forEach((seatData) => {
        const row = document.createElement('div');
        row.className = 'rank-row';
        row.style.cursor = 'pointer';
        row.innerHTML = `<div class="rank-avatar">${escapeHtml(seatData.name.charAt(0).toUpperCase())}</div><div class="rank-info"><div class="rank-name">${escapeHtml(seatData.name)}</div></div>`;
        row.onclick = () => { closeListOverlay(); openGiftPicker(seatData.uid, seatData.name); };
        contentEl.appendChild(row);
      });
    });
  }

  function loadGiftLog(contentEl) {
    if (!currentRoomId) { contentEl.innerHTML = '<div class="loading">Join a room first.</div>'; return; }
    db.ref('liveRooms/' + currentRoomId + '/messages').limitToLast(100).once('value').then((snap) => {
      const data = snap.val();
      contentEl.innerHTML = '';
      if (!data) { contentEl.innerHTML = '<div class="loading">No gifts sent yet in this room.</div>'; return; }
      const gifts = Object.values(data).filter(m => m.text && m.text.indexOf('🎁') === 0).sort((a, b) => b.timestamp - a.timestamp);
      if (!gifts.length) { contentEl.innerHTML = '<div class="loading">No gifts sent yet in this room.</div>'; return; }
      gifts.forEach((g) => {
        const row = document.createElement('div');
        row.className = 'rank-row';
        row.innerHTML = `<div class="rank-avatar">${escapeHtml(g.name.charAt(0).toUpperCase())}</div><div class="rank-info"><div class="rank-name">${escapeHtml(g.name)} ${escapeHtml(g.text)}</div><div class="rank-sub">${timeAgo(g.timestamp)}</div></div>`;
        contentEl.appendChild(row);
      });
    });
  }

  function loadActivityList(contentEl, filterType) {
    db.ref('users/' + currentUser.uid + '/activity').limitToLast(50).once('value').then((snap) => {
      const data = snap.val();
      const emptyMsg = filterType === 'social' ? '🔔 No notifications yet — gifts and friend activity will show up here.' : '🎁 No activity yet — your actions will show up here.';
      contentEl.innerHTML = '';
      if (!data) { contentEl.innerHTML = `<div class="loading">${emptyMsg}</div>`; return; }
      const items = Object.values(data).filter(a => a.type === filterType).sort((a, b) => b.timestamp - a.timestamp);
      if (!items.length) { contentEl.innerHTML = `<div class="loading">${emptyMsg}</div>`; return; }
      items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'rank-row';
        row.innerHTML = `<div class="rank-info"><div class="rank-name">${escapeHtml(item.text)}</div><div class="rank-sub">${timeAgo(item.timestamp)}</div></div>`;
        contentEl.appendChild(row);
      });
    });
  }

  function loadFriendsList(contentEl) {
    db.ref('users/' + currentUser.uid + '/friends').once('value').then((snap) => {
      const friends = snap.val();
      contentEl.innerHTML = '';
      if (!friends) { contentEl.innerHTML = '<div class="loading">No friends yet. Add one by ID above!</div>'; return; }
      const uids = Object.keys(friends);
      uids.forEach((uid) => {
        db.ref('users/' + uid).once('value').then((uSnap) => {
          const u = uSnap.val();
          if (!u) return;
          const row = document.createElement('div');
          row.className = 'rank-row';
          row.innerHTML = `<div class="rank-avatar">${escapeHtml((u.name || 'U').charAt(0).toUpperCase())}</div><div class="rank-info"><div class="rank-name">${escapeHtml(u.name || 'User')}</div><div class="rank-sub">VIP ${u.realVipTier || 0}</div></div>`;
          contentEl.appendChild(row);
        });
      });
    });
  }

  function addFriendById() {
    const input = document.getElementById('addFriendIdInput');
    const code = input.value.trim();
    const statusEl = document.getElementById('addFriendStatus');
    if (!code) return;
    if (code === currentUserData.profileId) { statusEl.textContent = "❌ That's your own ID."; return; }

    db.ref('users').orderByChild('profileId').equalTo(code).once('value').then((snap) => {
      const results = snap.val();
      if (!results) { statusEl.textContent = "❌ No user found with that ID."; return; }
      const friendUid = Object.keys(results)[0];
      db.ref('users/' + currentUser.uid + '/friends/' + friendUid).set(true);
      db.ref('users/' + friendUid + '/friends/' + currentUser.uid).set(true);
      addActivity(friendUid, 'social', currentUserData.name + ' added you as a friend!');
      statusEl.textContent = "✅ Friend added!";
      input.value = '';
      loadFriendsList(document.getElementById('listOverlayContent'));
    });
  }

  function timeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    return Math.floor(hours / 24) + 'd ago';
  }

  function addActivity(uid, type, text) {
    db.ref('users/' + uid + '/activity').push({ type: type, text: text, timestamp: Date.now() });
  }

  // ---------- MOMENTS ----------
  let momentsListenerAttached = false;

  function listenToMoments() {
    if (momentsListenerAttached) return;
    momentsListenerAttached = true;
    db.ref('moments').limitToLast(50).on('value', (snap) => {
      const feedEl = document.getElementById('momentsFeed');
      const data = snap.val();
      feedEl.innerHTML = '';
      if (!data) {
        feedEl.innerHTML = '<div class="loading">No moments yet. Tap + to share something!</div>';
        return;
      }
      const posts = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
      posts.forEach((post) => {
        if (isUserBlocked(post.uid)) return;
        const card = document.createElement('div');
        card.className = 'moment-card';
        card.innerHTML = `
          <div class="mc-header">
            <div class="mc-avatar">${escapeHtml((post.name || 'U').charAt(0).toUpperCase())}</div>
            <div>
              <div class="mc-name">${escapeHtml(post.name || 'User')}</div>
              <div class="mc-time">${timeAgo(post.timestamp)}</div>
            </div>
          </div>
          ${post.text ? `<div class="mc-text">${escapeHtml(post.text)}</div>` : ''}
          ${post.imageUrl ? `<img class="mc-image" src="${escapeHtml(post.imageUrl)}" onerror="this.style.display='none'">` : ''}
        `;
        feedEl.appendChild(card);
      });
    });
  }

  function openNewPostOverlay() {
    document.getElementById('newPostOverlay').classList.add('show');
  }

  function closeNewPostOverlay() {
    document.getElementById('newPostOverlay').classList.remove('show');
  }

  function submitNewPost() {
    const textEl = document.getElementById('newPostText');
    const imgEl = document.getElementById('newPostImageUrl');
    const text = textEl.value.trim();
    const imageUrl = imgEl.value.trim();
    if (!text && !imageUrl) { alert('Write something or add an image URL first.'); return; }

    db.ref('moments').push({
      uid: currentUser.uid,
      name: currentUserData.name,
      text: text,
      imageUrl: imageUrl,
      timestamp: Date.now()
    }).then(() => {
      textEl.value = '';
      imgEl.value = '';
      closeNewPostOverlay();
    });
  }

  let currentProfileSubView = null;

  function openInviteView() {
    document.getElementById('profileMainView').style.display = 'none';
    document.getElementById('inviteView').style.display = 'block';
    currentProfileSubView = 'invite';
    renderMilestones();
  }

  function openLanguageView() {
    document.getElementById('profileMainView').style.display = 'none';
    document.getElementById('languageView').style.display = 'block';
    currentProfileSubView = 'language';
  }

  function openSettingsView() {
    document.getElementById('profileMainView').style.display = 'none';
    document.getElementById('settingsView').style.display = 'block';
    currentProfileSubView = 'settings';
  }

  function openAccountSecurityView() {
    document.getElementById('profileMainView').style.display = 'none';
    document.getElementById('settingsView').style.display = 'none';
    document.getElementById('accountSecurityView').style.display = 'block';
    currentProfileSubView = 'accountSecurity';
    document.getElementById('secEmailDisplay').textContent = (currentUser && currentUser.email) || '—';
  }

  function closeAccountSecurityView() {
    document.getElementById('accountSecurityView').style.display = 'none';
    document.getElementById('settingsView').style.display = 'block';
    currentProfileSubView = 'settings';
  }

  function sendChangePasswordEmail() {
    if (!currentUser || !currentUser.email) return;
    auth.sendPasswordResetEmail(currentUser.email).then(() => {
      toast('Reset link sent to ' + currentUser.email + '!');
    }).catch((err) => {
      alert(err.message);
    });
  }

  const INFO_PAGES = {
    terms: {
      title: 'Terms of Use',
      body: `Welcome to Party App! By using this app, you agree to the following terms:

1. ACCOUNT — You are responsible for keeping your login details safe. You must be at least 13 years old to use this app.

2. IN-APP CURRENCY — Coins, Gems, and Love Coins are virtual items with no real-world monetary value. They cannot be exchanged for cash and have no guaranteed value.

3. ACCEPTABLE USE — You agree not to harass, threaten, or abuse other users. Hate speech, spam, and impersonation are not allowed. We may suspend or remove accounts that break these rules.

4. CONTENT — Anything you post (chat messages, moments, images) must not be illegal, harmful, or infringe others' rights. You are responsible for what you post.

5. CHANGES — We may update the app, these terms, or remove features at any time.

6. NO WARRANTY — The app is provided "as is" without guarantees. We are not liable for lost virtual items, downtime, or data loss.

By continuing to use Party App, you accept these terms.`
    },
    privacy: {
      title: 'Privacy Policy',
      body: `Your privacy matters to us. Here's what we collect and why:

1. INFORMATION WE COLLECT — Your name, email address, and any profile details you add (bio, gender, date of birth, region). Also app activity like coins earned, messages sent, and rooms joined.

2. HOW WE USE IT — To run your account, show your profile to other users, enable chat/gifting/family features, and improve the app.

3. STORAGE — Data is stored securely using Firebase (Google Cloud infrastructure) and is only accessible to logged-in users as needed for app features.

4. SHARING — We do not sell your personal data. Other users can see your public profile info (name, level, bio) as part of normal app use.

5. YOUR CONTROLS — You can edit or delete your profile info anytime from Settings. You can block other users to stop seeing their content.

6. CONTACT — For privacy questions, reach out via Help & Feedback in Settings.`
    },
    guidelines: {
      title: 'Community Guidelines',
      body: `To keep Party App fun and safe for everyone:

✅ Be respectful — treat others how you'd like to be treated.
✅ Keep chat and Moments posts appropriate — no nudity, violence, or illegal content.
✅ No harassment, bullying, hate speech, or discrimination.
✅ No spamming links, ads, or scams in chat.
✅ Don't impersonate other people or share others' private info.
✅ Report anything that breaks these rules using the 🚩 Report button on a user's profile.

Breaking these guidelines may result in a warning, temporary restriction, or permanent ban depending on severity.`
    }
  };

  function openInfoPage(key) {
    document.getElementById('profileMainView').style.display = 'none';
    document.getElementById('settingsView').style.display = 'none';
    document.getElementById('infoPageView').style.display = 'block';
    currentProfileSubView = 'infoPage';
    const page = INFO_PAGES[key];
    document.getElementById('infoPageTitle').textContent = page.title;
    document.getElementById('infoPageBody').textContent = page.body;
  }

  function closeInfoPage() {
    document.getElementById('infoPageView').style.display = 'none';
    document.getElementById('settingsView').style.display = 'block';
    currentProfileSubView = 'settings';
  }

  function openEditProfileView() {
    document.getElementById('profileMainView').style.display = 'none';
    document.getElementById('settingsView').style.display = 'none';
    document.getElementById('editProfileView').style.display = 'block';
    currentProfileSubView = 'editProfile';

    document.getElementById('editAvatarBig').textContent = currentUserData.name.charAt(0).toUpperCase();
    document.getElementById('editBioInput').value = currentUserData.bio || '';
    document.getElementById('editNameInput').value = currentUserData.name || '';
    document.getElementById('editGenderInput').value = currentUserData.gender || 'Male';
    document.getElementById('editDobInput').value = currentUserData.dob || '';
    document.getElementById('editRegionInput').value = currentUserData.region || '';
  }

  function saveEditProfile() {
    if (!currentUser) return;
    const newName = document.getElementById('editNameInput').value.trim();
    const newBio = document.getElementById('editBioInput').value.trim();
    if (!newName) { alert('Name cannot be empty.'); return; }
    if (containsBadWords(newName) || containsBadWords(newBio)) { alert('Please keep your name and bio appropriate.'); return; }

    db.ref('users/' + currentUser.uid).update({
      name: newName,
      bio: newBio,
      gender: document.getElementById('editGenderInput').value,
      dob: document.getElementById('editDobInput').value,
      region: document.getElementById('editRegionInput').value.trim()
    }).then(() => {
      toast('Profile updated!');
      hideAllProfileSubViews();
    });
  }

  function handleProfileBack() {
    if (currentProfileSubView) {
      hideAllProfileSubViews();
    } else {
      closeProfile();
    }
  }

  const LANGUAGES = ['English','عربي','Türkçe','Bahasa Indonesia','Español','Português','Filipino','Tiếng Việt','Italiano','हिन्दी'];

  function renderLanguageList() {
    const listEl = document.getElementById('languageList');
    listEl.innerHTML = '';
    const currentLang = (currentUserData && currentUserData.language) || 'English';
    LANGUAGES.forEach((lang) => {
      const item = document.createElement('div');
      item.className = 'language-item' + (lang === currentLang ? ' selected' : '');
      item.innerHTML = `<span>${lang}</span><span class="lang-check">✓</span>`;
      item.onclick = () => selectLanguage(lang);
      listEl.appendChild(item);
    });
  }

  function selectLanguage(lang) {
    if (!currentUser) return;
    db.ref('users/' + currentUser.uid).update({ language: lang });
    document.getElementById('profileLangValue').textContent = lang;
    renderLanguageList();
  }

  const MILESTONES = [
    { need: 3, gems: 600 },
    { need: 10, gems: 1000 },
    { need: 50, gems: 2400 }
  ];

  function renderMilestones() {
    if (!currentUserData) return;
    const referralCount = currentUserData.referralCount || 0;
    document.getElementById('milestoneProgressText').textContent = referralCount + " friend" + (referralCount !== 1 ? 's' : '') + " invited";

    const rowEl = document.getElementById('milestoneRow');
    rowEl.innerHTML = '';
    MILESTONES.forEach((m) => {
      const claimedField = 'milestoneClaimed' + m.need;
      const alreadyClaimed = !!currentUserData[claimedField];
      const canClaim = !alreadyClaimed && referralCount >= m.need;

      const cell = document.createElement('div');
      cell.className = 'milestone-cell';
      let btnClass = 'm-btn';
      let btnContent = '🔒';
      if (alreadyClaimed) { btnClass += ' claimed'; btnContent = '✓'; }
      else if (canClaim) { btnClass += ' claimable'; btnContent = '🎁'; }

      cell.innerHTML = `
        <div class="m-gems">+${m.gems}💎</div>
        <div class="${btnClass}" onclick="${canClaim ? `claimMilestone(${m.need}, ${m.gems})` : ''}">${btnContent}</div>
        <div class="m-need">${m.need} friends</div>
      `;
      rowEl.appendChild(cell);
    });
  }

  function claimMilestone(need, gems) {
    if (!currentUser || !currentUserData) return;
    const claimedField = 'milestoneClaimed' + need;
    if (currentUserData[claimedField]) return;
    if ((currentUserData.referralCount || 0) < need) return;

    const update = {};
    update[claimedField] = true;
    update.gems = (currentUserData.gems || 0) + gems;
    db.ref('users/' + currentUser.uid).update(update).then(() => {
      addActivity(currentUser.uid, 'personal', 'Claimed ' + need + '-friend milestone: +' + gems + ' gems');
    });
  }

  function copyReferralCode() {
    const code = document.getElementById('myReferralCode').textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => toast('Referral code copied: ' + code));
    }
  }

  function redeemReferralCode() {
    const input = document.getElementById('redeemCodeInput');
    const code = input.value.trim();
    const statusEl = document.getElementById('referredStatusText');
    if (!code) return;

    if (currentUserData.referredBy) {
      statusEl.textContent = "❌ You've already used a referral code.";
      return;
    }
    if (code === currentUserData.profileId) {
      statusEl.textContent = "❌ You can't use your own code.";
      return;
    }

    db.ref('users').orderByChild('profileId').equalTo(code).once('value').then((snap) => {
      const results = snap.val();
      if (!results) {
        statusEl.textContent = "❌ Invalid referral code.";
        return;
      }
      const referrerUid = Object.keys(results)[0];
      const referrerData = results[referrerUid];

      db.ref('users/' + currentUser.uid).update({
        gems: (currentUserData.gems || 0) + 50,
        referredBy: code
      });
      db.ref('users/' + referrerUid).update({
        gems: (referrerData.gems || 0) + 50,
        referralCount: (referrerData.referralCount || 0) + 1
      });

      addActivity(currentUser.uid, 'personal', 'You redeemed a referral code: +💎50 gems');
      addActivity(referrerUid, 'social', currentUserData.name + ' used your referral code! +💎50 gems');

      statusEl.textContent = "✅ Success! You both received 💎 50 gems.";
      input.value = '';
    });
  }

  function renderLevelCard() {
    const level = currentUserData.level || 1;
    const xp = currentUserData.xp || 0;
    const xpIntoLevel = xp % XP_PER_LEVEL;
    document.getElementById('famLevelLabel').textContent = "ID Level " + level;
    document.getElementById('famXpLabel').textContent = xpIntoLevel + " / " + XP_PER_LEVEL + " XP";
    document.getElementById('xpBarFill').style.width = ((xpIntoLevel / XP_PER_LEVEL) * 100) + "%";

    const createBtn = document.getElementById('createFamilyBtn');
    const lockMsg = document.getElementById('createLockMsg');
    if (level < LEVEL_REQUIRED_TO_CREATE) {
      createBtn.disabled = true;
      lockMsg.style.display = 'block';
      lockMsg.textContent = "🔒 Unlocks at Level " + LEVEL_REQUIRED_TO_CREATE + " (chat to earn XP)";
    } else {
      createBtn.disabled = false;
      lockMsg.style.display = 'none';
    }
  }

  function addXp(amount) {
    if (!currentUser || !currentUserData) return;
    const newXp = (currentUserData.xp || 0) + amount;
    const xpBasedLevel = Math.floor(newXp / XP_PER_LEVEL) + 1;
    const newLevel = Math.max(currentUserData.level || 1, xpBasedLevel);
    db.ref('users/' + currentUser.uid).update({ xp: newXp, level: newLevel });
  }

  // ---------- TAB SWITCHING ----------
  function setGlobalTopbarVisible(visible) {
    document.querySelector('.topbar').style.display = visible ? 'flex' : 'none';
    requestAnimationFrame(setAppHeight);
    setTimeout(setAppHeight, 150);
  }

  function switchTab(tab) {
    document.querySelectorAll('.ttt-overlay.show, .profile-overlay.show, .rank-overlay.show, .detail-overlay.show, .emoji-picker.show, .seat-actions-sheet.show').forEach((el) => el.classList.remove('show'));

    document.getElementById('homePanel').classList.toggle('active', tab === 'hifami');
    document.getElementById('chatPanel').classList.toggle('active', tab === 'messages');
    document.getElementById('familyPanel').classList.toggle('active', tab === 'family');
    document.getElementById('momentsPanel').classList.toggle('active', tab === 'moments');
    document.getElementById('roomPanel').classList.toggle('active', tab === 'room');

    document.getElementById('navHifami').classList.toggle('active', tab === 'hifami');
    document.getElementById('navMessages').classList.toggle('active', tab === 'messages');
    document.getElementById('navFamily').classList.toggle('active', tab === 'family');
    document.getElementById('navMoments').classList.toggle('active', tab === 'moments');
    document.getElementById('navRoom').classList.toggle('active', tab === 'room');

    if (tab === 'family') familyBubbleDismissed = false;
    updateFamilyBubble(tab);

    setGlobalTopbarVisible(tab !== 'family' && tab !== 'room');

    localStorage.setItem('lastTab', tab);
  }

  function getActiveTab() {
    if (document.getElementById('homePanel').classList.contains('active')) return 'hifami';
    if (document.getElementById('familyPanel').classList.contains('active')) return 'family';
    if (document.getElementById('momentsPanel').classList.contains('active')) return 'moments';
    if (document.getElementById('roomPanel').classList.contains('active')) return 'room';
    return 'messages';
  }

  let familyBubbleDismissed = false;

  function updateFamilyBubble(activeTab) {
    const bubble = document.getElementById('familyBubble');
    if (currentFamilyId && activeTab !== 'family' && !familyBubbleDismissed) {
      bubble.classList.add('show');
    } else {
      bubble.classList.remove('show');
    }
  }

  (function makeFamilyBubbleDraggable() {
    const bubble = document.getElementById('familyBubble');
    const closeBtn = document.getElementById('familyBubbleClose');
    let dragging = false;
    let moved = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;

    closeBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      familyBubbleDismissed = true;
      bubble.classList.remove('show');
    });

    bubble.addEventListener('pointerdown', (e) => {
      if (e.target === closeBtn) return;
      dragging = true;
      moved = false;
      bubble.setPointerCapture(e.pointerId);
      const rect = bubble.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      bubble.style.animation = 'none';
    });

    bubble.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true;
      if (!moved) return;
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;
      const maxLeft = window.innerWidth - bubble.offsetWidth;
      const maxTop = window.innerHeight - bubble.offsetHeight;
      newLeft = Math.max(0, Math.min(maxLeft, newLeft));
      newTop = Math.max(0, Math.min(maxTop, newTop));
      bubble.style.left = newLeft + 'px';
      bubble.style.top = newTop + 'px';
      bubble.style.right = 'auto';
      bubble.style.bottom = 'auto';
    });

    bubble.addEventListener('pointerup', (e) => {
      dragging = false;
      bubble.style.animation = '';
      if (!moved && e.target !== closeBtn) {
        switchTab('family');
      }
    });
  })();

  // ---------- HOME / HARVEST ----------
  let harvestIntervalStarted = false;

  function getFarmLevel() {
    return (currentUserData && currentUserData.level) || 1;
  }

  function getProductionAmount() {
    return getProductionForLevel(getFarmLevel());
  }

  function getUpgradeCost() {
    const level = getFarmLevel();
    return Math.round(UPGRADE_COST_CYCLES * getProductionForLevel(level));
  }

  let harvestAtBeingFixed = false;

  function renderHome() {
    if (!currentUserData) return;

    // Fix old accounts that were created before the harvest system existed —
    // without this, lastHarvestAt is missing and coins never accumulate.
    if (!currentUserData.lastHarvestAt && !harvestAtBeingFixed) {
      harvestAtBeingFixed = true;
      db.ref('users/' + currentUser.uid).update({ lastHarvestAt: Date.now() }).then(() => {
        harvestAtBeingFixed = false;
      });
    }

    document.getElementById('coinsDisplay').textContent = formatNum(currentUserData.coins || 0);
    document.getElementById('gemsDisplay').textContent = formatNum(currentUserData.gems || 0);
    document.getElementById('loveDisplay').textContent = formatNum(currentUserData.love || 0);
    const farmLevel = getFarmLevel();
    document.getElementById('homeFarmLevelTag').textContent = "🌾 Farm Level " + farmLevel;
    document.getElementById('rateLabel').textContent = "In 30 min: 🪙 " + formatNum(getProductionAmount());

    const cost = getUpgradeCost();
    const upgradeBtn = document.getElementById('upgradeFarmBtn');
    upgradeBtn.textContent = "Upgrade Farm Tier — 🪙 " + formatNum(cost);
    upgradeBtn.disabled = (currentUserData.coins || 0) < cost;

    if (!harvestIntervalStarted) {
      harvestIntervalStarted = true;
      setInterval(updateHarvestTimer, 1000);
    }
    updateHarvestTimer();
    renderPlots();
  }

  const CROP_EMOJIS = ['🥕','🌽','🥬','🍅','🌻','🥦','🍆','🌾','🥔','🌿'];

  function renderPlots() {
    const farmLevel = getFarmLevel();
    const gridEl = document.getElementById('plotsGrid10');
    gridEl.innerHTML = '';

    PLOTS.forEach((plot, i) => {
      const isUnlocked = farmLevel >= plot.requiredLevel;
      const cell = document.createElement('div');
      if (isUnlocked) {
        cell.className = 'plot10-cell unlocked';
        cell.innerHTML = `<div class="p-emoji">${CROP_EMOJIS[i % CROP_EMOJIS.length]}</div><div class="p-bonus">+${plot.bonus}</div>`;
      } else {
        cell.className = 'plot10-cell locked';
        cell.innerHTML = `<div class="p-emoji">🔒</div><div class="p-label">${plot.label}</div>`;
      }
      gridEl.appendChild(cell);
    });
  }

  function upgradeFarm() {
    if (!currentUser || !currentUserData) return;
    const cost = getUpgradeCost();
    const coins = currentUserData.coins || 0;
    if (coins < cost) { toast('Not enough Gold for this upgrade.', 'error'); return; }

    db.ref('users/' + currentUser.uid).update({
      coins: coins - cost,
      level: getFarmLevel() + 1
    }).then(() => toast('Farm Level upgraded! 🌾'));
  }

  function getAccumulatedCoins() {
    if (!currentUserData) return 0;
    const perSecondRate = getProductionAmount() / (HARVEST_CYCLE_MS / 1000);
    const lastHarvest = currentUserData.lastHarvestAt || Date.now();
    const elapsedMs = Math.min(Math.max(0, Date.now() - lastHarvest), MAX_OFFLINE_FARMING_MS);
    return Math.floor(perSecondRate * (elapsedMs / 1000));
  }

  function updateHarvestTimer() {
    if (!currentUserData) return;
    const accumulated = getAccumulatedCoins();
    const prodEl = document.getElementById('prodValue');
    const timerEl = document.getElementById('harvestTimer');
    const btnEl = document.getElementById('harvestBtn');

    prodEl.textContent = formatNum(accumulated) + " Coins";

    if (accumulated >= 1) {
      timerEl.textContent = "Ready to collect!";
      btnEl.disabled = false;
      btnEl.classList.add('ready');
      btnEl.textContent = "🌾 Collect " + formatNum(accumulated);
    } else {
      timerEl.textContent = "Growing...";
      btnEl.disabled = true;
      btnEl.classList.remove('ready');
      btnEl.textContent = "Collect";
    }
  }

  let harvestInProgress = false;

  function doHarvest() {
    if (!currentUser || !currentUserData) return;
    if (harvestInProgress) return;
    const accumulated = getAccumulatedCoins();
    if (accumulated < 1) return;
    harvestInProgress = true;
    const harvestBtnEl = document.getElementById('harvestBtn');
    if (harvestBtnEl) harvestBtnEl.disabled = true;

    const newCoins = (currentUserData.coins || 0) + accumulated;
    const update = {
      coins: newCoins,
      lastHarvestAt: Date.now()
    };

    // ID Level XP — earned from harvesting (not just chatting)
    const xpFromHarvest = 10;
    const newXp = (currentUserData.xp || 0) + xpFromHarvest;
    update.xp = newXp;
    const xpBasedLevel = Math.floor(newXp / XP_PER_LEVEL) + 1;
    update.level = Math.max(currentUserData.level || 1, xpBasedLevel);

    db.ref('users/' + currentUser.uid).update(update).then(() => {
      showGiftFlash('🪙');
    }).finally(() => {
      harvestInProgress = false;
      const harvestBtnEl = document.getElementById('harvestBtn');
      if (harvestBtnEl) harvestBtnEl.disabled = false;
    });
  }

  function formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(2) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return String(n);
  }

  // ---------- GLOBAL CHAT ----------
  function listenToChat() {
    const chatArea = document.getElementById('chatArea');
    db.ref('rooms/global/messages').limitToLast(50).on('value', (snap) => {
      chatArea.innerHTML = '';
      const messages = snap.val();
      if (!messages) {
        chatArea.innerHTML = '<div class="loading">No messages yet. Say hi! 👋</div>';
        return;
      }
      Object.values(messages).forEach((msg) => {
        if (isUserBlocked(msg.uid)) return;
        const div = document.createElement('div');
        const isMe = msg.uid === currentUser.uid;
        div.className = 'msg ' + (isMe ? 'me' : 'other');
        div.innerHTML = (isMe ? '' : `<div class="sender">${escapeHtml(msg.name)}</div>`) + escapeHtml(msg.text);
        chatArea.appendChild(div);
      });
      chatArea.scrollTop = chatArea.scrollHeight;
    });
  }

  let lastMessageSentAt = 0;
  const MESSAGE_COOLDOWN_MS = 1200;

  function isChatRateLimited() {
    const now = Date.now();
    if (now - lastMessageSentAt < MESSAGE_COOLDOWN_MS) {
      toast('Slow down a little! 🙂', 'error');
      return true;
    }
    lastMessageSentAt = now;
    return false;
  }

  function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text || !currentUser) return;
    if (isChatRateLimited()) return;

    db.ref('rooms/global/messages').push({
      uid: currentUser.uid,
      name: currentUserData.name,
      text: text,
      timestamp: Date.now()
    });
    addXp(XP_PER_MESSAGE);
    input.value = '';
  }

  // ---------- FAMILY LIST (browse) ----------
  let familyListCache = null;

  function listenToFamilyList() {
    if (familyListListenerAttached) return;
    familyListListenerAttached = true;
    db.ref('families').on('value', (snap) => {
      familyListCache = snap.val();
      renderFamilyList();
    });
  }

  function renderFamilyList() {
    const listEl = document.getElementById('familyList');
    const families = familyListCache;
    if (!families) {
      listEl.innerHTML = '<div class="loading">No families yet. Be the first to create one! 🎊</div>';
      return;
    }
    const query = (document.getElementById('familySearchInput').value || '').trim().toLowerCase();
    const entries = Object.entries(families).filter(([, fam]) => !query || fam.name.toLowerCase().includes(query));
    if (!entries.length) {
      listEl.innerHTML = `<div class="loading">No families match "${escapeHtml(query)}".</div>`;
      return;
    }
    listEl.innerHTML = '';
    entries.forEach(([famId, fam]) => {
      const memberCount = fam.members ? Object.keys(fam.members).length : 0;
      const div = document.createElement('div');
      div.className = 'family-item';
      div.innerHTML = `
        <div class="f-avatar">${escapeHtml(fam.name.charAt(0).toUpperCase())}</div>
        <div class="f-info">
          <div class="f-name">${escapeHtml(fam.name)}</div>
          <div class="f-members">👥 ${memberCount} member${memberCount !== 1 ? 's' : ''}</div>
        </div>
        <button class="join-btn" onclick="joinFamily('${famId}')">Join</button>
      `;
      listEl.appendChild(div);
    });
  }

  function filterFamilyList() { renderFamilyList(); }

  function showBrowseFamilies() {
    document.getElementById('familyBrowseView').style.display = 'block';
    document.getElementById('familyInsideView').style.display = 'none';
    if (currentFamilyChatListener) { currentFamilyChatListener(); currentFamilyChatListener = null; }
    if (currentFamilyMembersListener) { currentFamilyMembersListener(); currentFamilyMembersListener = null; }
    if (currentFamilySeatsListener) { currentFamilySeatsListener(); currentFamilySeatsListener = null; }
    if (floatingHeartIntervals['familyFloatingHearts']) { clearInterval(floatingHeartIntervals['familyFloatingHearts']); delete floatingHeartIntervals['familyFloatingHearts']; }
  }

  // ---------- CREATE / JOIN / LEAVE FAMILY ----------
  function createFamily() {
    const name = document.getElementById('familyNameInput').value.trim();
    if (!name) return;
    if (containsBadWords(name)) { toast('Please choose an appropriate family name.', 'error'); return; }
    if ((currentUserData.level || 1) < LEVEL_REQUIRED_TO_CREATE) return;

    const newFamRef = db.ref('families').push();
    const famId = newFamRef.key;
    newFamRef.set({
      name: name,
      ownerUid: currentUser.uid,
      createdAt: Date.now(),
      members: { [currentUser.uid]: true }
    }).then(() => {
      db.ref('users/' + currentUser.uid).update({ familyId: famId });
      addActivity(currentUser.uid, 'personal', 'You created the family "' + name + '"');
      document.getElementById('familyNameInput').value = '';
    });
  }

  function joinFamily(famId) {
    db.ref('families/' + famId).once('value').then((snap) => {
      const fam = snap.val();
      if (!fam) return;
      db.ref('families/' + famId + '/members/' + currentUser.uid).set(true).then(() => {
        db.ref('users/' + currentUser.uid).update({ familyId: famId });
        addActivity(currentUser.uid, 'personal', 'You joined the family "' + fam.name + '"');
        if (fam.ownerUid && fam.ownerUid !== currentUser.uid) {
          addActivity(fam.ownerUid, 'social', currentUserData.name + ' joined your family "' + fam.name + '"');
        }
      });
    });
  }

  function leaveFamily() {
    if (!currentFamilyId) return;
    const famIdLeaving = currentFamilyId;

    // Hide immediately — don't wait on the network round-trip
    currentFamilyId = null;
    updateFamilyBubble(getActiveTab());
    showBrowseFamilies();

    clearMyActiveSeat().then(() => {
      db.ref('families/' + famIdLeaving + '/members/' + currentUser.uid).remove().then(() => {
        db.ref('users/' + currentUser.uid).update({ familyId: null });
      });
    }).catch((err) => console.error('leaveFamily error:', err));
  }

  function openFamilyOwnerMenu() {
    const isOwner = currentUser && currentFamilyOwnerUid === currentUser.uid;
    document.getElementById('familyOwnerOnlyItems').style.display = isOwner ? 'block' : 'none';
    document.getElementById('familyOwnerOverlay').classList.add('show');
  }
  function closeFamilyOwnerMenu() { document.getElementById('familyOwnerOverlay').classList.remove('show'); }

  function setFamilyNotice() {
    const current = document.getElementById('familyNoticeBanner').textContent.replace('📢 ', '');
    const text = prompt('Set family notice (leave blank to clear):', current || '');
    if (text === null || !currentFamilyId) return;
    db.ref('families/' + currentFamilyId + '/notice').set(text.trim());
    closeFamilyOwnerMenu();
  }

  function clearFamilyMessages() {
    if (!currentFamilyId) return;
    if (!confirm('Clear all messages in this family chat?')) return;
    db.ref('families/' + currentFamilyId + '/messages').remove();
    closeFamilyOwnerMenu();
  }

  function deleteFamily() {
    if (!currentFamilyId) return;
    if (!confirm('Delete this family permanently? All members will be removed. This cannot be undone.')) return;
    const famIdToDelete = currentFamilyId;
    closeFamilyOwnerMenu();

    currentFamilyId = null;
    updateFamilyBubble(getActiveTab());
    showBrowseFamilies();

    db.ref('families/' + famIdToDelete + '/members').once('value').then((snap) => {
      const members = snap.val() || {};
      Object.keys(members).forEach((uid) => {
        db.ref('users/' + uid).update({ familyId: null });
      });
      db.ref('families/' + famIdToDelete).remove();
    });
  }

  function kickFamilyMember(famId, memberUid, memberName) {
    if (!confirm('Remove ' + memberName + ' from the family?')) return;
    db.ref('families/' + famId + '/members/' + memberUid).remove();
    db.ref('users/' + memberUid).update({ familyId: null });
    addActivity(memberUid, 'social', 'You were removed from the family.');
  }

  const FAMILY_TOTAL_SEATS = 8;
  let currentFamilySeatsListener = null;

  function listenToFamilySeats(famId) {
    if (currentFamilySeatsListener) { currentFamilySeatsListener(); }
    const seatsRef = db.ref('families/' + famId + '/seats');
    const handler = seatsRef.on('value', (snap) => {
      const seats = snap.val() || {};
      const gridEl = document.getElementById('familySeatGrid');
      gridEl.innerHTML = '';
      for (let i = 0; i < FAMILY_TOTAL_SEATS; i++) {
        const seatData = seats[i];
        const cell = document.createElement('div');
        if (seatData) {
          cell.className = 'seat-cell occupied' + (seatData.uid === currentFamilyOwnerUid ? ' host' : '');
          const avatarInner = seatData.photoURL
            ? `style="background-image:url('${seatData.photoURL}');background-size:cover;background-position:center;"`
            : '';
          const crownBadge = seatData.uid === currentFamilyOwnerUid ? '<div class="seat-crown-badge">👑</div>' : '';
          const isMuted = !!seatData.muted;
          const micBadge = `<div class="seat-mic-badge${isMuted ? ' muted' : ''}">${isMuted ? '🔇' : '🎤'}</div>`;
          cell.innerHTML = crownBadge + `<div class="seat-avatar" ${avatarInner}>${seatData.photoURL ? '' : escapeHtml((seatData.name || 'U').charAt(0).toUpperCase())}</div><div class="seat-name">${escapeHtml(seatData.name || 'User')}</div>` + micBadge;
        } else {
          cell.className = 'seat-cell';
          cell.innerHTML = `<div class="seat-plus">+</div><div class="seat-name">${i + 1}</div>`;
        }
        cell.onclick = () => tapFamilySeat(famId, i, !!seatData, seatData);
        gridEl.appendChild(cell);
      }
    });
    currentFamilySeatsListener = () => seatsRef.off('value', handler);
  }

  function tapFamilySeat(famId, index, isOccupied, seatData) {
    if (!currentUser) return;
    const seatsRef = db.ref('families/' + famId + '/seats');
    if (isOccupied) {
      openSeatActionsMenu('family', famId, index, seatData);
      return;
    }
    clearMyActiveSeat().then(() => {
      seatsRef.child(index).set({
        uid: currentUser.uid,
        name: currentUserData.name,
        photoURL: currentUserData.photoURL || null,
        muted: false
      });
      db.ref('users/' + currentUser.uid + '/activeSeat').set({ type: 'family', containerId: famId, seatIndex: index });
      completeFamilyTask(famId, 'sit');
    });
  }

  // ---------- INSIDE FAMILY VIEW ----------
  let currentFamilyChatListener = null;
  let currentFamilyMembersListener = null;

  let currentFamilyOwnerUid = null;
  let currentFamilyNoticeListener = null;

  function showInsideFamily(famId) {
    document.getElementById('familyBrowseView').style.display = 'none';
    document.getElementById('familyInsideView').style.display = 'flex';
    listenToFamilySeats(famId);
    spawnFloatingHearts('familyFloatingHearts');
    completeFamilyTask(famId, 'login');

    const famRef = db.ref('families/' + famId);
    famRef.once('value').then((snap) => {
      const fam = snap.val();
      if (!fam) return;
      document.getElementById('insideFamName').textContent = fam.name;
      currentFamilyOwnerUid = fam.ownerUid;

      const insideEl = document.getElementById('familyInsideView');
      if (fam.wallpaperURL) {
        insideEl.style.backgroundImage = `linear-gradient(rgba(20,10,35,0.75),rgba(20,10,35,0.75)), url('${fam.wallpaperURL}')`;
        insideEl.style.backgroundSize = 'cover';
        insideEl.style.backgroundPosition = 'center';
      } else {
        insideEl.style.backgroundImage = '';
      }

      const famAvatarEl = document.getElementById('insideFamAvatar');
      const bubbleAvatarEl = document.getElementById('familyBubbleAvatar');
      if (fam.photoURL) {
        famAvatarEl.style.backgroundImage = `url('${fam.photoURL}')`;
        famAvatarEl.style.backgroundSize = 'cover';
        famAvatarEl.textContent = '';
        bubbleAvatarEl.style.backgroundImage = `url('${fam.photoURL}')`;
        bubbleAvatarEl.style.backgroundSize = 'cover';
        bubbleAvatarEl.textContent = '';
      } else {
        famAvatarEl.style.backgroundImage = '';
        famAvatarEl.textContent = fam.name.charAt(0).toUpperCase();
        bubbleAvatarEl.style.backgroundImage = '';
        bubbleAvatarEl.textContent = fam.name.charAt(0).toUpperCase();
      }
    });

    if (currentFamilyNoticeListener) { currentFamilyNoticeListener(); }
    const noticeHandler = famRef.child('notice').on('value', (snap) => {
      const notice = snap.val();
      const bannerEl = document.getElementById('familyNoticeBanner');
      if (notice) { bannerEl.textContent = '📢 ' + notice; bannerEl.style.display = 'block'; }
      else { bannerEl.style.display = 'none'; }
    });
    currentFamilyNoticeListener = () => famRef.child('notice').off('value', noticeHandler);

    // Members strip
    const membersHandler = famRef.child('members').on('value', (snap) => {
      const members = snap.val() || {};
      const uids = Object.keys(members);
      document.getElementById('insideFamMemberCount').textContent = "👥 " + uids.length + " member" + (uids.length !== 1 ? 's' : '');
      const stripEl = document.getElementById('membersStrip');
      stripEl.innerHTML = '';
      uids.forEach((uid) => {
        db.ref('users/' + uid).once('value').then((uSnap) => {
          const u = uSnap.val();
          if (!u) return;
          const chip = document.createElement('div');
          chip.className = 'member-chip';
          const canKick = currentUser && currentFamilyOwnerUid === currentUser.uid && uid !== currentUser.uid;
          const memberAvatarStyle = u.photoURL ? `style="background-image:url('${u.photoURL}');background-size:cover;background-position:center;"` : '';
          chip.innerHTML = `<div class="m-avatar" ${memberAvatarStyle}>${u.photoURL ? '' : escapeHtml(u.name.charAt(0).toUpperCase())}</div><div class="m-name">${escapeHtml(u.name)}</div>` +
            (canKick ? `<div class="member-kick-btn" data-kick-uid="${escapeHtml(uid)}">✕</div>` : '');
          stripEl.appendChild(chip);
          if (uid !== currentUser.uid) {
            chip.onclick = (e) => {
              if (e.target.classList.contains('member-kick-btn')) return;
              openSeatProfile(uid, u.name);
            };
          }
          const kickBtn = chip.querySelector('.member-kick-btn');
          if (kickBtn) {
            kickBtn.onclick = (e) => { e.stopPropagation(); kickFamilyMember(famId, kickBtn.dataset.kickUid, u.name); };
          }
        });
      });
    });
    currentFamilyMembersListener = () => famRef.child('members').off('value', membersHandler);

    // Family chat
    const chatArea = document.getElementById('familyChatArea');
    const msgsHandler = famRef.child('messages').limitToLast(50).on('value', (snap) => {
      chatArea.innerHTML = '';
      const messages = snap.val();
      if (!messages) {
        chatArea.innerHTML = '<div class="loading">No messages yet. Say hi to your family! 👋</div>';
        return;
      }
      Object.values(messages).forEach((msg) => {
        if (isUserBlocked(msg.uid)) return;
        const div = document.createElement('div');
        const isMe = msg.uid === currentUser.uid;
        div.className = 'msg ' + (isMe ? 'me' : 'other');
        div.innerHTML = (isMe ? '' : `<div class="sender">${escapeHtml(msg.name)}</div>`) + escapeHtml(msg.text);
        chatArea.appendChild(div);
      });
      chatArea.scrollTop = chatArea.scrollHeight;
    });
    currentFamilyChatListener = () => famRef.child('messages').off('value', msgsHandler);
  }

  function getGroupLevelThreshold(level) {
    return 15000 + (level - 1) * 10000;
  }

  function getGroupLevelInfo(totalXp) {
    let level = 1;
    let remaining = totalXp || 0;
    while (remaining >= getGroupLevelThreshold(level)) {
      remaining -= getGroupLevelThreshold(level);
      level++;
    }
    return { level, currentXp: remaining, neededXp: getGroupLevelThreshold(level) };
  }

  function addGroupActivityXp(path, amount) {
    db.ref(path).transaction((current) => (current || 0) + amount);
  }

  const FAMILY_DAILY_TASKS = [
    { id: 'login', xp: 100, assets: 10, icon: '📅', name: 'Daily Login', desc: 'Open the app today' },
    { id: 'chat', xp: 200, assets: 20, icon: '💬', name: 'Send a Family Message', desc: 'Chat in your Family chat' },
    { id: 'sit', xp: 200, assets: 20, icon: '🪑', name: 'Sit in a Seat', desc: 'Take a seat in Room or Family' },
    { id: 'addfriend', xp: 300, assets: 30, icon: '➕', name: 'Add a Family Friend', desc: 'Add a Family member as friend' },
    { id: 'sendgift', xp: 250, assets: 25, icon: '🎁', name: 'Send a Gift', desc: 'Send a gift to a Family member' },
    { id: 'receivegift', xp: 150, assets: 15, icon: '🎉', name: 'Receive a Gift', desc: 'Receive a gift from a Family member' }
  ];

  function getTodayDateString() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function openFamilyTasks() {
    if (!currentFamilyId || !currentUser) return;
    closeFamilyDetails();
    document.getElementById('familyTasksOverlay').classList.add('show');
    renderFamilyTasksList();
  }

  function closeFamilyTasks() {
    document.getElementById('familyTasksOverlay').classList.remove('show');
  }

  function renderFamilyTasksList() {
    const listEl = document.getElementById('familyTasksList');
    listEl.innerHTML = '<div class="loading">Loading tasks...</div>';
    const today = getTodayDateString();
    db.ref('families/' + currentFamilyId + '/dailyTasks/' + currentUser.uid + '/' + today).once('value').then((snap) => {
      const doneToday = snap.val() || {};
      listEl.innerHTML = '';
      FAMILY_DAILY_TASKS.forEach((task) => {
        const isDone = !!doneToday[task.id];
        const card = document.createElement('div');
        card.className = 'fam-task-card' + (isDone ? ' done' : '');
        card.innerHTML = `
          <div class="ftc-icon">${task.icon}</div>
          <div class="ftc-info">
            <div class="ftc-name">${escapeHtml(task.name)}</div>
            <div class="ftc-desc">${escapeHtml(task.desc)}</div>
            <div class="ftc-reward">+${task.xp} XP · +${task.assets} 💰 Assets</div>
          </div>
          <div class="ftc-status">${isDone ? '✓' : ''}</div>
        `;
        listEl.appendChild(card);
      });
      const footNote = document.createElement('div');
      footNote.style.cssText = 'text-align:center; color:rgba(255,255,255,0.35); font-size:11px; margin-top:8px;';
      footNote.textContent = 'Resets daily · completed automatically as you do these things';
      listEl.appendChild(footNote);
    });
  }

  function completeFamilyTask(famId, taskId, forUid) {
    if (!currentUser || !famId) return;
    const targetUid = forUid || currentUser.uid;
    const task = FAMILY_DAILY_TASKS.find(t => t.id === taskId);
    if (!task) return;
    const today = getTodayDateString();
    const path = 'families/' + famId + '/dailyTasks/' + targetUid + '/' + today + '/' + taskId;
    db.ref(path).once('value').then((snap) => {
      if (snap.val()) return; // already completed today
      db.ref(path).set(true);
      addGroupActivityXp('families/' + famId + '/activityXp', task.xp);
      addGroupActivityXp('families/' + famId + '/assets', task.assets);
      if (targetUid === currentUser.uid) {
        toast('Task complete! +' + task.xp + ' Family XP, +' + task.assets + ' Assets 🎉');
      }
    });
  }

  function sendFamilyMessage() {
    const input = document.getElementById('famMsgInput');
    const text = input.value.trim();
    if (!text || !currentUser || !currentFamilyId) return;
    if (isChatRateLimited()) return;

    db.ref('families/' + currentFamilyId + '/messages').push({
      uid: currentUser.uid,
      name: currentUserData.name,
      text: text,
      timestamp: Date.now()
    });
    addXp(XP_PER_MESSAGE);
    completeFamilyTask(currentFamilyId, 'chat');
    input.value = '';
  }

  const floatingHeartIntervals = {};
  const HEART_EMOJIS = ['💕', '❤️', '💖', '💗'];

  function spawnFloatingHearts(containerId) {
    if (floatingHeartIntervals[containerId]) clearInterval(floatingHeartIntervals[containerId]);
    const container = document.getElementById(containerId);
    if (!container) return;
    floatingHeartIntervals[containerId] = setInterval(() => {
      if (!container.isConnected || container.offsetParent === null) return;
      const heart = document.createElement('div');
      heart.className = 'fh-heart';
      heart.textContent = HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)];
      heart.style.left = (Math.random() * 85 + 5) + '%';
      heart.style.fontSize = (12 + Math.random() * 12) + 'px';
      heart.style.animationDuration = (5 + Math.random() * 3) + 's';
      container.appendChild(heart);
      setTimeout(() => heart.remove(), 8500);
    }, 900);
  }

  const ONBOARDING_STEPS = [
    { emoji: '🎉', title: 'Welcome to Party App!', text: "Let's take a super quick look around before you dive in." },
    { emoji: '🪙', title: 'Coins, Gems & Love', text: '🪙 Coins upgrade your farm. 💎 Gems are saved for future real-money withdrawals. 💕 Love Coins are used to send gifts.' },
    { emoji: '🌾', title: 'Your Farm', text: 'Visit Home to collect coins over time, unlock plots, and level up your Farm — the more you upgrade, the faster you earn.' },
    { emoji: '🎊', title: 'Rooms & Family', text: 'Join a Room to chat, play games, and send gifts live. Join or create a Family to hang out with your favorite people.' }
  ];
  let onboardingStep = 0;

  function renderOnboardingDots() {
    const dotsEl = document.getElementById('onbDots');
    dotsEl.innerHTML = ONBOARDING_STEPS.map((_, i) =>
      `<div style="width:${i === onboardingStep ? 20 : 6}px; height:6px; border-radius:3px; background:${i === onboardingStep ? '#ffd76a' : 'rgba(255,255,255,0.25)'}; transition: width 0.2s;"></div>`
    ).join('');
  }

  function renderOnboardingStep() {
    const step = ONBOARDING_STEPS[onboardingStep];
    document.getElementById('onbEmoji').textContent = step.emoji;
    document.getElementById('onbTitle').textContent = step.title;
    document.getElementById('onbText').textContent = step.text;
    document.getElementById('onbNextBtn').textContent = onboardingStep === ONBOARDING_STEPS.length - 1 ? "Let's go!" : 'Next';
    renderOnboardingDots();
  }

  function onboardingNext() {
    if (onboardingStep < ONBOARDING_STEPS.length - 1) {
      onboardingStep++;
      renderOnboardingStep();
    } else {
      closeOnboarding();
    }
  }

  function closeOnboarding() {
    document.getElementById('onboardingOverlay').classList.remove('show');
    if (currentUser) db.ref('users/' + currentUser.uid + '/onboardingSeen').set(true);
  }

  function maybeShowOnboarding() {
    if (currentUserData && !currentUserData.onboardingSeen) {
      onboardingStep = 0;
      renderOnboardingStep();
      document.getElementById('onboardingOverlay').classList.add('show');
    }
  }

  const BAD_WORDS = [
    'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'pussy', 'whore', 'slut',
    'nigger', 'nigga', 'faggot', 'retard', 'rape', 'chutiya', 'madarchod', 'behenchod', 'bhosdi', 'randi', 'gaandu', 'harami', 'kutta', 'kutti'
  ];

  function containsBadWords(text) {
    const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    return BAD_WORDS.some(w => normalized.includes(w));
  }

  // ---------- ROOM DETAILS PAGE ----------
  let roomDetailSeatsCache = [];

  function openRoomDetails() {
    if (!currentRoomId) return;
    const roomRef = db.ref('liveRooms/' + currentRoomId);
    roomRef.once('value').then((snap) => {
      const room = snap.val();
      if (!room) return;

      const coverEl = document.getElementById('roomDetailCover');
      coverEl.style.backgroundImage = room.wallpaperURL ? `url('${room.wallpaperURL}')` : '';

      const avatarEl = document.getElementById('roomDetailAvatar');
      if (room.photoURL) {
        avatarEl.style.backgroundImage = `url('${room.photoURL}')`;
        avatarEl.textContent = '';
      } else {
        avatarEl.style.backgroundImage = '';
        avatarEl.textContent = room.name.charAt(0).toUpperCase();
      }

      document.getElementById('roomDetailName').textContent = room.name;
      document.getElementById('roomDetailId').textContent = 'ID: ' + (room.roomNumericId || '—');

      const seats = room.seats || {};
      const seatList = Object.values(seats);
      roomDetailSeatsCache = seatList;
      document.getElementById('roomDetailMembers').textContent = seatList.length;
      document.getElementById('roomDetailOnline').textContent = seatList.length;
      document.getElementById('roomDetailCreated').textContent = room.createdAt ? new Date(room.createdAt).toLocaleDateString() : '—';

      const noticeEl = document.getElementById('roomDetailNotice');
      if (room.notice) {
        noticeEl.textContent = '📢 ' + room.notice;
        noticeEl.style.display = 'block';
      } else {
        noticeEl.style.display = 'none';
      }

      if (room.ownerUid) {
        db.ref('users/' + room.ownerUid).once('value').then((ownerSnap) => {
          const owner = ownerSnap.val();
          if (!owner) return;
          const ownerAvatarEl = document.getElementById('roomDetailOwnerAvatar');
          if (owner.photoURL) {
            ownerAvatarEl.style.backgroundImage = `url('${owner.photoURL}')`;
            ownerAvatarEl.textContent = '';
          } else {
            ownerAvatarEl.style.backgroundImage = '';
            ownerAvatarEl.textContent = owner.name.charAt(0).toUpperCase();
          }
          document.getElementById('roomDetailOwnerName').textContent = owner.name;
        });
      }

      document.getElementById('roomMemberSearch').value = '';
      renderRoomDetailMembers();
      document.getElementById('roomDetailsOverlay').classList.add('show');
    });
  }

  function closeRoomDetails() {
    document.getElementById('roomDetailsOverlay').classList.remove('show');
  }

  function renderRoomDetailMembers() {
    const listEl = document.getElementById('roomDetailMemberList');
    const query = (document.getElementById('roomMemberSearch').value || '').trim().toLowerCase();
    const filtered = roomDetailSeatsCache.filter(m => !query || (m.name || '').toLowerCase().includes(query));
    if (!filtered.length) {
      listEl.innerHTML = '<div class="loading">No members found.</div>';
      return;
    }
    listEl.innerHTML = '';
    filtered.forEach((m) => {
      db.ref('users/' + m.uid).once('value').then((snap) => {
        const u = snap.val();
        const card = document.createElement('div');
        card.className = 'detail-member-card';
        const avatarStyle = (u && u.photoURL) ? `style="background-image:url('${u.photoURL}');"` : '';
        const isOwner = currentRoomOwnerUid === m.uid;
        card.innerHTML = `
          <div class="dmc-avatar" ${avatarStyle}>${(u && u.photoURL) ? '' : escapeHtml((m.name || 'U').charAt(0).toUpperCase())}</div>
          <div class="dmc-info">
            <div class="dmc-name-row">
              <div class="dmc-name">${escapeHtml(m.name || 'User')}</div>
              ${isOwner ? '<span class="dmc-owner-tag">OWNER</span>' : ''}
            </div>
            <div class="dmc-badges">
              <span class="dmc-badge">🆔 Lv.${u ? (u.level || 1) : 1}</span>
              <span class="dmc-badge">👑 VIP ${u ? (u.realVipTier || 0) : 0}</span>
            </div>
          </div>
        `;
        card.onclick = () => { closeRoomDetails(); openSeatProfile(m.uid, m.name); };
        listEl.appendChild(card);
      });
    });
  }

  function shareRoomDetails() {
    const name = document.getElementById('roomDetailName').textContent;
    const shareText = 'Join my room "' + name + '" on Party App!';
    if (navigator.share) {
      navigator.share({ title: 'Party App', text: shareText, url: location.href }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText + ' ' + location.href);
      toast('Room link copied to clipboard!');
    }
  }

  function inviteFriendsToRoom() {
    if (!currentUser || !currentUserData) return;
    const friends = currentUserData.friends || {};
    const uids = Object.keys(friends);
    if (!uids.length) { toast('Add some friends first to invite them!', 'error'); return; }
    uids.forEach((uid) => {
      addActivity(uid, 'social', currentUserData.name + ' invited you to join a room!');
    });
    toast('Invite sent to your friends!');
  }

  // ---------- FAMILY DETAILS PAGE ----------
  let familyDetailMembersCache = [];
  let familyRolesCache = {};

  // ---------- FAMILY ROLES & PERMISSIONS ----------
  // Roles: 'captain' (= family owner, only one), 'leader', 'star', 'member' (default)
  const FAMILY_ROLE_LIMITS = { leader: 13, star: 8 };

  function getFamilyRole(uid) {
    if (uid === currentFamilyOwnerUid) return 'captain';
    return familyRolesCache[uid] || 'member';
  }

  function getFamilyRoleLabel(role) {
    if (role === 'captain') return '👑 Captain';
    if (role === 'leader') return '⭐ Leader';
    if (role === 'star') return '🌟 Star';
    return '';
  }

  function canManageFamilyRoles() {
    return !!(currentUser && currentFamilyOwnerUid === currentUser.uid);
  }

  function countFamilyRole(role) {
    return Object.values(familyRolesCache).filter(r => r === role).length;
  }

  function setFamilyMemberRole(famId, uid, newRole) {
    if (!canManageFamilyRoles()) return;
    if (uid === currentFamilyOwnerUid) { toast('The Captain\'s role cannot be changed this way.', 'error'); return; }
    if ((newRole === 'leader' || newRole === 'star') && countFamilyRole(newRole) >= FAMILY_ROLE_LIMITS[newRole] && familyRolesCache[uid] !== newRole) {
      toast('This Family already has the maximum number of ' + newRole + 's.', 'error');
      return;
    }
    const path = 'families/' + famId + '/roles/' + uid;
    const write = newRole === 'member' ? db.ref(path).remove() : db.ref(path).set(newRole);
    write.then(() => {
      familyRolesCache[uid] = newRole === 'member' ? undefined : newRole;
      toast('Role updated!');
      renderFamilyDetailMembers();
    });
  }

  function transferFamilyCaptain(famId, newCaptainUid, newCaptainName) {
    if (!canManageFamilyRoles()) return;
    if (!confirm('Transfer Captain to ' + newCaptainName + '? You will become a normal member.')) return;
    const oldCaptainUid = currentUser.uid;
    db.ref('families/' + famId).update({ ownerUid: newCaptainUid }).then(() => {
      // Clear any leader/star role the new captain had, and clear old captain's leftover role entry
      db.ref('families/' + famId + '/roles/' + newCaptainUid).remove();
      db.ref('families/' + famId + '/roles/' + oldCaptainUid).remove();
      currentFamilyOwnerUid = newCaptainUid;
      toast('Captain transferred to ' + newCaptainName + '.');
      openFamilyDetails();
    });
  }

  let famManageTargetUid = null;
  let famManageTargetName = null;

  function openFamilyMemberManageMenu(uid, name) {
    if (!canManageFamilyRoles()) return;
    famManageTargetUid = uid;
    famManageTargetName = name;
    document.getElementById('famManageName').textContent = name;
    document.getElementById('famManageRole').textContent = getFamilyRoleLabel(getFamilyRole(uid)) || 'Member';
    document.getElementById('famMemberManageOverlay').classList.add('show');
  }

  function closeFamilyMemberManageMenu() {
    document.getElementById('famMemberManageOverlay').classList.remove('show');
  }

  function setFamilyMemberRoleFromMenu(newRole) {
    if (!famManageTargetUid || !currentFamilyId) return;
    setFamilyMemberRole(currentFamilyId, famManageTargetUid, newRole);
    closeFamilyMemberManageMenu();
  }

  function transferFamilyCaptainFromMenu() {
    if (!famManageTargetUid || !currentFamilyId) return;
    closeFamilyMemberManageMenu();
    transferFamilyCaptain(currentFamilyId, famManageTargetUid, famManageTargetName);
  }

  function kickFamilyMemberFromMenu() {
    if (!famManageTargetUid || !currentFamilyId) return;
    closeFamilyMemberManageMenu();
    kickFamilyMember(currentFamilyId, famManageTargetUid, famManageTargetName);
  }

  function openFamilyDetails() {
    if (!currentFamilyId) return;
    const famRef = db.ref('families/' + currentFamilyId);
    famRef.once('value').then((snap) => {
      const fam = snap.val();
      if (!fam) return;

      const coverEl = document.getElementById('familyDetailCover');
      coverEl.style.backgroundImage = fam.wallpaperURL ? `url('${fam.wallpaperURL}')` : '';

      const avatarEl = document.getElementById('familyDetailAvatar');
      if (fam.photoURL) {
        avatarEl.style.backgroundImage = `url('${fam.photoURL}')`;
        avatarEl.textContent = '';
      } else {
        avatarEl.style.backgroundImage = '';
        avatarEl.textContent = fam.name.charAt(0).toUpperCase();
      }

      document.getElementById('familyDetailName').textContent = fam.name;
      document.getElementById('familyDetailAssets').textContent = formatNum(fam.assets || 0);
      computeFamilyRank(currentFamilyId, fam.activityXp || 0);

      if (!fam.familyNumericId) {
        const numericId = Math.floor(1000000 + Math.random() * 8999999);
        famRef.child('familyNumericId').set(numericId);
        document.getElementById('familyDetailId').textContent = 'ID: ' + numericId;
      } else {
        document.getElementById('familyDetailId').textContent = 'ID: ' + fam.familyNumericId;
      }

      const members = fam.members || {};
      const memberUids = Object.keys(members);
      familyDetailMembersCache = memberUids;
      familyRolesCache = fam.roles || {};
      document.getElementById('familyDetailMembers').textContent = memberUids.length;
      document.getElementById('familyDetailCreated').textContent = fam.createdAt ? new Date(fam.createdAt).toLocaleDateString() : '—';

      const levelInfo = getGroupLevelInfo(fam.activityXp || 0);
      document.getElementById('familyDetailLevel').textContent = levelInfo.level;
      document.getElementById('familyDetailXpFill').style.width = Math.min(100, (levelInfo.currentXp / levelInfo.neededXp) * 100) + '%';
      document.getElementById('familyDetailXpText').textContent = formatNum(levelInfo.currentXp) + ' / ' + formatNum(levelInfo.neededXp) + ' XP';

      const noticeEl = document.getElementById('familyDetailNotice');
      if (fam.notice) {
        noticeEl.textContent = '📢 ' + fam.notice;
        noticeEl.style.display = 'block';
      } else {
        noticeEl.style.display = 'none';
      }

      if (fam.ownerUid) {
        db.ref('users/' + fam.ownerUid).once('value').then((ownerSnap) => {
          const owner = ownerSnap.val();
          if (!owner) return;
          const ownerAvatarEl = document.getElementById('familyDetailOwnerAvatar');
          if (owner.photoURL) {
            ownerAvatarEl.style.backgroundImage = `url('${owner.photoURL}')`;
            ownerAvatarEl.textContent = '';
          } else {
            ownerAvatarEl.style.backgroundImage = '';
            ownerAvatarEl.textContent = owner.name.charAt(0).toUpperCase();
          }
          document.getElementById('familyDetailOwnerName').textContent = owner.name;
        });
      }

      document.getElementById('familyMemberSearch').value = '';
      renderFamilyDetailMembers();
      document.getElementById('familyDetailsOverlay').classList.add('show');
    });
  }

  function computeFamilyRank(famId, myActivityXp) {
    const rankEl = document.getElementById('familyDetailRank');
    rankEl.textContent = '…';
    db.ref('families').once('value').then((snap) => {
      const all = snap.val() || {};
      const sorted = Object.entries(all)
        .map(([id, f]) => ({ id, xp: f.activityXp || 0 }))
        .sort((a, b) => b.xp - a.xp);
      const position = sorted.findIndex(f => f.id === famId);
      rankEl.textContent = position >= 0 ? ('#' + (position + 1)) : '—';
    });
  }

  function closeFamilyDetails() {
    document.getElementById('familyDetailsOverlay').classList.remove('show');
  }

  function renderFamilyDetailMembers() {
    const listEl = document.getElementById('familyDetailMemberList');
    const query = (document.getElementById('familyMemberSearch').value || '').trim().toLowerCase();
    if (!familyDetailMembersCache.length) {
      listEl.innerHTML = '<div class="loading">No members found.</div>';
      return;
    }
    listEl.innerHTML = '';
    familyDetailMembersCache.forEach((uid) => {
      db.ref('users/' + uid).once('value').then((snap) => {
        const u = snap.val();
        if (!u) return;
        if (query && !u.name.toLowerCase().includes(query)) return;
        const card = document.createElement('div');
        card.className = 'detail-member-card';
        const avatarStyle = u.photoURL ? `style="background-image:url('${u.photoURL}');"` : '';
        const role = getFamilyRole(uid);
        const roleLabel = getFamilyRoleLabel(role);
        const canManage = canManageFamilyRoles() && uid !== currentUser.uid;
        card.innerHTML = `
          <div class="dmc-avatar" ${avatarStyle}>${u.photoURL ? '' : escapeHtml(u.name.charAt(0).toUpperCase())}</div>
          <div class="dmc-info">
            <div class="dmc-name-row">
              <div class="dmc-name">${escapeHtml(u.name)}</div>
              ${roleLabel ? '<span class="dmc-owner-tag">' + roleLabel + '</span>' : ''}
            </div>
            <div class="dmc-badges">
              <span class="dmc-badge">🆔 Lv.${u.level || 1}</span>
              <span class="dmc-badge">👑 VIP ${u.realVipTier || 0}</span>
            </div>
          </div>
          ${canManage ? '<div class="dmc-actions"><button class="dmc-action-btn" data-manage-uid="' + escapeHtml(uid) + '" data-manage-name="' + escapeHtml(u.name) + '">⋮</button></div>' : ''}
        `;
        card.onclick = (e) => {
          if (e.target.closest('.dmc-action-btn')) return;
          closeFamilyDetails();
          openSeatProfile(uid, u.name);
        };
        const manageBtn = card.querySelector('.dmc-action-btn');
        if (manageBtn) {
          manageBtn.onclick = (e) => { e.stopPropagation(); openFamilyMemberManageMenu(manageBtn.dataset.manageUid, manageBtn.dataset.manageName); };
        }
        listEl.appendChild(card);
      });
    });
  }

  function shareFamilyDetails() {
    const name = document.getElementById('familyDetailName').textContent;
    const shareText = 'Join my family "' + name + '" on Party App!';
    if (navigator.share) {
      navigator.share({ title: 'Party App', text: shareText, url: location.href }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText + ' ' + location.href);
      toast('Family link copied to clipboard!');
    }
  }

  function inviteFriendsToFamily() {
    if (!currentUser || !currentUserData) return;
    const friends = currentUserData.friends || {};
    const uids = Object.keys(friends);
    if (!uids.length) { toast('Add some friends first to invite them!', 'error'); return; }
    uids.forEach((uid) => {
      addActivity(uid, 'social', currentUserData.name + ' invited you to join their family!');
    });
    toast('Invite sent to your friends!');
  }

  const EMOJI_LIST = [
    '😀','😁','😂','🤣','😊','😍','😘','😜','🤗','🤔','😎','😢','😭','😡','🥳','😴',
    '👍','👎','👏','🙌','🙏','💪','🤝','✌️','👋','🤙','🔥','✨','💯','🎉','🎊','⭐',
    '❤️','💕','💔','💖','💗','😻','🎁','🌹','🍰','☕','🍕','🍔','⚽','🏆','🎮','🎵'
  ];
  let emojiTargetInputId = null;

  function renderEmojiPickerGrid() {
    const gridEl = document.getElementById('emojiPickerGrid');
    if (gridEl.children.length) return;
    EMOJI_LIST.forEach((emoji) => {
      const span = document.createElement('span');
      span.textContent = emoji;
      span.onclick = () => insertEmoji(emoji);
      gridEl.appendChild(span);
    });
  }

  function openEmojiPicker(targetInputId) {
    emojiTargetInputId = targetInputId;
    renderEmojiPickerGrid();
    document.getElementById('emojiPicker').classList.add('show');
  }

  function closeEmojiPicker() {
    document.getElementById('emojiPicker').classList.remove('show');
  }

  function insertEmoji(emoji) {
    if (!emojiTargetInputId) return;
    const input = document.getElementById(emojiTargetInputId);
    if (input) {
      input.value += emoji;
      input.focus();
    }
  }

  // ---------- ADMIN PANEL (Phase 1: Auth + Dashboard + User Management) ----------
  let isAdminUser = false;
  let adminAllUsersCache = null;
  let adminSelectedUid = null;

  function checkAdminStatus() {
    if (!currentUser) return;
    db.ref('adminRoles/' + currentUser.uid).once('value').then((snap) => {
      isAdminUser = snap.val() === true;
      const menuItem = document.getElementById('adminPanelMenuItem');
      if (menuItem) menuItem.style.display = isAdminUser ? 'block' : 'none';
    }).catch(() => { isAdminUser = false; });
  }

  function openAdminPanel() {
    if (!isAdminUser) { toast('Admin access only.', 'error'); return; }
    document.getElementById('adminPanelOverlay').classList.add('show');
    switchAdminTab('dashboard');
  }

  function closeAdminPanel() {
    document.getElementById('adminPanelOverlay').classList.remove('show');
  }

  function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('adminDashboardTab').style.display = tab === 'dashboard' ? 'block' : 'none';
    document.getElementById('adminUsersTab').style.display = tab === 'users' ? 'block' : 'none';
    if (tab === 'dashboard') loadAdminDashboard();
    if (tab === 'users') loadAdminUsers();
  }

  function loadAdminDashboard() {
    const gridEl = document.getElementById('adminStatsGrid');
    gridEl.innerHTML = '<div class="loading">Loading stats...</div>';

    Promise.all([
      db.ref('users').once('value'),
      db.ref('liveRooms').once('value'),
      db.ref('families').once('value')
    ]).then(([usersSnap, roomsSnap, famsSnap]) => {
      const users = usersSnap.val() || {};
      const rooms = roomsSnap.val() || {};
      const families = famsSnap.val() || {};
      const userList = Object.values(users);

      const totalUsers = userList.length;
      const vipUsers = userList.filter(u => (u.realVipTier || 0) > 0).length;

      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const newToday = userList.filter(u => u.createdAt && (now - u.createdAt) < oneDayMs).length;
      const newWeek = userList.filter(u => u.createdAt && (now - u.createdAt) < oneDayMs * 7).length;
      const newMonth = userList.filter(u => u.createdAt && (now - u.createdAt) < oneDayMs * 30).length;

      let activeRooms = 0;
      Object.values(rooms).forEach(r => { if (r.seats && Object.keys(r.seats).length > 0) activeRooms++; });

      const stats = [
        { label: 'Total Users', value: totalUsers },
        { label: 'VIP Users', value: vipUsers },
        { label: 'Total Rooms', value: Object.keys(rooms).length },
        { label: 'Active Rooms', value: activeRooms },
        { label: 'Total Families', value: Object.keys(families).length },
        { label: 'New Today', value: newToday },
        { label: 'New This Week', value: newWeek },
        { label: 'New This Month', value: newMonth }
      ];

      gridEl.innerHTML = '';
      stats.forEach((s) => {
        const card = document.createElement('div');
        card.className = 'admin-stat-card';
        card.innerHTML = `<div class="asc-value">${formatNum(s.value)}</div><div class="asc-label">${s.label}</div>`;
        gridEl.appendChild(card);
      });
    });
  }

  function loadAdminUsers() {
    document.getElementById('adminUserSearch').value = '';
    db.ref('users').once('value').then((snap) => {
      const users = snap.val() || {};
      adminAllUsersCache = Object.entries(users).map(([uid, u]) => ({ uid, ...u }));
      renderAdminUserList();
    });
  }

  function renderAdminUserList() {
    const listEl = document.getElementById('adminUserList');
    if (!adminAllUsersCache) { listEl.innerHTML = '<div class="loading">Loading...</div>'; return; }
    const query = (document.getElementById('adminUserSearch').value || '').trim().toLowerCase();
    const filtered = adminAllUsersCache.filter(u => !query || (u.name || '').toLowerCase().includes(query)).slice(0, 100);
    if (!filtered.length) { listEl.innerHTML = '<div class="loading">No users found.</div>'; return; }
    listEl.innerHTML = '';
    filtered.forEach((u) => {
      const row = document.createElement('div');
      row.className = 'admin-user-row';
      const avatarStyle = u.photoURL ? `style="background-image:url('${u.photoURL}');background-size:cover;background-position:center;"` : '';
      row.innerHTML = `
        <div class="dmc-avatar" ${avatarStyle}>${u.photoURL ? '' : escapeHtml((u.name || 'U').charAt(0).toUpperCase())}</div>
        <div class="dmc-info">
          <div class="dmc-name">${escapeHtml(u.name || 'User')} ${u.banned ? '<span style="color:#ff8a8a;font-size:10px;">(BANNED)</span>' : ''}</div>
          <div class="dmc-badges"><span class="dmc-badge">🆔 Lv.${u.level || 1}</span><span class="dmc-badge">💎 ${formatNum(u.gems || 0)}</span></div>
        </div>
      `;
      row.onclick = () => openAdminUserDetail(u.uid);
      listEl.appendChild(row);
    });
  }

  function openAdminUserDetail(uid) {
    adminSelectedUid = uid;
    db.ref('users/' + uid).once('value').then((snap) => {
      const u = snap.val();
      if (!u) return;
      document.getElementById('adminUserDetailName').textContent = u.name || 'User';
      document.getElementById('adminUdIdLevel').textContent = u.level || 1;
      document.getElementById('adminUdVip').textContent = u.realVipTier || 0;
      document.getElementById('adminUdFarmLevel').textContent = u.level || 1;
      document.getElementById('adminUdRoomLevel').textContent = getGroupLevelInfo(u.roomXP || 0).level;
      document.getElementById('adminUdStatus').textContent = u.banned ? '🚫 Banned' : '✅ Active';
      document.getElementById('adminUdCoins').textContent = formatNum(u.coins || 0);
      document.getElementById('adminUdGems').textContent = formatNum(u.gems || 0);
      document.getElementById('adminUdLove').textContent = formatNum(u.love || 0);
      document.getElementById('adminAdjustCoinsInput').value = '';
      document.getElementById('adminAdjustGemsInput').value = '';
      document.getElementById('adminAdjustLoveInput').value = '';
      document.getElementById('adminBanToggleBtn').textContent = u.banned ? '✅ Unban User' : '🚫 Ban User';
      document.getElementById('adminUserDetailOverlay').classList.add('show');
    });
  }

  function closeAdminUserDetail() {
    document.getElementById('adminUserDetailOverlay').classList.remove('show');
  }

  function writeAdminAuditLog(action, targetUid, oldValue, newValue) {
    db.ref('auditLog').push({
      adminId: currentUser.uid,
      adminName: currentUserData.name,
      action: action,
      targetUid: targetUid,
      oldValue: oldValue,
      newValue: newValue,
      timestamp: Date.now()
    });
  }

  function adminAdjustCurrency(field) {
    if (!isAdminUser || !adminSelectedUid) return;
    const inputEl = document.getElementById('adminAdjust' + field.charAt(0).toUpperCase() + field.slice(1) + 'Input');
    const newValue = parseInt(inputEl.value, 10);
    if (isNaN(newValue) || newValue < 0) { alert('Enter a valid non-negative number.'); return; }

    db.ref('users/' + adminSelectedUid + '/' + field).once('value').then((snap) => {
      const oldValue = snap.val() || 0;
      db.ref('users/' + adminSelectedUid).update({ [field]: newValue }).then(() => {
        writeAdminAuditLog('Adjusted ' + field, adminSelectedUid, oldValue, newValue);
        toast(field + ' updated to ' + formatNum(newValue));
        openAdminUserDetail(adminSelectedUid);
      });
    });
  }

  function adminToggleBan() {
    if (!isAdminUser || !adminSelectedUid) return;
    db.ref('users/' + adminSelectedUid + '/banned').once('value').then((snap) => {
      const wasBanned = snap.val() === true;
      db.ref('users/' + adminSelectedUid).update({ banned: !wasBanned }).then(() => {
        writeAdminAuditLog(wasBanned ? 'Unbanned user' : 'Banned user', adminSelectedUid, wasBanned, !wasBanned);
        toast(wasBanned ? 'User unbanned.' : 'User banned.');
        openAdminUserDetail(adminSelectedUid);
      });
    });
  }

  function toast(message, type) {
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.textContent = message;
    document.getElementById('toastContainer').appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- IMAGE URL SETTING (no paid Storage needed) ----------
  let imageUrlModalTarget = null;

  function promptImageUrl(dbPath, label, onDone) {
    document.querySelectorAll('.ttt-overlay.show').forEach((el) => el.classList.remove('show'));
    imageUrlModalTarget = { dbPath, onDone };
    document.getElementById('imageUrlModalTitle').textContent = 'Set ' + label;
    document.getElementById('imageUrlModalInput').value = '';
    document.getElementById('imageUrlOverlay').classList.add('show');
    setTimeout(() => document.getElementById('imageUrlModalInput').focus(), 200);
  }

  function closeImageUrlModal() {
    document.getElementById('imageUrlOverlay').classList.remove('show');
    imageUrlModalTarget = null;
  }

  function pasteFromClipboard() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      alert('Clipboard button not supported in this browser — please long-press the box and choose Paste instead.');
      return;
    }
    navigator.clipboard.readText().then((text) => {
      if (text && text.trim()) {
        document.getElementById('imageUrlModalInput').value = text.trim();
      } else {
        alert('Your clipboard is empty. Copy the image link first, then try again.');
      }
    }).catch((err) => {
      alert('Could not read clipboard automatically. Please long-press the box and choose Paste instead.');
    });
  }

  function confirmImageUrlModal() {
    if (!imageUrlModalTarget) return;
    const trimmed = document.getElementById('imageUrlModalInput').value.trim();
    if (!trimmed) { alert('No link entered.'); return; }
    if (!/^https?:\/\//i.test(trimmed)) { alert('Please paste a valid link starting with http:// or https://'); return; }

    const saveBtn = document.querySelector('#imageUrlOverlay .btn');
    if (saveBtn) { saveBtn.textContent = 'Checking link...'; saveBtn.disabled = true; }

    const testImg = new Image();
    testImg.onload = () => {
      if (saveBtn) { saveBtn.textContent = 'Save'; saveBtn.disabled = false; }
      const { dbPath, onDone } = imageUrlModalTarget;
      db.ref(dbPath).set(trimmed).then(() => {
        closeImageUrlModal();
        if (onDone) onDone(trimmed);
      }).catch((err) => alert('Could not save: ' + err.message));
    };
    testImg.onerror = () => {
      if (saveBtn) { saveBtn.textContent = 'Save'; saveBtn.disabled = false; }
      alert("This link doesn't point directly to an image, so it won't display.\n\nGoogle Photos share links usually DON'T work — they open a webpage, not the raw image.\n\nTry imgur.com instead: upload your photo there (no account needed), then copy the direct image link it gives you (it should end in .jpg or .png).");
    };
    testImg.src = trimmed;
  }

  function uploadMyProfilePhoto() {
    if (!currentUser) return;
    promptImageUrl('users/' + currentUser.uid + '/photoURL', 'your profile picture', (url) => {
      document.getElementById('editAvatarBig').style.backgroundImage = `url('${url}')`;
      document.getElementById('editAvatarBig').style.backgroundSize = 'cover';
      document.getElementById('editAvatarBig').style.backgroundPosition = 'center';
      document.getElementById('editAvatarBig').textContent = '';
      toast('Profile photo updated!');
    });
  }

  function uploadRoomPhoto() {
    if (!currentRoomId) return;
    promptImageUrl('liveRooms/' + currentRoomId + '/photoURL', 'the room photo', () => {
      toast('Room photo updated!');
      closeRoomOwnerMenu();
    });
  }

  function uploadRoomWallpaper() {
    if (!currentRoomId) return;
    promptImageUrl('liveRooms/' + currentRoomId + '/wallpaperURL', 'the room wallpaper', (url) => {
      document.getElementById('roomInsideView').style.backgroundImage = `linear-gradient(rgba(20,10,35,0.75),rgba(20,10,35,0.75)), url('${url}')`;
      document.getElementById('roomInsideView').style.backgroundSize = 'cover';
      document.getElementById('roomInsideView').style.backgroundPosition = 'center';
      toast('Room wallpaper updated!');
      closeRoomOwnerMenu();
    });
  }

  function uploadFamilyPhoto() {
    if (!currentFamilyId) return;
    promptImageUrl('families/' + currentFamilyId + '/photoURL', 'the family photo', () => {
      toast('Family photo updated!');
      closeFamilyOwnerMenu();
    });
  }

  function uploadFamilyWallpaper() {
    if (!currentFamilyId) return;
    promptImageUrl('families/' + currentFamilyId + '/wallpaperURL', 'the family wallpaper', (url) => {
      document.getElementById('familyInsideView').style.backgroundImage = `linear-gradient(rgba(20,10,35,0.75),rgba(20,10,35,0.75)), url('${url}')`;
      document.getElementById('familyInsideView').style.backgroundSize = 'cover';
      document.getElementById('familyInsideView').style.backgroundPosition = 'center';
      toast('Family wallpaper updated!');
      closeFamilyOwnerMenu();
    });
  }

  // ---------- ROOM: EXPLORE / BROWSE ----------
  const TOTAL_SEATS = 8;
  let currentRoomId = null;
  let roomListListenerAttached = false;
  let currentSeatsListener = null;
  let currentRoomChatListener = null;

  let roomListCache = null;

  function listenToRoomList() {
    if (roomListListenerAttached) return;
    roomListListenerAttached = true;
    db.ref('liveRooms').on('value', (snap) => {
      roomListCache = snap.val();
      renderRoomList();
      renderPopularRooms();
    });
  }

  function renderPopularRooms() {
    const rowEl = document.getElementById('popularRoomsRow');
    if (!rowEl) return;
    const rooms = roomListCache;
    if (!rooms || !Object.keys(rooms).length) {
      rowEl.innerHTML = '<div class="loading" style="padding:10px 0; color:rgba(255,255,255,0.4); font-size:12.5px;">No rooms live right now.</div>';
      return;
    }
    const entries = Object.entries(rooms)
      .map(([id, room]) => ({ id, room, count: room.seats ? Object.keys(room.seats).length : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    rowEl.innerHTML = '';
    entries.forEach(({ id, room, count }) => {
      const card = document.createElement('div');
      card.className = 'pop-room-card';
      const thumbStyle = room.photoURL ? `style="background-image:url('${room.photoURL}');"` : '';
      card.innerHTML = `
        <div class="prc-thumb" ${thumbStyle}>${room.photoURL ? '' : '🏠'}</div>
        <div class="prc-body">
          <div class="prc-name">${escapeHtml(room.name)}</div>
          <div class="prc-count">🟢 ${count} online</div>
          <button class="prc-join-btn">Join</button>
        </div>
      `;
      card.onclick = () => { switchTab('room'); enterRoom(id, room.name); };
      rowEl.appendChild(card);
    });
  }

  function renderRoomList() {
    const listEl = document.getElementById('roomExploreList');
    const rooms = roomListCache;
    if (!rooms) {
      listEl.innerHTML = '<div class="loading">No rooms yet. Be the first to create one!</div>';
      return;
    }
    const query = (document.getElementById('roomSearchInput').value || '').trim().toLowerCase();
    const entries = Object.entries(rooms).filter(([, room]) => !query || room.name.toLowerCase().includes(query));
    if (!entries.length) {
      listEl.innerHTML = `<div class="loading">No rooms match "${escapeHtml(query)}".</div>`;
      return;
    }
    listEl.innerHTML = '';
    entries.forEach(([roomId, room]) => {
      const memberCount = room.seats ? Object.keys(room.seats).length : 0;
      const card = document.createElement('div');
      card.className = 'room-card';
      card.innerHTML = `
        <div class="rc-thumb">🏠</div>
        <div class="rc-info">
          <div class="rc-name">${escapeHtml(room.name)}</div>
          <div class="rc-sub">👥 ${memberCount} in room</div>
        </div>
        <div class="rc-heat">🔥 ${memberCount}</div>
      `;
      card.onclick = () => enterRoom(roomId, room.name);
      listEl.appendChild(card);
    });
  }

  function filterRoomList() { renderRoomList(); }

  function createLiveRoom() {
    const input = document.getElementById('roomNameInput');
    const name = input.value.trim();
    if (!name || !currentUser) return;
    if (containsBadWords(name)) { toast('Please choose an appropriate room name.', 'error'); return; }

    const newRoomRef = db.ref('liveRooms').push();
    newRoomRef.set({
      name: name,
      ownerUid: currentUser.uid,
      createdAt: Date.now(),
      roomNumericId: Math.floor(1000000 + Math.random() * 8999999)
    }).then(() => {
      input.value = '';
      enterRoom(newRoomRef.key, name);
    });
  }

  let currentRoomOwnerUid = null;
  let currentRoomNoticeListener = null;

  function enterRoom(roomId, roomName) {
    currentRoomId = roomId;
    localStorage.setItem('lastRoomId', roomId);
    localStorage.setItem('lastRoomName', roomName);
    document.getElementById('roomInsideTitle').textContent = roomName;
    document.getElementById('roomBrowseView').style.display = 'none';
    document.getElementById('roomInsideView').style.display = 'flex';
    setGlobalTopbarVisible(false);
    listenToRoomSeats();
    listenToRoomChat();

    const roomRef = db.ref('liveRooms/' + roomId);
    roomRef.once('value').then((snap) => {
      const room = snap.val();
      currentRoomOwnerUid = room ? room.ownerUid : null;
      const roomLevelEl = document.getElementById('roomLevelDisplay');
      if (roomLevelEl) roomLevelEl.textContent = '🎖️ Lv.' + getGroupLevelInfo((room && room.activityXp) || 0).level;
      const insideEl = document.getElementById('roomInsideView');
      if (room && room.wallpaperURL) {
        insideEl.style.backgroundImage = `linear-gradient(rgba(20,10,35,0.75),rgba(20,10,35,0.75)), url('${room.wallpaperURL}')`;
        insideEl.style.backgroundSize = 'cover';
        insideEl.style.backgroundPosition = 'center';
      } else {
        insideEl.style.backgroundImage = '';
      }

      const avatarEl = document.getElementById('roomHeaderOwnerAvatar');
      if (room && room.photoURL) {
        avatarEl.style.backgroundImage = `url('${room.photoURL}')`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
        avatarEl.textContent = '';
      } else {
        avatarEl.style.backgroundImage = '';
        avatarEl.textContent = roomName.charAt(0).toUpperCase();
      }

      if (room && room.roomNumericId) {
        document.getElementById('roomIdDisplay').textContent = 'ID: ' + room.roomNumericId;
      } else if (room) {
        const numericId = Math.floor(1000000 + Math.random() * 8999999);
        roomRef.child('roomNumericId').set(numericId);
        document.getElementById('roomIdDisplay').textContent = 'ID: ' + numericId;
      }
    });

    spawnFloatingHearts('roomFloatingHearts');

    const noticeHandler = roomRef.child('notice').on('value', (snap) => {
      const notice = snap.val();
      const bannerEl = document.getElementById('roomNoticeBanner');
      if (notice) { bannerEl.textContent = '📢 ' + notice; bannerEl.style.display = 'block'; }
      else { bannerEl.style.display = 'none'; }
    });
    currentRoomNoticeListener = () => roomRef.child('notice').off('value', noticeHandler);
  }

  function leaveRoomToBrowse() {
    if (currentSeatsListener) { currentSeatsListener(); currentSeatsListener = null; }
    if (currentRoomChatListener) { currentRoomChatListener(); currentRoomChatListener = null; }
    if (currentRoomNoticeListener) { currentRoomNoticeListener(); currentRoomNoticeListener = null; }
    if (floatingHeartIntervals['roomFloatingHearts']) { clearInterval(floatingHeartIntervals['roomFloatingHearts']); delete floatingHeartIntervals['roomFloatingHearts']; }
    currentRoomId = null;
    currentRoomOwnerUid = null;
    localStorage.removeItem('lastRoomId');
    localStorage.removeItem('lastRoomName');
    document.getElementById('roomInsideView').style.display = 'none';
    document.getElementById('roomBrowseView').style.display = 'flex';
    setGlobalTopbarVisible(true);
  }

  function openRoomOwnerMenu() {
    const isOwner = currentUser && currentRoomOwnerUid === currentUser.uid;
    document.getElementById('roomOwnerOnlyItems').style.display = isOwner ? 'block' : 'none';
    document.getElementById('roomMemberNotice').style.display = isOwner ? 'none' : 'block';
    document.getElementById('roomOwnerOverlay').classList.add('show');
  }
  function closeRoomOwnerMenu() { document.getElementById('roomOwnerOverlay').classList.remove('show'); }

  function setRoomNotice() {
    const current = document.getElementById('roomNoticeBanner').textContent.replace('📢 ', '');
    const text = prompt('Set room notice (leave blank to clear):', current || '');
    if (text === null || !currentRoomId) return;
    db.ref('liveRooms/' + currentRoomId + '/notice').set(text.trim());
    closeRoomOwnerMenu();
  }

  function clearRoomMessages() {
    if (!currentRoomId) return;
    if (!confirm('Clear all messages in this room?')) return;
    db.ref('liveRooms/' + currentRoomId + '/messages').remove();
    closeRoomOwnerMenu();
  }

  function deleteRoom() {
    if (!currentRoomId) return;
    if (!confirm('Delete this room permanently? This cannot be undone.')) return;
    const roomIdToDelete = currentRoomId;
    closeRoomOwnerMenu();
    leaveRoomToBrowse();
    db.ref('liveRooms/' + roomIdToDelete).remove();
  }

  // ---------- SEAT PROFILE POPUP ----------
  let seatProfileUid = null;
  let seatProfileName = null;

  function openSeatProfile(uid, name) {
    seatProfileUid = uid;
    seatProfileName = name;
    applyAvatarPhoto(document.getElementById('seatProfAvatar'), { name });
    document.getElementById('seatProfName').textContent = name;
    document.getElementById('seatProfIdBadge').textContent = '🆔 ID Lv. 1';
    document.getElementById('seatProfVipBadge').textContent = '👑 VIP 0';
    document.getElementById('seatProfRoomBadge').textContent = '🎁 Room Lv. 1';
    document.getElementById('seatProfFamilyValue').textContent = 'None';
    document.getElementById('seatProfIdNumber').textContent = '—';

    db.ref('users/' + uid).once('value').then((snap) => {
      const u = snap.val();
      if (!u) return;
      applyAvatarPhoto(document.getElementById('seatProfAvatar'), u);
      document.getElementById('seatProfIdBadge').textContent = '🆔 ID Lv. ' + (u.level || 1);
      document.getElementById('seatProfVipBadge').textContent = '👑 VIP ' + (u.realVipTier || 0);
      document.getElementById('seatProfRoomBadge').textContent = '🎁 Room Lv. ' + getGroupLevelInfo(u.roomXP || 0).level;
      document.getElementById('seatProfIdNumber').textContent = u.profileId || '—';
      if (u.familyId) {
        db.ref('families/' + u.familyId).once('value').then((famSnap) => {
          const fam = famSnap.val();
          document.getElementById('seatProfFamilyValue').textContent = fam ? fam.name : 'None';
        });
      }
    });

    document.getElementById('seatProfileOverlay').classList.add('show');
  }

  function closeSeatProfile() {
    document.getElementById('seatProfileOverlay').classList.remove('show');
  }

  function giftFromSeatProfile() {
    if (!seatProfileUid) return;
    if (!currentRoomId && !currentFamilyId) {
      alert("Gifting works inside a Room or Family. Join one to send " + seatProfileName + " a gift!");
      return;
    }
    closeSeatProfile();
    openGiftPicker(seatProfileUid, seatProfileName);
  }

  function chatFromSeatProfile() {
    if (!seatProfileName) return;
    closeSeatProfile();
    if (currentFamilyId && document.getElementById('familyInsideView').style.display !== 'none') {
      const input = document.getElementById('famMsgInput');
      input.value = '@' + seatProfileName + ' ';
      input.focus();
    } else {
      const input = document.getElementById('roomMsgInput');
      input.value = '@' + seatProfileName + ' ';
      input.focus();
    }
  }

  function addFriendFromSeatProfile() {
    if (!currentUser || !seatProfileUid) return;
    if (seatProfileUid === currentUser.uid) { alert("You can't add yourself as a friend."); return; }

    db.ref('users/' + currentUser.uid + '/friends/' + seatProfileUid).once('value').then((snap) => {
      if (snap.val()) { alert(seatProfileName + ' is already your friend.'); return; }

      db.ref('users/' + currentUser.uid + '/friends/' + seatProfileUid).set(true);
      db.ref('users/' + seatProfileUid + '/friends/' + currentUser.uid).set(true);
      addActivity(seatProfileUid, 'social', currentUserData.name + ' added you as a friend!');
      toast(seatProfileName + ' added as a friend!');
      if (currentFamilyId) {
        db.ref('families/' + currentFamilyId + '/members/' + seatProfileUid).once('value').then((memSnap) => {
          if (memSnap.val()) completeFamilyTask(currentFamilyId, 'addfriend');
        });
      }
    });
  }

  function reportSeatProfileUser() {
    if (!currentUser || !seatProfileUid) return;
    if (seatProfileUid === currentUser.uid) { alert("You can't report yourself."); return; }

    const reason = prompt('Why are you reporting ' + seatProfileName + '? (e.g. harassment, spam, inappropriate content)');
    if (reason === null || !reason.trim()) return;

    db.ref('reports').push({
      reportedUid: seatProfileUid,
      reportedName: seatProfileName,
      reporterUid: currentUser.uid,
      reporterName: currentUserData.name,
      reason: reason.trim(),
      timestamp: Date.now()
    });
    toast('Report submitted for review. Thank you.');
  }

  function blockSeatProfileUser() {
    if (!currentUser || !seatProfileUid) return;
    if (seatProfileUid === currentUser.uid) { alert("You can't block yourself."); return; }

    if (!confirm('Block ' + seatProfileName + '? You will no longer see their messages or posts.')) return;
    db.ref('users/' + currentUser.uid + '/blocked/' + seatProfileUid).set(true);
    toast(seatProfileName + ' has been blocked.');
    closeSeatProfile();
  }

  function isUserBlocked(uid) {
    return !!(currentUserData && currentUserData.blocked && currentUserData.blocked[uid]);
  }


  // ---------- ROOM: SEATS ----------
  function listenToRoomSeats() {
    if (!currentRoomId) return;
    const seatsRef = db.ref('liveRooms/' + currentRoomId + '/seats');
    const handler = seatsRef.on('value', (snap) => {
      const seats = snap.val() || {};
      const onlineCountEl = document.getElementById('roomOnlineCount');
      if (onlineCountEl) onlineCountEl.textContent = Object.keys(seats).length + ' online';
      const gridEl = document.getElementById('seatGrid');
      gridEl.innerHTML = '';
      for (let i = 0; i < TOTAL_SEATS; i++) {
        const seatData = seats[i];
        const cell = document.createElement('div');
        if (seatData) {
          cell.className = 'seat-cell occupied' + (seatData.uid === currentRoomOwnerUid ? ' host' : '');
          const avatarInner = seatData.photoURL
            ? `style="background-image:url('${seatData.photoURL}');background-size:cover;background-position:center;"`
            : '';
          const crownBadge = seatData.uid === currentRoomOwnerUid ? '<div class="seat-crown-badge">👑</div>' : '';
          const isMuted = !!seatData.muted;
          const micBadge = `<div class="seat-mic-badge${isMuted ? ' muted' : ''}" data-seat-index="${i}">${isMuted ? '🔇' : '🎤'}</div>`;
          cell.innerHTML = crownBadge + `<div class="seat-avatar" ${avatarInner}>${seatData.photoURL ? '' : escapeHtml((seatData.name || 'U').charAt(0).toUpperCase())}</div><div class="seat-name">${escapeHtml(seatData.name || 'User')}</div>` +
            micBadge +
            `<div class="seat-gift-btn" data-gift-uid="${escapeHtml(seatData.uid)}" data-gift-name="${escapeHtml(seatData.name || 'User')}">🎁</div>`;
        } else {
          cell.className = 'seat-cell';
          cell.innerHTML = `<div class="seat-plus">+</div><div class="seat-name">${i + 1}</div>`;
        }
        cell.onclick = () => tapSeat(i, !!seatData, seatData);
        gridEl.appendChild(cell);
        const giftBtn = cell.querySelector('.seat-gift-btn');
        if (giftBtn) {
          giftBtn.onclick = (e) => {
            e.stopPropagation();
            openGiftPicker(giftBtn.dataset.giftUid, giftBtn.dataset.giftName);
          };
        }
        const micBtn = cell.querySelector('.seat-mic-badge');
        if (micBtn && seatData && seatData.uid === currentUser.uid) {
          micBtn.onclick = (e) => {
            e.stopPropagation();
            toggleSeatMic(i, !!seatData.muted);
          };
        }
      }
    });
    currentSeatsListener = () => seatsRef.off('value', handler);
  }

  function clearMyActiveSeat() {
    if (!currentUser) return Promise.resolve();
    return db.ref('users/' + currentUser.uid + '/activeSeat').once('value').then((snap) => {
      const seat = snap.val();
      if (!seat) return Promise.resolve();
      const path = (seat.type === 'room' ? 'liveRooms/' : 'families/') + seat.containerId + '/seats/' + seat.seatIndex;
      return db.ref(path).once('value').then((seatSnap) => {
        const seatData = seatSnap.val();
        if (seatData && seatData.uid === currentUser.uid) {
          return db.ref(path).remove();
        }
      }).then(() => db.ref('users/' + currentUser.uid + '/activeSeat').remove());
    });
  }

  function tapSeat(index, isOccupied, seatData) {
    if (!currentUser || !currentRoomId) return;
    const seatsRef = db.ref('liveRooms/' + currentRoomId + '/seats');
    if (isOccupied) {
      openSeatActionsMenu('room', currentRoomId, index, seatData);
      return;
    }
    clearMyActiveSeat().then(() => seatsRef.once('value')).then((snap) => {
      const seats = snap.val() || {};
      Object.keys(seats).forEach((key) => {
        if (seats[key].uid === currentUser.uid) {
          seatsRef.child(key).remove();
        }
      });
      seatsRef.child(index).set({
        uid: currentUser.uid,
        name: currentUserData.name,
        photoURL: currentUserData.photoURL || null,
        muted: false
      });
      db.ref('users/' + currentUser.uid + '/activeSeat').set({ type: 'room', containerId: currentRoomId, seatIndex: index });
    });
  }

  function toggleSeatMic(index, currentMuted) {
    if (!currentRoomId) return;
    db.ref('liveRooms/' + currentRoomId + '/seats/' + index + '/muted').set(!currentMuted);
  }

  // ---------- SEAT ACTIONS MENU (shared by Room + Family) ----------
  let seatActionsContext = null; // { type, containerId, seatIndex, seatData }

  function openSeatActionsMenu(type, containerId, seatIndex, seatData) {
    if (!currentUser || !seatData) return;
    seatActionsContext = { type, containerId, seatIndex, seatData };
    // reuse existing profile popup's Gift/Chat/Report/Block logic
    seatProfileUid = seatData.uid;
    seatProfileName = seatData.name;

    const avatarEl = document.getElementById('seatActionsAvatar');
    if (seatData.photoURL) {
      avatarEl.style.backgroundImage = `url('${seatData.photoURL}')`;
      avatarEl.textContent = '';
    } else {
      avatarEl.style.backgroundImage = '';
      avatarEl.textContent = (seatData.name || 'U').charAt(0).toUpperCase();
    }
    document.getElementById('seatActionsName').textContent = seatData.name || 'User';
    document.getElementById('seatActionsSub').textContent = 'Loading...';
    db.ref('users/' + seatData.uid).once('value').then((snap) => {
      const u = snap.val();
      document.getElementById('seatActionsSub').textContent = u ? ('🆔 ID Lv. ' + (u.level || 1) + '  ·  👑 VIP ' + (u.realVipTier || 0)) : '';
    });

    const isMe = seatData.uid === currentUser.uid;
    const ownerUid = type === 'room' ? currentRoomOwnerUid : currentFamilyOwnerUid;
    const isOwnerViewing = !!(ownerUid && currentUser.uid === ownerUid && !isMe);

    document.getElementById('seatActionsGiftBtn').style.display = isMe ? 'none' : 'flex';
    document.getElementById('seatActionsChatBtn').style.display = isMe ? 'none' : 'flex';
    document.getElementById('seatActionsReportBtn').style.display = isMe ? 'none' : 'flex';

    const micItem = document.getElementById('seatActionsMicItem');
    if (isMe || isOwnerViewing) {
      micItem.style.display = 'flex';
      document.getElementById('seatActionsMicLabel').textContent = seatData.muted ? 'Unmute' : 'Mute';
    } else {
      micItem.style.display = 'none';
    }

    document.getElementById('seatActionsStandItem').style.display = isMe ? 'flex' : 'none';
    document.getElementById('seatActionsKickItem').style.display = isOwnerViewing ? 'flex' : 'none';
    document.getElementById('seatActionsBanItem').style.display = isOwnerViewing ? 'flex' : 'none';
    document.getElementById('seatActionsModItem').style.display = isOwnerViewing ? 'flex' : 'none';

    document.getElementById('seatActionsOverlay').classList.add('show');
  }

  function closeSeatActionsMenu() {
    document.getElementById('seatActionsOverlay').classList.remove('show');
  }

  function seatActionsGift() {
    closeSeatActionsMenu();
    giftFromSeatProfile();
  }

  function seatActionsChat() {
    closeSeatActionsMenu();
    chatFromSeatProfile();
  }

  function seatActionsReport() {
    closeSeatActionsMenu();
    reportSeatProfileUser();
  }

  function seatActionsStandUp() {
    if (!seatActionsContext || !currentUser) return;
    const { type, containerId, seatIndex } = seatActionsContext;
    const seatPath = (type === 'room' ? 'liveRooms/' : 'families/') + containerId + '/seats/' + seatIndex;
    db.ref(seatPath).remove();
    db.ref('users/' + currentUser.uid + '/activeSeat').remove();
    closeSeatActionsMenu();
  }

  function seatActionsViewProfile() {
    if (!seatActionsContext) return;
    const { seatData } = seatActionsContext;
    closeSeatActionsMenu();
    openSeatProfile(seatData.uid, seatData.name);
  }

  function seatActionsToggleMic() {
    if (!seatActionsContext) return;
    const { type, containerId, seatIndex, seatData } = seatActionsContext;
    const path = (type === 'room' ? 'liveRooms/' : 'families/') + containerId + '/seats/' + seatIndex + '/muted';
    db.ref(path).set(!seatData.muted);
    closeSeatActionsMenu();
  }

  function seatActionsKick() {
    if (!seatActionsContext) return;
    const { type, containerId, seatIndex, seatData } = seatActionsContext;
    if (!confirm('Remove ' + (seatData.name || 'this user') + ' from the seat?')) return;
    const seatPath = (type === 'room' ? 'liveRooms/' : 'families/') + containerId + '/seats/' + seatIndex;
    db.ref(seatPath).remove();
    db.ref('users/' + seatData.uid + '/activeSeat').remove();
    toast(seatData.name + ' was removed from the seat.');
    closeSeatActionsMenu();
  }

  // ---------- ROOM: CHAT ----------
  function listenToRoomChat() {
    if (!currentRoomId) return;
    const chatArea = document.getElementById('roomChatArea');
    const msgsRef = db.ref('liveRooms/' + currentRoomId + '/messages').limitToLast(50);
    const handler = msgsRef.on('value', (snap) => {
      chatArea.innerHTML = '';
      const messages = snap.val();
      if (!messages) {
        chatArea.innerHTML = '<div class="loading">No messages yet. Say hi! 👋</div>';
        return;
      }
      Object.values(messages).forEach((msg) => {
        if (isUserBlocked(msg.uid)) return;
        const div = document.createElement('div');
        const isMe = msg.uid === currentUser.uid;
        div.className = 'msg ' + (isMe ? 'me' : 'other');
        div.innerHTML = (isMe ? '' : `<div class="sender">${escapeHtml(msg.name)}</div>`) + escapeHtml(msg.text);
        chatArea.appendChild(div);
      });
      chatArea.scrollTop = chatArea.scrollHeight;
    });
    currentRoomChatListener = () => msgsRef.off('value', handler);
  }

  function sendRoomMessage() {
    const input = document.getElementById('roomMsgInput');
    const text = input.value.trim();
    if (!text || !currentUser || !currentRoomId) return;
    if (isChatRateLimited()) return;
    db.ref('liveRooms/' + currentRoomId + '/messages').push({
      uid: currentUser.uid,
      name: currentUserData.name,
      text: text,
      timestamp: Date.now()
    });
    addXp(XP_PER_MESSAGE);
    input.value = '';
  }

  // ---------- TIC-TAC-TOE ----------
  let tttListenerAttached = false;

  function selectGameCard(cardEl) {
    document.querySelectorAll('.game-card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');
  }

  function openTicTacToe() {
    document.getElementById('tttOverlay').classList.add('show');
    if (!tttListenerAttached) {
      tttListenerAttached = true;
      db.ref('games/tictactoe').on('value', renderTicTacToe);
    }
    db.ref('games/tictactoe/players').once('value').then((snap) => {
      const players = snap.val() || {};
      if (!players.X) {
        db.ref('games/tictactoe/players/X').set({ uid: currentUser.uid, name: currentUserData.name });
      } else if (!players.O && players.X.uid !== currentUser.uid) {
        db.ref('games/tictactoe/players/O').set({ uid: currentUser.uid, name: currentUserData.name });
      }
    });
  }

  function closeTicTacToe() {
    document.getElementById('tttOverlay').classList.remove('show');
  }

  function renderTicTacToe(snap) {
    const data = snap.val() || {};
    const board = data.board || Array(9).fill('');
    const players = data.players || {};
    const turn = data.turn || 'X';
    const boardEl = document.getElementById('tttBoard');
    const statusEl = document.getElementById('tttStatus');

    boardEl.innerHTML = '';
    board.forEach((val, i) => {
      const cell = document.createElement('div');
      cell.className = 'ttt-cell';
      cell.textContent = val;
      cell.onclick = () => tapTicTacToeCell(i, board, turn, players);
      boardEl.appendChild(cell);
    });

    const winner = checkTicTacToeWinner(board);
    if (winner) {
      statusEl.textContent = "🎉 " + winner + " wins!";
    } else if (board.every(c => c)) {
      statusEl.textContent = "It's a draw!";
    } else if (!players.X || !players.O) {
      statusEl.textContent = "Waiting for a second player...";
    } else {
      const myMark = players.X.uid === currentUser.uid ? 'X' : (players.O.uid === currentUser.uid ? 'O' : null);
      statusEl.textContent = myMark ? (turn === myMark ? "Your turn (" + myMark + ")" : "Opponent's turn") : "Spectating";
    }
  }

  function tapTicTacToeCell(index, board, turn, players) {
    if (!currentUser || board[index]) return;
    const myMark = players.X && players.X.uid === currentUser.uid ? 'X' : (players.O && players.O.uid === currentUser.uid ? 'O' : null);
    if (!myMark || myMark !== turn) return;
    if (checkTicTacToeWinner(board)) return;

    const newBoard = board.slice();
    newBoard[index] = myMark;
    db.ref('games/tictactoe').update({
      board: newBoard,
      turn: myMark === 'X' ? 'O' : 'X'
    });
  }

  function checkTicTacToeWinner(board) {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b,c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return null;
  }

  function resetTicTacToe() {
    db.ref('games/tictactoe').set({
      board: Array(9).fill(''),
      turn: 'X',
      players: {}
    });
  }

  // ---------- GIFTS ----------
  const GIFTS = [
    { emoji: '🍑', name: 'Peach Love', cost: 10, cat: 'classical' },
    { emoji: '🍀', name: 'Clover', cost: 10, cat: 'classical' },
    { emoji: '🥰', name: 'Love U', cost: 10, cat: 'classical' },
    { emoji: '🔑', name: 'Golden Key', cost: 20, cat: 'classical' },
    { emoji: '🍺', name: 'Celebration Glass', cost: 50, cat: 'classical' },
    { emoji: '🌻', name: 'Sunflower', cost: 50, cat: 'classical' },
    { emoji: '⏳', name: 'Hourglass', cost: 50, cat: 'classical' },
    { emoji: '🪶', name: 'Golden Feather', cost: 50, cat: 'classical' },
    { emoji: '🌹', name: 'Rose', cost: 10, cat: 'classical' },
    { emoji: '🍰', name: 'Cake', cost: 50, cat: 'classical' },
    { emoji: '💎', name: 'Diamond', cost: 100, cat: 'premium' },
    { emoji: '👑', name: 'Crown', cost: 500, cat: 'premium' },
    { emoji: '🚀', name: 'Rocket', cost: 1000, cat: 'premium' },
    { emoji: '🦁', name: 'Lion', cost: 5000, cat: 'premium' }
  ];

  let giftSelectedRecipients = new Set();
  let giftSelectedCategory = 'classical';
  let giftSelectedItem = null;
  let giftQty = 1;

  let giftRecipientUid = null;
  let giftRecipientName = null;

  let giftContext = 'room';
  let giftContextId = null;

  function openGiftPicker(preselectUid, preselectName) {
    if (!currentRoomId && !currentFamilyId) { alert('Join a Room or Family first to send gifts.'); return; }
    giftContext = currentRoomId ? 'room' : 'family';
    giftContextId = currentRoomId ? currentRoomId : currentFamilyId;
    giftSendInProgress = false;
    giftSelectedRecipients = new Set();
    giftSelectedItem = null;
    giftQty = 1;
    giftSelectedCategory = 'classical';

    if (giftContext === 'room') {
      db.ref('liveRooms/' + giftContextId + '/seats').once('value').then((snap) => {
        const seats = snap.val() || {};
        const others = Object.values(seats).filter(s => currentUser && s.uid !== currentUser.uid);
        renderRecipientChips(others);
        if (preselectUid) giftSelectedRecipients.add(preselectUid);
        renderRecipientChips(others);
      });
    } else {
      db.ref('families/' + giftContextId + '/members').once('value').then((snap) => {
        const members = snap.val() || {};
        const memberUids = Object.keys(members).filter(uid => currentUser && uid !== currentUser.uid);
        Promise.all(memberUids.map(uid => db.ref('users/' + uid).once('value').then(s => ({ uid, name: (s.val() || {}).name || 'User' }))))
          .then((others) => {
            renderRecipientChips(others);
            if (preselectUid) giftSelectedRecipients.add(preselectUid);
            renderRecipientChips(others);
          });
      });
    }

    document.getElementById('giftQtyDisplay').textContent = '1';
    document.getElementById('giftWalletDisplay').textContent = formatNum((currentUserData && currentUserData.love) || 0);
    document.querySelectorAll('.gqp-btn').forEach(b => b.classList.toggle('active', b.textContent === '1'));
    switchGiftCategory('classical');
    document.getElementById('giftOverlay').classList.add('show');
  }

  function closeGiftPicker() {
    document.getElementById('giftOverlay').classList.remove('show');
  }

  let giftRecipientsCache = [];

  function renderRecipientChips(others) {
    if (others) giftRecipientsCache = others;
    const rowEl = document.getElementById('giftRecipientsRow');
    rowEl.innerHTML = '';
    giftRecipientsCache.forEach((r) => {
      const chip = document.createElement('div');
      const isSel = giftSelectedRecipients.has(r.uid);
      chip.className = 'gift-recip-chip' + (isSel ? ' selected' : '');
      chip.innerHTML = `<div class="grc-avatar">${escapeHtml(r.name.charAt(0).toUpperCase())}</div><div class="grc-name">${escapeHtml(r.name)}</div>`;
      chip.onclick = () => toggleRecipient(r.uid);
      rowEl.appendChild(chip);
    });
    const allBtn = document.getElementById('giftSelectAllBtn');
    const allSelected = giftRecipientsCache.length > 0 && giftSelectedRecipients.size === giftRecipientsCache.length;
    allBtn.classList.toggle('active', allSelected);
  }

  function toggleRecipient(uid) {
    if (giftSelectedRecipients.has(uid)) giftSelectedRecipients.delete(uid);
    else giftSelectedRecipients.add(uid);
    renderRecipientChips();
  }

  function toggleSelectAllRecipients() {
    if (giftSelectedRecipients.size === giftRecipientsCache.length) {
      giftSelectedRecipients = new Set();
    } else {
      giftSelectedRecipients = new Set(giftRecipientsCache.map(r => r.uid));
    }
    renderRecipientChips();
  }

  function switchGiftCategory(cat) {
    giftSelectedCategory = cat;
    document.querySelectorAll('.gct').forEach(el => el.classList.toggle('active', el.dataset.cat === cat));
    renderGiftGrid();
  }

  function getGiftRarity(cost) {
    if (cost >= 2000) return 'legendary';
    if (cost >= 300) return 'epic';
    if (cost >= 50) return 'rare';
    return 'common';
  }

  function renderGiftGrid() {
    const gridEl = document.getElementById('giftGrid');
    gridEl.innerHTML = '';
    GIFTS.filter(g => g.cat === giftSelectedCategory).forEach((gift) => {
      const cell = document.createElement('div');
      const isSel = giftSelectedItem === gift;
      const rarity = getGiftRarity(gift.cost);
      cell.className = 'gift-cell rarity-' + rarity + (isSel ? ' selected' : '');
      cell.innerHTML = `<div class="g-emoji">${gift.emoji}</div><div class="g-name">${gift.name}</div><div class="g-rarity ${rarity}">${rarity}</div><div class="g-cost">💕 ${formatNum(gift.cost)}</div>`;
      cell.onclick = () => { giftSelectedItem = gift; renderGiftGrid(); };
      gridEl.appendChild(cell);
    });
  }

  function changeGiftQty(delta) {
    giftQty = Math.max(1, giftQty + delta);
    document.getElementById('giftQtyDisplay').textContent = giftQty;
    document.querySelectorAll('.gqp-btn').forEach(b => b.classList.remove('active'));
  }

  function setGiftQty(value) {
    giftQty = value;
    document.getElementById('giftQtyDisplay').textContent = giftQty;
    document.querySelectorAll('.gqp-btn').forEach(b => b.classList.toggle('active', parseInt(b.textContent) === value));
  }

  let giftSendInProgress = false;

  function addUserRoomXp(uid, amount) {
    db.ref('users/' + uid + '/roomXP').once('value').then((snap) => {
      const newXp = (snap.val() || 0) + amount;
      const levelInfo = getGroupLevelInfo(newXp);
      db.ref('users/' + uid).update({ roomXP: newXp, roomLevel: levelInfo.level });
    });
  }

  function confirmSendGift() {
    if (!currentUser || !currentUserData || !giftContextId) return;
    if (giftSendInProgress) return;
    if (giftSelectedRecipients.size === 0) { alert('Pick at least one recipient.'); return; }
    if (!giftSelectedItem) { alert('Pick a gift first.'); return; }

    const totalCost = giftSelectedItem.cost * giftQty * giftSelectedRecipients.size;
    const myLove = currentUserData.love || 0;
    if (myLove < totalCost) { alert('Not enough Love Coins for this gift.'); return; }
    giftSendInProgress = true;
    const sendBtnEl = document.querySelector('.gsb-send-btn');
    if (sendBtnEl) sendBtnEl.disabled = true;

    const recipientUids = Array.from(giftSelectedRecipients);
    const perRecipientCost = giftSelectedItem.cost * giftQty;
    const perRecipientReward = Math.floor(perRecipientCost * 0.5);

    db.ref('users/' + currentUser.uid).update({
      love: myLove - totalCost,
      bossScore: (currentUserData.bossScore || 0) + totalCost
    });
    if (giftContext === 'room') {
      db.ref('liveRooms/' + giftContextId + '/activityScore').once('value').then((s) => {
        db.ref('liveRooms/' + giftContextId + '/activityScore').set((s.val() || 0) + totalCost);
      });
    }
    addUserRoomXp(currentUser.uid, totalCost);
    if (giftContext === 'family') completeFamilyTask(giftContextId, 'sendgift');

    const recipientNames = [];
    let pending = recipientUids.length;
    recipientUids.forEach((uid) => {
      const chip = giftRecipientsCache.find(r => r.uid === uid);
      const rName = chip ? chip.name : 'User';
      recipientNames.push(rName);
      db.ref('users/' + uid).once('value').then((snap) => {
        const rData = snap.val();
        if (rData) {
          db.ref('users/' + uid).update({
            love: (rData.love || 0) + perRecipientReward,
            charmScore: (rData.charmScore || 0) + perRecipientCost
          });
        }
        addUserRoomXp(uid, perRecipientCost);
        if (giftContext === 'family') completeFamilyTask(giftContextId, 'receivegift', uid);
        addActivity(uid, 'social', currentUserData.name + ' sent you ' + giftQty + '× ' + giftSelectedItem.emoji + ' ' + giftSelectedItem.name + '!');
        pending--;
        if (pending === 0) finishGiftSend(recipientNames);
      });
    });
  }

  function finishGiftSend(recipientNames) {
    const namesText = recipientNames.length > 2
      ? recipientNames.slice(0, 2).join(', ') + ' +' + (recipientNames.length - 2) + ' more'
      : recipientNames.join(' & ');

    const messagesPath = giftContext === 'room' ? 'liveRooms/' + giftContextId + '/messages' : 'families/' + giftContextId + '/messages';
    db.ref(messagesPath).push({
      uid: currentUser.uid,
      name: currentUserData.name,
      text: '🎁 sent ' + namesText + ' ' + giftQty + '× ' + giftSelectedItem.name + ' ' + giftSelectedItem.emoji,
      timestamp: Date.now()
    });

    addActivity(currentUser.uid, 'personal', 'You sent ' + giftQty + '× ' + giftSelectedItem.emoji + ' ' + giftSelectedItem.name + ' to ' + namesText);

    showGiftFlash(giftSelectedItem.emoji, getGiftRarity(giftSelectedItem.cost) === 'legendary');
    closeGiftPicker();
    giftSendInProgress = false;
    const sendBtnEl = document.querySelector('.gsb-send-btn');
    if (sendBtnEl) sendBtnEl.disabled = false;
  }

  function showGiftFlash(emoji, isLegendary) {
    const flash = document.createElement('div');
    flash.className = 'gift-flash' + (isLegendary ? ' legendary' : '');
    flash.textContent = emoji;
    document.body.appendChild(flash);

    if (isLegendary) {
      const burst = document.createElement('div');
      burst.className = 'gift-flash-burst';
      for (let i = 0; i < 12; i++) {
        const spark = document.createElement('span');
        const angle = (i / 12) * 360;
        spark.style.setProperty('--angle', angle + 'deg');
        spark.style.animationDelay = (i * 0.03) + 's';
        burst.appendChild(spark);
      }
      document.body.appendChild(burst);
      setTimeout(() => burst.remove(), 1600);
    }

    setTimeout(() => flash.remove(), 1400);
  }
