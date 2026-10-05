# Party App — Live Features Pack 🎉

Bigo Live / Mico / Tango jaise apps wali features — tumhare existing
code me **koi tabdeeli nahi**, sirf nayi files add hoti hain.

## Features

| File | Kya hai |
|------|---------|
| `gift-fx.js` + `gift-fx.css` | Mehnge gifts par **full-screen animation** — 🦁 Lion/🚀 Rocket par flash+shake, 👑 Crown/💎 Diamond par fly-in + particles |
| `wiring.js` | GiftFX ko tumhare gift system se jorta hai (finishGiftSend hook) |
| `treasure-box.js` + `.css` | Room me **timed reward box** 🎁 — tap karo, coins jeeto |
| `mini-games.js` + `.css` | **Dice roll** 🎲 aur **Lucky wheel** 🎡 room ke andar |
| `pk-battle.js` + `.css` | **PK Battle** ⚔️ — do rooms ka 5-min muqabla, gifts = points, live score bars, winner celebration |
| `nobility.js` + `.css` | **Nobility titles** 👑 — Knight se Emperor tak (7 paid titles), full-screen entry effects |
| `video-live-guide.md` | Video live ka rasta (Agora — tumhare account se, paid) |

## Install (2 minute)

`index.html` me `</head>` se pehle, styles.css wali line ke baad:

```html
<link rel="stylesheet" href="live-features/gift-fx.css">
<link rel="stylesheet" href="live-features/treasure-box.css">
<link rel="stylesheet" href="live-features/mini-games.css">
<link rel="stylesheet" href="live-features/pk-battle.css">
<link rel="stylesheet" href="live-features/nobility.css">
```

`</body>` se pehle, script.js ke baad:

```html
<script src="live-features/gift-fx.js"></script>
<script src="live-features/wiring.js"></script>
<script src="live-features/treasure-box.js"></script>
<script src="live-features/mini-games.js"></script>
<script src="live-features/pk-battle.js"></script>
<script src="live-features/nobility.js"></script>
```

## Buttons kahan lagayein (room ke andar)

```html
<!-- Room header ya menu me -->
<button onclick="PKBattle.openChallenge()">⚔️ PK</button>
<button onclick="TreasureBox.start({totalCoins:1000, perUser:50})">🎁 Treasure</button>
<button onclick="MiniGames.open('dice')">🎮 Games</button>
<button onclick="Nobility.openStore()">👑 Nobility</button>
```

Aur room enter/exit par (script.js me `enterRoom`/`leaveRoom` ke andar):

```js
PKBattle.onEnterRoom();   // enterRoom me
Nobility.onEnterRoom();   // enterRoom me (entry effect)
PKBattle.onExitRoom();    // leaveRoom me
```

## Firebase paths (nayi)

- `liveRooms/{id}/pkChallenge` — incoming PK challenge (auto-delete)
- `liveRooms/{id}/pk` — active battle: `{ oppRoomId, oppRoomName, status, endsAt, myScore, winner }`
- `users/{uid}/nobility` — `{ titleId, expiresAt }`

## Economy

- Gifts: tumhara existing system (`love` coins, `GIFTS` catalog) — koi change nahi
- GiftFX tiers tumhare catalog se match: Lion 5000/Rocket 1000 → luxury, Crown 500/Diamond 100 → premium
- Nobility: gems me price (adapter: `Nobility.spendGems`) — 500 se 80,000 tak
- Treasure box / wheel: coins dete/lete hain (adapter: `addCoinsToUser`/`spendCoinsOfUser` — agar ye functions nahi hain to demo mode me console me log hoga)

## Note

- Sab features **adapter pattern** par hain — har file ke upar ADAPTER section hai jahan tumhare app ke functions lagte hain. Bina Firebase wiring ke demo mode me chalte hain (koi crash nahi).
- Koi feature pasand na aaye to uski 2 lines hata do — baqi sab chalta rahega.
- **GitHub push Imran ki permission se hoga** — abhi sab local hai.
