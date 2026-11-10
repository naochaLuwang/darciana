import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Bell } from 'lucide-react';
import { useSession } from './session';
import { disablePush, enablePush, getPushPreferences } from './push';

export function PushSettings() {
  const { user } = useSession();
  const [enabled, setEnabled] = useState(false);
  const [announcements, setAnnouncements] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let disposed = false;
    const update = () => {
      void getPushPreferences()
        .then((value) => {
          if (!disposed) {
            setEnabled(value.enabled);
            setAnnouncements(value.announcements);
          }
        })
        .catch(() => {});
    };
    update();
    window.addEventListener('daciana:push-changed', update);
    return () => {
      disposed = true;
      window.removeEventListener('daciana:push-changed', update);
    };
  }, [user?.id]);
  if (Capacitor.getPlatform() !== 'android') return null;
  async function change(next: boolean, offers: boolean) {
    setPending(true);
    setError('');
    setMessage('');
    try {
      if (next) await enablePush(offers);
      else await disablePush();
      setEnabled(next);
      setAnnouncements(offers);
      setMessage(next ? 'Notifications enabled.' : 'Notifications turned off.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="push-settings" aria-labelledby="push-settings-title">
      <div className="push-settings-heading">
        <Bell size={19} aria-hidden="true" />
        <h3 id="push-settings-title">Notifications</h3>
      </div>
      <>
        <label className="push-setting-row">
          <span>
            <strong>Push notifications</strong>
            <small>
              {user ? 'Order updates on this device' : 'Allow notifications on this device'}
            </small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            onChange={(event) => {
              void change(event.target.checked, announcements);
            }}
            disabled={pending}
          />
        </label>
        <label className="push-setting-row">
          <span>
            <strong>Store announcements</strong>
            <small>Offers, new arrivals and news</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={enabled && announcements}
            onChange={(event) => {
              void change(true, event.target.checked);
            }}
            disabled={pending || !enabled}
          />
        </label>
      </>
      {pending ? (
        <p className="push-setting-feedback" role="status">
          Updating…
        </p>
      ) : null}
      {message && !pending ? (
        <p className="push-setting-feedback" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
