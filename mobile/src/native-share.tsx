import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Share2, ChevronRight } from 'lucide-react';
import { APP_ID, APP_NAME } from '@/lib/brand';

export function ShareApp() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function share() {
    setPending(true);
    setMessage('');
    const url =
      import.meta.env.VITE_PUBLIC_STORE_URL ||
      `https://play.google.com/store/apps/details?id=${APP_ID}`;
    try {
      if (Capacitor.isNativePlatform())
        await Share.share({
          title: APP_NAME,
          text: `Shop cosmetics and stationery with ${APP_NAME}.`,
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        setMessage('Link copied');
      }
    } catch {
      /* Closing the share sheet does not need an error message. */
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <button type="button" className="more-link" disabled={pending} onClick={share}>
        <span className="more-link-icon" aria-hidden="true">
          <Share2 size={18} strokeWidth={1.6} />
        </span>
        <span className="more-link-label">Share app</span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
      {message ? (
        <p className="more-share-message" role="status">
          {message}
        </p>
      ) : null}
    </>
  );
}
