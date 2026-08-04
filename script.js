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

  const auth = firebase.auth();
  const db = firebase.database();

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
    if (!email) {
      alert("⚠️ Pehle apna Email box me likhein.");
      return;
    }
    auth.sendPasswordResetEmail(email).then(() => {
      alert("✅ Password reset link aap ke Email par bhej diya gaya hai!");
    }).catch((err) => {
      alert("⚠️ " + err.message);
    });
  }

  // Guaranteed 1-Click Guest Login (Instant Entrance)
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
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('mainScreen').style.display = 'flex';
    
    renderUserHeader();
    renderHome();
    listenToChat();
    listenToFamilyList();
    listenToRoomList();
    
    toast("Welcome " + guestName + "! 🎉 (Guest Mode)");
  }

  function handleAuth() {
    const email = document.getElementById('emailInput').value.trim();
    const pass = document.getElementById('passInput').value;
    const name = document.getElementById('nameInput').value.trim();
    const errorEl = document.getElementById('authError');
    const btn = document.getElementById('authSubmitBtn');
    errorEl.textContent = "";

    if (!email || !pass) {
      const msg = "⚠️ Email aur Password donon likhna zaroori hai.";
      errorEl.textContent = msg;
      alert(msg);
      return;
    }
    if (isSignupMode && !name) {
      const msg = "⚠️ Apna Naam zaroor likhein.";
      errorEl.textContent = msg;
      alert(msg);
      return;
    }
    if (pass.length < 6) {
      const msg = "⚠️ Password kam se kam 6 huroof ka hona chahiye.";
      errorEl.textContent = msg;
      alert(msg);
      return;
    }

    btn.disabled = true;
    btn.textContent = isSignupMode ? "Account Ban Raha Hai..." : "Login Ho Raha Hai...";

    if (isSignupMode) {
      auth.createUserWithEmailAndPassword(email, pass)
        .then((cred) => {
          return db.ref('users/' + cred.user.uid).set({
            name: name,
            email: email,
            vip: 1, coins: 0, gems: 0, love: 0, xp: 0, level: 1, farmLevel: 1,
            profileId: String(Math.floor(10000000 + Math.random() * 90000000)),
            lastHarvestAt: Date.now()
          });
        })
        .catch((err) => {
          btn.disabled = false;
          btn.textContent = "Sign Up";
          let errMsg = err.message;
          if (err.code === 'auth/email-already-in-use') {
            errMsg = "Yeh Email pehle se registered hai. 'Login' par click karein!";
          } else if (err.code === 'auth/invalid-email') {
            errMsg = "Sahi Email address darj karein.";
          }
          errorEl.textContent = "⚠️ " + errMsg;
          alert("⚠️ Sign Up Failed: " + errMsg);
        });
    } else {
      auth.signInWithEmailAndPassword(email, pass)
        .catch((err) => {
          btn.disabled = false;
          btn.textContent = "Login";
          let errMsg = err.message;
          if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
            errMsg = "Account nahi mila ya Password galat hai! Pehle 'New here? Create an account' par click karein.";
          } else if (err.code === 'auth/wrong-password') {
            errMsg = "Password galat hai!";
          }
          errorEl.textContent = "⚠️ " + errMsg;
          alert("⚠️ Login Failed: " + errMsg);
        });
    }
  }

  function handleLogout() {
    currentUser = null;
    currentUserData = null;
    if (auth.currentUser) auth.signOut();
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

  auth.onAuthStateChanged((user) => {
    hideSplashScreen();

    // Prevent Firebase Auth from kicking out Guest Users
    if (currentUser && currentUser.isGuest) {
      return;
    }

    if (user && !currentUser) {
      currentUser = user;
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

      document.getElementById('authScreen').classList.remove('active');
      document.getElementById('mainScreen').style.display = 'flex';
      listenToChat();
      listenToFamilyList();
      listenToRoomList();
      listenToMoments();
    } else if (!currentUser) {
      currentUser = null;
      document.getElementById('mainScreen').style.display = 'none';
      document.getElementById('authScreen').classList.add('active');
      const btn = document.getElementById('authSubmitBtn');
      if (btn) { btn.disabled = false; btn.textContent = isSignupMode ? "Sign Up" : "Login"; }
    }
  });

  function renderUserHeader() {
    if (!currentUserData) return;
    document.getElementById('userName').textContent = currentUserData.name || 'User';
    applyAvatarPhoto(document.getElementById('userAvatar'), currentUserData);
    document.getElementById('userLevelLabel').textContent = "ID Lv. " + (currentUserData.level || 1);
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
    document.getElementById('profileNameBig').textContent = currentUserData.name || 'User';
    document.getElementById('profileIdLevelBadge').textContent = "🆔 ID Lv. " + (currentUserData.level || 1);
    document.getElementById('profileVipLevelBadge').textContent = "👑 VIP " + (currentUserData.farmLevel || 1);
    document.getElementById('profileWalletValue').textContent = "🪙" + formatNum(currentUserData.coins || 0) + " 💎" + formatNum(currentUserData.gems || 0);
    document.getElementById('profileFamilyValue').textContent = currentFamilyId ? 'Joined' : 'None';
    document.getElementById('profileIdNumber').textContent = currentUserData.profileId || '—';
    document.getElementById('myReferralCode').textContent = currentUserData.profileId || '—';
  }

  function openProfile() {
    renderProfile();
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
  }

  function copyProfileId() {
    const id = document.getElementById('profileIdNumber').textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(id).then(() => toast('ID copied: ' + id));
  }

  function switchTab(tab) {
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

    updateFamilyBubble(tab);
    localStorage.setItem('lastTab', tab);
  }

  function getActiveTab() {
    if (document.getElementById('homePanel').classList.contains('active')) return 'hifami';
    if (document.getElementById('familyPanel').classList.contains('active')) return 'family';
    if (document.getElementById('momentsPanel').classList.contains('active')) return 'moments';
    if (document.getElementById('roomPanel').classList.contains('active')) return 'room';
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
    document.getElementById('coinsDisplay').textContent = formatNum(currentUserData.coins || 0);
    document.getElementById('gemsDisplay').textContent = formatNum(currentUserData.gems || 0);
    document.getElementById('loveDisplay').textContent = formatNum(currentUserData.love || 0);
    document.getElementById('homeFarmLevelTag').textContent = "🌾 Farm Level " + getFarmLevel();
    document.getElementById('rateLabel').textContent = "In 30 min: 🪙 " + formatNum(getProductionAmount());
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
    if (!currentUser.isGuest) {
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
    
    if (!currentUser.isGuest) {
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
      card.innerHTML = `<div class="rc-thumb">🏠</div><div class="rc-info"><div class="rc-name">${escapeHtml(r.name)}</div></div>`;
      card.onclick = () => enterRoom(id, r.name);
      listEl.appendChild(card);
    });
  }

  function createLiveRoom() {
    const name = document.getElementById('roomNameInput').value.trim();
    if (!name || !currentUser) return;
    const ref = db.ref('liveRooms').push();
    ref.set({ name: name, ownerUid: currentUser.uid, createdAt: Date.now() }).then(() => enterRoom(ref.key, name));
  }

  function enterRoom(id, name) {
    currentRoomId = id;
    document.getElementById('roomInsideTitle').textContent = name;
    document.getElementById('roomBrowseView').style.display = 'none';
    document.getElementById('roomInsideView').style.display = 'flex';
    listenToSeats(id);
    listenToRoomChat(id);
  }

  function leaveRoomToBrowse() {
    currentRoomId = null;
    document.getElementById('roomInsideView').style.display = 'none';
    document.getElementById('roomBrowseView').style.display = 'flex';
  }

  function listenToSeats(roomId) {
    db.ref('liveRooms/' + roomId + '/seats').on('value', (snap) => {
      const seats = snap.val() || {};
      const grid = document.getElementById('seatGrid');
      if (!grid) return;
      grid.innerHTML = '';
      for (let i = 0; i < 8; i++) {
        const s = seats[i];
        const cell = document.createElement('div');
        cell.className = 'seat-cell';
        if (s) {
          cell.innerHTML = `
            <div class="seat-vip-pill">VIP ${s.vip || 1}</div>
            <div class="seat-avatar-wrap frame-sparkle">
              <div class="seat-avatar">${escapeHtml((s.name || 'U').charAt(0).toUpperCase())}</div>
              <div class="seat-mic-badge ${s.muted ? 'muted' : ''}">${s.muted ? '🔇' : '🎙️'}</div>
            </div>
            <div class="seat-name">${escapeHtml(s.name)}</div>
          `;
          cell.onclick = () => openSeatProfile(s.uid, s.name);
        } else {
          cell.innerHTML = `<div class="seat-plus">+</div><div class="seat-name">${i + 1}</div>`;
          cell.onclick = () => sitOnSeat(i);
        }
        grid.appendChild(cell);
      }
    });
  }

  function sitOnSeat(index) {
    if (!currentUser || !cur
