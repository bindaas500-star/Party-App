/* ============================================================
   Party App — Live Features: wiring (gift-fx ko app se jorna)
   Ye file script.js KE BAAD load karo.

   Kya karta hai:
   - Jab koi gift bhejta hai (finishGiftSend), to gift ki price
     ke hisaab se full-screen animation chalta hai:
       🦁 Lion (5000), 🚀 Rocket (1000) → luxury (flash+shake)
       👑 Crown (500), 💎 Diamond (100) → premium (fly-in)
       baqi → chhoti animation
   - Room me doosron ko gift milne par bhi halki animation
     (activity feed se) — taake sab ko nazar aaye.
   ============================================================ */
(function () {
  'use strict';
  if (!window.GiftFX) { console.warn('[live-features] GiftFX load nahi hua'); return; }

  // Tier thresholds tumhare gift catalog se match:
  // Lion 5000 / Rocket 1000 → luxury, Crown 500 / Diamond 100 → premium
  GiftFX.setTiers(100, 1000);

  /* ---- 1. Sender side: gift bhejne par animation ---- */
  if (typeof finishGiftSend === 'function') {
    var _finishGiftSend = finishGiftSend;
    finishGiftSend = function (recipientNames) {
      try {
        var item = (typeof giftSelectedItem !== 'undefined') ? giftSelectedItem : null;
        var qty = (typeof giftQty !== 'undefined' && giftQty) || 1;
        var sender = (typeof currentUserData !== 'undefined' && currentUserData && currentUserData.name) || '';
        if (item) {
          GiftFX.play({
            id: item.name, emoji: item.emoji, name: item.name,
            price: (item.cost || 0) * qty, sender: sender, count: qty
          });
        }
      } catch (e) { console.warn('[live-features] giftfx hook:', e); }
      return _finishGiftSend.apply(this, arguments);
    };
  }

  /* ---- 2. Receiver side: room activity me gift nazar aaye ----
     Tumhare app me gift activity feed me aata hai. Agar room ke
     andar ho aur kisi aur ne gift bheja ho to chhoti animation.
     (Ye hook activity listener lagne ke baad kaam karega —
     neeche sample diya hai.) */
  window.LiveFeatures = window.LiveFeatures || {};
  window.LiveFeatures.onRoomGift = function (gift) {
    // gift = { emoji, name, price, sender }
    if (!gift || !gift.emoji) return;
    // Apna bheja hua gift dobara animate mat karo
    var me = (typeof currentUserData !== 'undefined' && currentUserData && currentUserData.name) || '';
    if (gift.sender === me) return;
    GiftFX.play({
      id: gift.name, emoji: gift.emoji, name: gift.name,
      price: gift.price || 0, sender: gift.sender, count: gift.count || 1
    });
  };

  console.log('[live-features] gift wiring ready ✅');
})();
