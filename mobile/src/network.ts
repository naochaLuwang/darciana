import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

let connected = true;
const listeners = new Set<() => void>();
export function updateConnection(value: boolean) {
  connected = value;
  onlineManager.setOnline(isDeviceOnline());
  listeners.forEach((listener) => listener());
}
export function isDeviceOnline() {
  return connected && navigator.onLine;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

export function useDeviceOnline() {
  return useSyncExternalStore(subscribe, isDeviceOnline);
}
