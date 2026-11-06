'use client';

import { useState } from 'react';
import { ChevronRight, Share2 } from 'lucide-react';

export function ShareApp() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');

  async function share() {
    const url = new URL('/', window.location.href).href;
    setPending(true);
    setMessage('');
    setLink('');
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Daciana', url });
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        setMessage('Link copied');
      } catch {
        setLink(url);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="more-link" onClick={share} disabled={pending}>
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
      {link ? (
        <label className="more-share-fallback">
          Copy this link
          <input
            aria-label="Store link"
            value={link}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      ) : null}
    </>
  );
}
