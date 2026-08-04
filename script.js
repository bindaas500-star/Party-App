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
  let familyListListenerAttached = false;

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
    if (!email) { alert("Enter your email first."); return; }
    auth.sendPasswordResetEmail(email).then(() => toast("✅ Reset link sent!"));
  }

  function handleAuth() {
    const email = document.getElementById('emailInput').value.trim();
    const pass = document.getElementById('passInput').value;
    const name = document.getElementById('nameInput').value.trim();
    const errorEl = document.getElementById('authError');
    errorEl.textContent = "";

    if (!email || !pass) { errorEl.textContent = "Please fill email and password."; return; }
    if (isSignupMode && !name) { errorEl.textContent = "Please enter your name."; return; }

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
        }).catch((err) => { errorEl.textContent = err.message; });
    } else {
      auth.signInWithEmailAndPassword(email, pass).catch((err) => { errorEl.textContent = err.message; });
    }
  }

  function handleLogout() { auth.signOut(); }

  let initialRestoreDone = false;

  // Splash Screen Fallback Auto-Hide
  function hideSplashScreen() {
    const splash = document.getElementById('splashScreen');
    if (splash) splash.style.display = 'none';
  }
  setTimeout(hideSplashScreen, 1500);

  auth.onAuthStateChanged((user) => {
    hideSplashScreen();

    if (user) {
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
    } else {
      currentUser = null;
      document.getElementById('mainScreen').style.display = 'none';
      document.getElementById('authScreen').classList.add('active');
    }
  });

  function renderUserHeader() {
    document.getElementById('userName').textContent = currentUserData.name;
    applyAvatarPhoto(document.getElementById('userAvatar'), currentUserData);
    document.getElementById('userLevelLabel').textContent = "ID Lv. " + (currentUserData.level || 1);
    renderProfile();
  }

  function applyAvatarPhoto(el, userData) {
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
    document.getElementById('profileNameBig').textContent = currentUserData.name;
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
    db.ref('users/' + currentUser.uid).update({
      coins: (currentUserData.coins || 0) + gained,
      lastHarvestAt: Date.now()
    }).then(() => toast('Collected 🪙 ' + formatNum(gained)));
  }

  function upgradeFarm() {
    if (!currentUser || !currentUserData) return;
    const cost = getFarmLevel() * UPGRADE_INCREMENT;
    if ((currentUserData.gems || 0) < cost) { toast('Not enough Gems!', 'error'); return; }
    db.ref('users/' + currentUser.uid).update({
      gems: currentUserData.gems - cost,
      farmLevel: getFarmLevel() + 1
    }).then(() => toast('Farm Upgraded! 👑'));
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
    if (!currentUser || !currentRoomId) return;
    db.ref('liveRooms/' + currentRoomId + '/seats/' + index).set({
      uid: currentUser.uid,
      name: currentUserData.name,
      vip: currentUserData.farmLevel || 1
    });
  }

  function openRoomDetailsModal() {
    if (!currentRoomId) return;
    document.getElementById('roomDetailsModal').classList.add('show');
    db.ref('liveRooms/' + currentRoomId).once('value').then((snap) => {
      const r = snap.val() || {};
      document.getElementById('rdName').textContent = r.name || 'Room';
      document.getElementById('rdNumericId').textContent = 'ID: ' + (r.roomNumericId || currentRoomId);
      document.getElementById('rdNoticeBox').textContent = '📢 ' + (r.notice || 'Welcome to our room!');
    });
  }
  function closeRoomDetailsModal() { document.getElementById('roomDetailsModal').classList.remove('show'); }

  function listenToFamilyList() {
    db.ref('families').on('value', (snap) => {
      const data = snap.val();
      const listEl = document.getElementById('familyList');
      if (!listEl) return;
      if (!data) { listEl.innerHTML = '<div class="loading">No families yet.</div>'; return; }
      listEl.innerHTML = '';
      Object.entries(data).forEach(([id, fam]) => {
        const item = document.createElement('div');
        item.className = 'family-item';
        item.innerHTML = `
          <div class="f-avatar">${escapeHtml(fam.name.charAt(0).toUpperCase())}</div>
          <div class="f-info"><div class="f-name">${escapeHtml(fam.name)}</div></div>
          <button class="join-btn" onclick="joinFamily('${id}')">Join</button>
        `;
        listEl.appendChild(item);
      });
    });
  }

  function createFamily() {
    const name = document.getElementById('familyNameInput').value.trim();
    if (!name || !currentUser) return;
    const ref = db.ref('families').push();
    ref.set({ name: name, ownerUid: currentUser.uid, createdAt: Date.now() }).then(() => {
      db.ref('users/' + currentUser.uid).update({ familyId: ref.key });
    });
  }

  function joinFamily(famId) {
    db.ref('users/' + currentUser.uid).update({ familyId: famId });
  }

  function showInsideFamily(famId) {
    document.getElementById('familyBrowseView').style.display = 'none';
    document.getElementById('familyInsideView').style.display = 'flex';
    db.ref('families/' + famId).once('value').then((snap) => {
      const f = snap.val() || {};
      document.getElementById('insideFamName').textContent = f.name;
    });
    listenToFamilySeats(famId);
    listenToFamilyChat(famId);
  }

  function showBrowseFamilies() {
    document.getElementById('familyBrowseView').style.display = 'block';
    document.getElementById('familyInsideView').style.display = 'none';
  }

  function listenToFamilySeats(famId) {
    db.ref('families/' + famId + '/seats').on('value', (snap) => {
      const seats = snap.val() || {};
      const grid = document.getElementById('familySeatGrid');
      if (!grid) return;
      grid.innerHTML = '';
      for (let i = 0; i < 8; i++) {
        const s = seats[i];
        const cell = document.createElement('div');
        cell.className = 'seat-cell';
        if (s) {
          cell.innerHTML = `
            <div class="seat-avatar-wrap">
              <div class="seat-avatar">${escapeHtml((s.name || 'U').charAt(0).toUpperCase())}</div>
            </div>
            <div class="seat-name">${escapeHtml(s.name)}</div>
          `;
          cell.onclick = () => openSeatProfile(s.uid, s.name);
        } else {
          cell.innerHTML = `<div class="seat-plus">+</div><div class="seat-name">${i + 1}</div>`;
        }
        grid.appendChild(cell);
      }
    });
  }

  function openFamilyDetailsModal() {
    if (!currentFamilyId) return;
    document.getElementById('familyDetailsModal').classList.add('show');
    db.ref('families/' + currentFamilyId).once('value').then((snap) => {
      const f = snap.val() || {};
      document.getElementById('fdName').textContent = f.name || 'Family';
      document.getElementById('fdNoticeBox').textContent = '📢 ' + (f.notice || 'Welcome!');
    });
  }
  function closeFamilyDetailsModal() { document.getElementById('familyDetailsModal').classList.remove('show'); }

  let targetUserUid = null;
  let targetUserName = null;

  function openSeatProfile(uid, name) {
    targetUserUid = uid;
    targetUserName = name;
    document.getElementById('seatProfName').textContent = name;
    document.getElementById('seatProfIdNumber').textContent = '—';
    document.getElementById('seatProfAvatar').textContent = name.charAt(0).toUpperCase();
    
    db.ref('users/' + uid).once('value').then((snap) => {
      const u = snap.val();
      if (u) {
        document.getElementById('seatProfIdNumber').textContent = u.profileId || '—';
        document.getElementById('seatProfIdBadge').textContent = '🆔 ID Lv. ' + (u.level || 1);
        document.getElementById('seatProfVipBadge').textContent = '👑 VIP ' + (u.farmLevel || 1);
        applyAvatarPhoto(document.getElementById('seatProfAvatar'), u);
      }
    });

    const isHost = currentRoomId && currentUser;
    document.getElementById('seatProfOwnerControls').style.display = isHost ? 'block' : 'none';
    document.getElementById('seatProfileOverlay').classList.add('show');
  }

  function closeSeatProfile() { document.getElementById('seatProfileOverlay').classList.remove('show'); }

  function copySeatProfId() {
    const id = document.getElementById('seatProfIdNumber').textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(id).then(() => toast('Copied ID: ' + id));
  }

  function shareProfileUser() { toast('Sharing profile of ' + targetUserName); }
  function reportSeatProfileUser() { toast('Report submitted for review.'); }
  function blockSeatProfileUser() { toast(targetUserName + ' blocked.'); closeSeatProfile(); }
  function giftFromSeatProfile() { closeSeatProfile(); if (currentRoomId) openGiftPicker(targetUserUid, targetUserName); }
  function chatFromSeatProfile() { closeSeatProfile(); toast('Private chat opening...'); }
  function toggleFollowSeatUser() { toast('Followed ' + targetUserName); }
  function addFriendFromSeatProfile() { toast('Friend request sent to ' + targetUserName); }

  function toggleMuteSeatUser() { toast('Muted/Unmuted ' + targetUserName); }
  function toggleModeratorSeatUser() { toast('Admin status updated for ' + targetUserName); }
  function kickSeatUser() { toast(targetUserName + ' kicked from room'); closeSeatProfile(); }

  function listenToChat() {
    db.ref('rooms/global/messages').limitToLast(40).on('value', (snap) => {
      renderChatMessages('chatArea', snap.val());
    });
  }
  function listenToRoomChat(roomId) {
    db.ref('liveRooms/' + roomId + '/messages').limitToLast(40).on('value', (snap) => {
      renderChatMessages('roomChatArea', snap.val());
    });
  }
  function listenToFamilyChat(famId) {
    db.ref('families/' + famId + '/messages').limitToLast(40).on('value', (snap) => {
      renderChatMessages('familyChatArea', snap.val());
    });
  }

  function renderChatMessages(elementId, messages) {
    const area = document.getElementById(elementId);
    if (!area) return;
    area.innerHTML = '';
    if (!messages) { area.innerHTML = '<div class="loading">No messages yet.</div>'; return; }
    Object.values(messages).forEach((msg) => {
      const isMe = currentUser && msg.uid === currentUser.uid;
      const div = document.createElement('div');
      div.className = 'msg ' + (isMe ? 'me' : 'other');
      div.innerHTML = (isMe ? '' : `<div class="sender">${escapeHtml(msg.name)}</div>`) + escapeHtml(msg.text);
      area.appendChild(div);
    });
    area.scrollTop = area.scrollHeight;
  }

  function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text || !currentUser) return;
    db.ref('rooms/global/messages').push({ uid: currentUser.uid, name: currentUserData.name, text: text, timestamp: Date.now() });
    input.value = '';
  }

  function sendRoomMessage() {
    const input = document.getElementById('roomMsgInput');
    const text = input.value.trim();
    if (!text || !currentUser || !currentRoomId) return;
    db.ref('liveRooms/' + currentRoomId + '/messages').push({ uid: currentUser.uid, name: currentUserData.name, text: text, timestamp: Date.now() });
    input.value = '';
  }

  function sendFamilyMessage() {
    const input = document.getElementById('famMsgInput');
    const text = input.value.trim();
    if (!text || !currentUser || !currentFamilyId) return;
    db.ref('families/' + currentFamilyId + '/messages').push({ uid: currentUser.uid, name: currentUserData.name, text: text, timestamp: Date.now() });
    input.value = '';
  }

  function openQuickGiftPicker() { openListOverlay('quickgift'); }
  function openGiftLog() { toast('Gift log feature active'); }
  function openGiftPicker(uid, name) { document.getElementById('giftOverlay').classList.add('show'); }
  function closeGiftPicker() { document.getElementById('giftOverlay').classList.remove('show'); }

  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.textContent = msg;
    const container = document.getElementById('toastContainer');
    if (container) container.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  function formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return String(n);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function openRankView() { document.getElementById('rankOverlay').classList.add('show'); }
  function closeRankView() { document.getElementById('rankOverlay').classList.remove('show'); }
  function openVipBenefits() { document.getElementById('vipBenefitsOverlay').classList.add('show'); }
  function closeVipBenefits() { document.getElementById('vipBenefitsOverlay').classList.remove('show'); }
  function openListOverlay(m) { document.getElementById('listOverlay').classList.add('show'); }
  function closeListOverlay() { document.getElementById('listOverlay').classList.remove('show'); }
  function openNewPostOverlay() { document.getElementById('newPostOverlay').classList.add('show'); }
  function closeNewPostOverlay() { document.getElementById('newPostOverlay').classList.remove('show'); }
  function listenToMoments() {}
  function renderLevelCard() {}
  function filterFamilyList() {}
  function filterRoomList() {}
  function followCurrentRoom() { toast('Room followed!'); }
  function shareCurrentRoom() { toast('Room link copied!'); }
  function openRoomOwnerMenu() { document.getElementById('roomOwnerOverlay').classList.add('show'); }
  function closeRoomOwnerMenu() { document.getElementById('roomOwnerOverlay').classList.remove('show'); }
  function openFamilyOwnerMenu() { document.getElementById('familyOwnerOverlay').classList.add('show'); }
  function closeFamilyOwnerMenu() { document.getElementById('familyOwnerOverlay').classList.remove('show'); }
  function openTicTacToe() { document.getElementById('tttOverlay').classList.add('show'); }
  function closeTicTacToe() { document.getElementById('tttOverlay').classList.remove('show'); }
