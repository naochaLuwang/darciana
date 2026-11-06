import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

// Session tokens use Android KeyStore-backed encryption. Browser storage is
// used only by the local development/Playwright preview, never as a native fallback.
export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) return localStorage.getItem(key);
    const value = await SecureStorage.get(key);
    return typeof value === 'string' ? value : null;
  },
  async setItem(key: string, value: string) {
    if (!Capacitor.isNativePlatform()) {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStorage.set(key, value);
  },
  async removeItem(key: string) {
    if (!Capacitor.isNativePlatform()) {
      localStorage.removeItem(key);
      return;
    }
    await SecureStorage.remove(key);
  },
};
