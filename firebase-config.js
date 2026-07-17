// 1. Go to https://console.firebase.google.com
// 2. Create a free project
// 3. Add a "Web App" inside it (</> icon)
// 4. Copy the config object it gives you and paste the values below
// 5. In Firebase console: enable "Authentication" > Email/Password
// 6. In Firebase console: create a "Firestore Database" (start in test mode for now)

const firebaseConfig = {
  apiKey: "AIzaSyDCKlIBnv1lmTU5-w4Zjwor_Oogop05q98",
  authDomain: "taskflow-earn.firebaseapp.com",
  projectId: "taskflow-earn",
  storageBucket: "taskflow-earn.firebasestorage.app",
  messagingSenderId: "931479054594",
  appId: "1:931479054594:web:b77fad81ece4cc8dc4ba1b"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ⭐ ADMIN SETUP:
// After you sign up with your own email in the app once,
// go to Firestore Database > "users" collection > find your user document
// and manually change the field  role  from "user"  to  "admin"
// That will unlock the Admin tab for your account only.
