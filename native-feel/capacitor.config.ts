import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // NOTE: appId tumhare Play Console listing se match hona chahiye.
  // Pehli dafa publish karte waqt jo package name rakho ge, wahi hamesha rahega.
  appId: 'com.partyapp.social',
  appName: 'Party App',
  webDir: '.',
  backgroundColor: '#1a1030',

  android: {
    // Splash screen jab tak web content load ho
    backgroundColor: '#1a1030',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#1a1030',
      showSpinner: false,
    },
    StatusBar: {
      // Status bar app ke theme jaisa — browser wali neeli patti khatam
      backgroundColor: '#1a1030',
      style: 'DARK',
    },
  },
};

export default config;
