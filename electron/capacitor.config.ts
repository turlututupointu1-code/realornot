import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.philippe.realornot',
  appName: 'RealOrNot',
  webDir: 'dist',
  server: {
    androidScheme: 'http'
  }
};

export default config;
