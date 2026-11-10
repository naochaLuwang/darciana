'use client';
import { useSyncExternalStore } from 'react';
const mobileQuery = '(max-width: 767px)';
function subscribe(callback: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(mobileQuery).matches,
    () => false,
  );
}
