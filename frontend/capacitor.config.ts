import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aalsitrader.app',
  appName: 'AalsiTrader',
  webDir: 'dist',
  server: {
    // During development, point to the live web app so you get hot reload
    // Comment this out for production builds
    // url: 'https://aalsitrader.com',
    // cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#18181b',   // matches app dark background
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',                 // light text on dark status bar
      backgroundColor: '#18181b',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // set true only during dev
  },
};

export default config;
