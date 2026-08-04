// Bulletproof Safety Guard for Firebase
  let auth = null;
  let db = null;

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

  try {
    if (typeof firebase !== 'undefined') {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      auth = firebase.auth();
      db = firebase.database();
    }
  } catch (e) {
    console.warn("Firebase Load Warning:", e);
  }

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

  (function setupBannerSlider() {
    const track = document.getElementById('topbarBannerTrack');
    if (!track) return;
    const slideCount = track.children.length;
    let current = 0;
    setInterval(() => {
      current = (current + 1) % slideCount;
      track.style.transform = `translateX(-${current * 100}%)`;
    }, 4000);
  })();

  (function setupPullToRefresh() {
    const indicator = document.getElementById('pullRefreshIndicator');
    if (!indicator) return;
    let startY = 0;
    let pulling = false;

    document.addEventListener('touchstart', (e) => {
      pulling = window.scrollY <= 0;
      startY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        const pull = Math.min(dy * 0.5, 90);
        indicator.style.transform = `translateY(${pull}px)`;
        indicator.style.opacity = Math.min(pull / 55, 1);
        indicator.textContent = pull > 55 ? '↻ Release to refresh' : '↓ Pull to refresh';
      }
    }, { passive: false });

    document.addEventListener('touchend', () => {
      if (!pulling) return;
      pulling = false;
      if (indicator.style.opacity === '1') {
        indicator.textContent = '↻ Refreshing...';
        setTimeout(() => location.reload(), 250);
      } else {
        indicator.style.transform = '';
        indicator.style.opacity = '';
      }
    }, { passive: true });
  })();

  const LEVEL_REQUIRED_TO_CREATE = 5;
  const XP_PER_LEVEL = 150;
  const XP_PER_MESSAGE = 5;
  const HARVEST_CYCLE_MS = 30 * 60 * 1000;
  const UPGRADE_INCREMENT = 1000;
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

  // Working Toggle Mode (Login <-> Create Account)
  function toggleAuthMode() {
    isSignupMode = !isSignupMode;
    const title = document.getElementById('authTitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleBtn = document.getElementById('toggleAuthMode');
    const nameInput = document.getElementById('nameInput');
    const forgotLink = document.getElementById('forgotPasswordLink');
    const errorEl = document.getElementById('authError');

    if (title) title.textContent = isSignupMode ? "Create Account" : "Welcome Back";
    if (submitBtn) submitBtn.textContent = isSignupMode ? "Sign Up" : "Login";
    if (toggleBtn) toggleBtn.textContent = isSignupMode ? "Already have an account? Login" : "New here? Create an account";
    if (nameInput) nameInput.style.display = isSignupMode ? "block" : "none";
    if (forgotLink) forgotLink.style.display = isSignupMode ? "none" : "block";
    if (errorEl) errorEl.textContent = "";
  }

  function handleForgotPassword() {
    const emailEl = document.getElementById('emailInput');
    const email = emailEl ? emailEl.value.trim() : "";
    if (!email) {
      alert("⚠️ Pehle uper wale box mein apna Email likhein.");
      return;
    }
    if (auth) {
      auth.sendPasswordResetEmail(email).then(() => {
        alert("✅ Password reset link aap ke Email par bhej diya gaya hai!");
      }).catch((err) => {
        alert("⚠️ " + err.message);
      });
    } else {
      alert("⚠️ Network Issue: Password reset request abhi send nahi ho saki.");
    }
  }

  // Instant 1-Click Guest Login
  function handleGuestLogin() {
    const nameInput = document.getElementById('nameInput');
    const enteredName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : "";
    const guestName = enteredName || ("Guest_" + Math.floor(Math.random() * 8999 + 1000));
    
    currentUser = { uid: "guest_" + Date.now(), isGuest: true };
    currentUserData = {
      name: guestName,
      coins: 10000,
      gems: 500,
      love: 200,
      level: 1,
      farmLevel: 1,
      profileId: String(Math.floor(10000000 + Math.random() * 90000000))
    };

    hideSplashScreen();
    const authScr = document.getElementById('authScreen');
    const mainScr = document.getElementById('mainScreen');
    if (authScr) authScr.classList.remove('active');
    if (mainScr) mainScr.style.display = 'flex';
    
    renderUserHeader();
    renderHome();
    if (db) {
      listenToChat();
      listenToFamilyList();
      listenToRoomList();
    }
    
    toast("Welcome " + guestName + "! 🎉 (Guest Mode)");
  }

  function handleAuth() {
    const emailEl = document.getElementById('emailInput');
    const passEl = document.getElementById('passInput');
    const nameEl = document.getElementById('nameInput');
    const errorEl = document.getElementById('authError');
    const btn = document.getElementById('authSubmitBtn');

    const email = emailEl ? emailEl.value.trim() : "";
    const pass = passEl ? passEl.value : "";
    const name = nameEl ? nameEl.value.trim() : "";

    if (errorEl) errorEl.textContent = "";

    if (!email || !pass) {
      const msg = "⚠️ Email aur Password donon likhna zaroori hai.";
      if (errorEl) errorEl.textContent = msg;
      alert(msg);
      return;
    }
    if (isSignupMode && !name) {
      const msg = "⚠️ Apna Naam zaroor likhein.";
      if (errorEl) errorEl.textContent = msg;
      alert(msg);
      return;
    }
    if (pass.length < 6) {
      const msg = "⚠️ Password kam se kam 6 huroof ka hona chahiye.";
      if (errorEl) errorEl.textContent = msg;
      alert(msg);
      return;
    }

    if (!auth) {
      alert("⚠️ Firebase Auth ready nahi hai. Aap 'Quick Guest Login' ka neela button dabayein!");
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = isSignupMode ? "Account Ban Raha Hai..." : "Login Ho Raha Hai...";
    }

    if (isSignupMode) {
      auth.createUserWithEmailAndPassword(email, pass)
        .then((cred) => {
          if (db) {
            return db.ref('users/' + cred.user.uid).set({
              name: name,
              email: email,
              vip: 1, coins: 0, gems: 0, love: 0, xp: 0, level: 1, farmLevel: 1,
              profileId: String(Math.floor(10000000 + Math.random() * 90000000)),
              lastHarvestAt: Date.now()
            });
          }
        })
        .catch((err) => {
          if (btn) { btn.disabled = false; btn.textContent = "Sign Up"; }
          let errMsg = err.message;
          if (err.code === 'auth/email-already-in-use') {
            errMsg = "Yeh Email pehle se registered hai. Login karein!";
          } else if (err.code === 'auth/invalid-email') {
            errMsg = "Sahi Email address darj karein.";
          }
          if (errorEl) errorEl.textContent = "⚠️ " + errMsg;
          alert("⚠️ Sign Up Error: " + errMsg);
        });
    } else {
      auth.signInWithEmailAndPassword(email, pass)
        .catch((err) => {
          if (btn) { btn.disabled = false; btn.textContent = "Login"; }
          let errMsg = err.message;
          if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
            errMsg = "Account nahi mila ya Password galat hai! Pehle 'New here? Create an account' par click karein.";
          } else if (err.code === 'auth/wrong-password') {
            errMsg = "Password galat hai!";
          }
          if (errorEl) errorEl.textContent = "⚠️ " + errMsg;
          alert("⚠️ Login Error: " + errMsg);
        });
    }
  }

  function handleLogout() {
    currentUser = null;
    currentUserData = null;
    if (auth && auth.currentUser) auth.signOut();
    location.reload();
  }

  let initialRestoreDone = false;

  function hideSplashScreen() {
    const splash = document.getElementById('splashScreen');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(function() { splash.style.display = 'none'; }, 300);
    }
  }

  if (auth) {
    auth.onAuthStateChanged((user) => {
      hideSplashScreen();

      if (currentUser && currentUser.isGuest) return;

      if (user && !currentUser) {
        currentUser = user;
        if (db) {
          db.ref('users/' + user.uid).on('value', (snap) => {
            currentUserData = snap.val() || { name: "User", level: 1, xp: 0, coins: 0, gems: 0, lastHarvestAt: Date.now() };
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
              switchTab(localStorage.getItem('lastTab') || 'hifami');
            }
          });
        }

        const authScr = document.getElementById('authScreen');
        const mainScr = document.getElementById('mainScreen');
        if (authScr) authScr.classList.remove('active');
        if (mainScr) mainScr.style.display = 'flex';
        
        listenToChat();
        listenToFamilyList();
        listenToRoomList();
        listenToMoments();
      } else if (!currentUser) {
        currentUser = null;
        const mainScr = document.getElementById('mainScreen');
        const authScr = document.getElementById('authScreen');
        if (mainScr) mainScr.style.display = 'none';
        if (authScr) authScr.classList.add('active');
        const btn = document.getElementById('authSubmitBtn');
        if (btn) { btn.disabled = false; btn.textContent = isSignupMode ? "Sign Up" : "Login"; }
      }
    });
  }

  function renderUserHeader() {
    if (!currentUserData) return;
    const nameEl = document.getElementById('userName');
    const lvlEl = document.getElementById('userLevelLabel');
    if (nameEl) nameEl.textContent = currentUserData.name || 'User';
    applyAvatarPhoto(document.getElementById('userAvatar'), currentUserData);
    if (lvlEl) lvlEl.textContent = "ID Lv. " + (currentUserData.level || 1);
    renderProfile();
  }

  function applyAvatarPhoto(el, userData) {
    if (!el) return;
    const letter = (userData && userData.name ? userData.name.charAt(0).toUpperCase() : '?');
    if (userData && userData.photoURL) {
      el.style.backgroundImage = `url('${userData.photoURL}')`;
      el.style.backgroundSize = 'cover';
      el.textContent = '';
    } else {
      el.style.backgroundImage = '';
      el.textContent = letter;
    }
  }

  function renderProfile() {
    if (!currentUserData) return;
    applyAvatarPhoto(document.getElementById('profileAvatarBig'), currentUserData);
    const pName = document.getElementById('profileNameBig');
    const pIdLvl = document.getElementById('profileIdLevelBadge');
    const pVipLvl = document.getElementById('profileVipLevelBadge');
    const pWallet = document.getElementById('profileWalletValue');
    const pFam = document.getElementById('profileFamilyValue');
    const pIdNum = document.getElementById('profileIdNumber');
    const pRef = document.getElementById('myReferralCode');

    if (pName) pName.textContent = currentUserData.name || 'User';
    if (pIdLvl) pIdLvl.textContent = "🆔 ID Lv. " + (currentUserData.level || 1);
    if (pVipLvl) pVipLvl.textContent = "👑 VIP " + (currentUserData.farmLevel || 1);
    if (pWallet) pWallet.textContent = "🪙" + formatNum(currentUserData.coins || 0) + " 💎" + formatNum(currentUserData.gems || 0);
    if (pFam) pFam.textContent = currentFamilyId ? 'Joined' : 'None';
    if (pIdNum) pIdNum.textContent = currentUserData.profileId || '—';
    if (pRef) pRef.textContent = currentUserData.profileId || '—';
  }

  function openProfile() {
    renderProfile();
    const profOv = document.getElementById('profileOverlay');
    if (profOv) profOv.classList.add('show');
  }

  function closeProfile() {
    const profOv = document.getElementById('profileOverlay');
    if (profOv) profOv.classList.remove('show');
    hideAllProfileSubViews();
  }

  function hideAllProfileSubViews() {
    const ids = ['inviteView','languageView','settingsView','editProfileView','accountSecurityView','infoPageView'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const mainV = document.getElementById('profileMainView');
    if (mainV) mainV.style.display = 'block';
  }

  function copyProfileId() {
    const idEl = document.getElementById('profileIdNumber');
    const id = idEl ? idEl.textContent : '';
    if (navigator.clipboard) navigator.clipboard.writeText(id).then(() => toast('ID copied: ' + id));
  }

  function switchTab(tab) {
    ['homePanel','chatPanel','familyPanel','momentsPanel','roomPanel'].forEach(p => {
      const el = document.getElementById(p);
      if (el) el.classList.remove('active');
    });
    ['navHifami','navMessages','navFamily','navMoments','navRoom'].forEach(n => {
      const el = document.getElementById(n);
      if (el) el.classList.remove('active');
    });

    const targetPanel = document.getElementById(tab === 'hifami' ? 'homePanel' : (tab === 'messages' ? 'chatPanel' : (tab === 'family' ? 'familyPanel' : (tab === 'moments' ? 'momentsPanel' : 'roomPanel'))));
    const targetNav = document.getElementById(tab === 'hifami' ? 'navHifami' : (tab === 'messages' ? 'navMessages' : (tab === 'family' ? 'navFamily' : (tab === 'moments' ? 'navMoments' : 'navRoom'))));
    
    if (targetPanel) targetPanel.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    updateFamilyBubble(tab);
    localStorage.setItem('lastTab', tab);
  }

  function getActiveTab() {
    if (document.getElementById('homePanel') && document.getElementById('homePanel').classList.contains('active')) return 'hifami';
    if (document.getElementById('familyPanel') && document.getElementById('familyPanel').classList.contains('active')) return 'family';
    if (document.getElementById('momentsPanel') && document.getElementById('momentsPanel').classList.contains('active')) return 'moments';
    if (document.getElementById('roomPanel') && document.getElementById('roomPanel').classList.contains('active')) return 'room';
    return 'messages';
  }

  function updateFamilyBubble(activeTab) {
    const bubble = document.getElementById('familyBubble');
    if (!bubble) return;
    if (currentFamilyId && activeTab !== 'family') {
      bubble.classList.add('show');
    } else {
      bubble.classList.remove('show');
    }
  }

  function getFarmLevel() { return (currentUserData && currentUserData.farmLevel) || 1; }
  function getProductionAmount() {
    const lvl = getFarmLevel();
    let total = 0;
    PLOTS.forEach((p) => { if (lvl >= p.requiredLevel) total += p.bonus; });
    return total;
  }

  function renderHome() {
    if (!currentUserData) return;
    const cEl = document.getElementById('coinsDisplay');
    const gEl = document.getElementById('gemsDisplay');
    const lEl = document.getElementById('loveDisplay');
    const tagEl = document.getElementById('homeFarmLevelTag');
    const rateEl = document.getElementById('rateLabel');

    if (cEl) cEl.textContent = formatNum(currentUserData.coins || 0);
    if (gEl) gEl.textContent = formatNum(currentUserData.gems || 0);
    if (lEl) lEl.textContent = formatNum(currentUserData.love || 0);
    if (tagEl) tagEl.textContent = "🌾 Farm Level " + getFarmLevel();
    if (rateEl) rateEl.textContent = "In 30 min: 🪙 " + formatNum(getProductionAmount());
    renderPlots();
  }

  const CROP_EMOJIS = ['🥕','🌽','🥬','🍅','🌻','🥦','🍆','🌾','🥔','🌿'];
  function renderPlots() {
    const farmLevel = getFarmLevel();
    const gridEl = document.getElementById('plotsGrid10');
    if (!gridEl) return;
    gridEl.innerHTML = '';
    PLOTS.forEach((plot, i) => {
      const isUnlocked = farmLevel >= plot.requiredLevel;
      const cell = document.createElement('div');
      cell.className = 'plot10-cell ' + (isUnlocked ? 'unlocked' : 'locked');
      cell.innerHTML = isUnlocked
        ? `<div class="p-emoji">${CROP_EMOJIS[i % CROP_EMOJIS.length]}</div><div class="p-bonus">+${plot.bonus}</div>`
        : `<div class="p-emoji">🔒</div><div class="p-label">${plot.label}</div>`;
      gridEl.appendChild(cell);
    });
  }

  function doHarvest() {
    if (!currentUser || !currentUserData) return;
    const gained = getProductionAmount();
    if (db && !currentUser.isGuest) {
      db.ref('users/' + currentUser.uid).update({
        coins: (currentUserData.coins || 0) + gained,
        lastHarvestAt: Date.now()
      });
    } else {
      currentUserData.coins = (currentUserData.coins || 0) + gained;
      renderHome();
    }
    toast('Collected 🪙 ' + formatNum(gained));
  }

  function upgradeFarm() {
    if (!currentUser || !currentUserData) return;
    const cost = getFarmLevel() * UPGRADE_INCREMENT;
    if ((currentUserData.gems || 0) < cost) { toast('Not enough Gems!', 'error'); return; }
    
    if (db && !currentUser.isGuest) {
      db.ref('users/' + currentUser.uid).update({
        gems: currentUserData.gems - cost,
        farmLevel: getFarmLevel() + 1
      });
    } else {
      currentUserData.gems -= cost;
      currentUserData.farmLevel += 1;
      renderHome();
    }
    toast('Farm Upgraded! 👑');
  }

  let currentRoomId = null;
  let roomListCache = null;

  function listenToRoomList() {
    if (!db) return;
    db.ref('liveRooms').on('value', (snap) => {
      roomListCache = snap.val();
      renderRoomList();
    });
  }

  function renderRoomList() {
    const listEl = document.getElementById('roomExploreList');
    if (!listEl) return;
    if (!roomListCache) { listEl.innerHTML = '<div class="loading">No rooms available.</div>'; return; }
    listEl.innerHTML = '';
    Object.entries(roomListCache).forEach(([id, r]) => {
      const card = document.createElement('div');
      card.className = 'room-card';
      card.innerHTML = `<div class="rc-thumb">🏠</div><div 
