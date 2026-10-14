import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lingoworld.app',
  appName: 'LingoWorld',
  webDir: 'out',
  backgroundColor: '#1b1446',
  ios: { contentInset: 'always' },
  android: { allowMixedContent: false },
};

export default config;
