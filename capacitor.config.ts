import type { CapacitorConfig } from '@capacitor/cli';
import { APP_ID, APP_NAME } from './src/lib/brand';

const config: CapacitorConfig = {
  appId: APP_ID,
  appName: APP_NAME,
  webDir: 'mobile/dist',
  backgroundColor: '#fbf9fd',
  server: { androidScheme: 'https', hostname: 'localhost', cleartext: false },
  android: { allowMixedContent: false },
  plugins: {
    SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'cover', style: 'DARK' },
    Keyboard: { resizeOnFullScreen: true },
    SplashScreen: { launchAutoHide: false, backgroundColor: '#fbf9fd', showSpinner: false },
  },
};

export default config;
