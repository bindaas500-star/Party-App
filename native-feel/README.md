# Party App — Native Feel Pack (instal karne ka tareeqa)

Tumhare existing code me KOI tabdeeli nahi — sirf 2 nayi files add hoti hain.
Sab kuch local me tayyar hai; GitHub par push Imran ki permission se hoga.

## Step 1: 2 lines index.html me add karo

`</head>` se pehle (styles.css wali line ke baad):
```html
<link rel="stylesheet" href="native-feel.css">
```

`</body>` se pehle (sab se aakhir me):
```html
<script src="native-feel.js"></script>
```

Bas. Baqi sab automatic hai.

## Step 2: Ye files repo ki root me rakho

- `native-feel.css` — screen transitions, ripple, no browser-isms
- `native-feel.js` — tab direction, ripple effect, double-tap zoom band
- `sw.js`, `offline.html` — pehle wale polish pack se (agar abhi tak push nahi hue)

## Is se kya badlega (feel)

| Pehle (webpage jaisa)              | Ab (app jaisa)                          |
|-----------------------------------|-----------------------------------------|
| Tab dabao → screen foran kat-ta  | Slide + fade animation ke saath badle  |
| Tab direction ka pata nahi chalta | Aage/peeche swipe jaisa slide          |
| Button dabao → kuch mehsoos nahi | Ripple lehar + halka press-down        |
| Text select ho jata, page bounce  | Sab band — bilkul native jaisa         |
| Overlays beech me pop hote       | Neeche se slide (bottom-sheet style)   |

## Step 3: Asli Android shell (Capacitor) — jab chaho

Ye step tumhare computer par hoga (mere paas Android SDK nahi):

```bash
npm install @capacitor/core @capacitor/cli
npx cap init        # capacitor.config.ts already tayyar hai
npx cap add android
npx cap sync
npx cap open android   # Android Studio khulega → Build → .aab banao
```

Phir `.aab` file Play Console ($25 one-time account) par upload karo.

**Capacitor se kya milega:** asli native splash screen, status bar ka rang
app jaisa, koi browser address-bar nahi, aur baad me push notifications
bhi lag sakte hain.

## Files ki list

```
native-feel.css        — visual transitions + touch feedback
native-feel.js         — tab direction + ripple + zoom fix
capacitor.config.ts    — Android shell config (splash #1a1030, dark status bar)
```

## Note

- `prefers-reduced-motion` ka khayal rakha gaya hai (kamzor phones par halki animation)
- Firebase/backend calls par koi asar nahi — sirf UI layer hai
- Agar kuch pasand na aaye to 2 lines hata do, app waisa ka waisa
