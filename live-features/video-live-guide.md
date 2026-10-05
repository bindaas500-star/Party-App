# Video Live — Integration Guide (Party App)

Tumhare rooms abhi **voice-only** hain. Video live ke liye ek real-time
video service chahiye — ye browsers ka apna WebRTC se bhi ho sakta hai,
lekin 8-9 seats wale room ke liye **paid SFU service** behtar hai
(Bigo/Mico bhi yehi istemal karte hain).

## Option A: Agora (recommended — live apps ka standard)

- Website: agora.io → free account banao
- Free tier: har mahine 10,000 minutes free (testing ke liye kafi)
- Uske baad ~$0.99/1000 minutes (video)

### Steps (tumhare side se — 15 minute)

1. agora.io par account → naya project → **App ID** copy karo
2. Project me **App Certificate** enable karo → token server ke liye
3. index.html me ye add karo (script.js se pehle):
   ```html
   <script src="https://download.agora.io/sdk/release/AgoraRTC_N-4.x.js"></script>
   ```
4. Neeche di hui `video-live.js` file banao (template tayyar hai),
   us me apna APP_ID dalo.

### Room se jorna

- Har `liveRooms/{id}` ek Agora **channel** banta hai (channel name = roomId)
- Seat par baithne = video publish karna; dekhne wale = subscribe
- Voice-only users purane tareeqe se rehte hain — dono mix ho sakte hain

## Option B: 100ms / Twilio (alternatives)

- 100ms.live — free tier 10,000 minutes, dashboard asaan
- Twilio Video — mehnga, lekin enterprise-grade

## Cost ka andaza (agar app chal jaye)

- 10 users × 2 ghante roz = ~36,000 min/month ≈ $25-35/month
- Ye cost **gems/VIP revenue** se nikalni chahiye — is liye pehle
  voice PK + nobility se earning shuru karo, phir video lagao.

## `video-live.js` — template

```js
// Agora App ID yahan dalo (agora.io console se)
const AGORA_APP_ID = 'TUMHARA_APP_ID_YAHAN';

const VideoLive = {
  client: null,
  async joinRoom(roomId, seatIndex) {
    this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    // NOTE: production me token server se lo, App ID seedha mat rakho
    await this.client.join(AGORA_APP_ID, roomId, null /* token */, seatIndex);
    const videoTrack = await AgoraRTC.createCameraVideoTrack();
    await this.client.publish(videoTrack);
    videoTrack.play('seat-video-' + seatIndex); // seat me <div id="seat-video-N">
  },
  async leaveRoom() {
    if (this.client) { await this.client.leave(); this.client = null; }
  }
};
// Remote users:
/// client.on('user-published', async (user, mediaType) => {
///   await client.subscribe(user, mediaType);
///   if (mediaType === 'video') user.videoTrack.play('seat-video-' + seatOf(user.uid));
/// });
```

## Checklist (jab ready ho)

- [ ] Agora account + App ID
- [ ] Seat UI me video containers (`seat-video-0..8`)
- [ ] Token server (chhota Cloud Function — App ID expose na ho)
- [ ] Beauty filter: Agora ka FaceUnity extension (paid) ya CSS filters (free, halka)
- [ ] Bandwidth: video seats 4-6 tak rakho (zyada seats = zyada cost)

**Mashwara:** Pehle PK Battle + Nobility live karo. Jab daily active users
aur gem sales aane lagen, tab video lagana — warna cost pehle, earning baad me.
