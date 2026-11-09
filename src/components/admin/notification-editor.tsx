'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Send } from 'lucide-react';
import { sendAnnouncement } from '@/app/admin/notifications/actions';

export function NotificationEditor({
  configured,
  devices,
}: {
  configured: boolean;
  devices: number;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [path, setPath] = useState('/shop');
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const requestId = useRef('');
  const router = useRouter();
  function changed() {
    requestId.current = '';
    setConfirm(false);
    setMessage('');
    setError('');
  }
  return (
    <div className="admin-push-layout">
      <section className="admin-panel admin-push-compose">
        <h2>New announcement</h2>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (!confirm || pending) return;
            requestId.current ||= crypto.randomUUID();
            setError('');
            setMessage('');
            startTransition(async () => {
              try {
                const result = await sendAnnouncement({
                  requestId: requestId.current,
                  title,
                  body,
                  path,
                  confirm,
                });
                if (result.error) setError(result.error);
                else {
                  setMessage(result.success ?? 'Sent.');
                  setConfirm(false);
                  router.refresh();
                }
              } catch {
                setError('Sending could not be confirmed. Check history before trying again.');
              }
            });
          }}
        >
          <label>
            Title
            <input
              value={title}
              onChange={(event) => {
                changed();
                setTitle(event.target.value);
              }}
              maxLength={80}
              required
              disabled={pending}
              placeholder="New arrivals are here"
            />
          </label>
          <label>
            Message
            <textarea
              value={body}
              onChange={(event) => {
                changed();
                setBody(event.target.value);
              }}
              maxLength={240}
              rows={3}
              required
              disabled={pending}
              placeholder="Take a look at what’s new in store."
            />
          </label>
          <label>
            Open when tapped
            <input
              value={path}
              onChange={(event) => {
                changed();
                setPath(event.target.value);
              }}
              required
              disabled={pending}
              placeholder="/shop or /product/product-slug"
            />
          </label>
          <p className="admin-help">
            Send to {devices} device{devices === 1 ? '' : 's'} with store announcements enabled.
          </p>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(event) => setConfirm(event.target.checked)}
              disabled={pending}
              required
            />
            <span>Send this announcement to opted-in customers.</span>
          </label>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="form-success" role="status">
              {message}
            </p>
          ) : null}
          <button
            className="button button-dark"
            disabled={pending || !configured || !confirm || devices === 0}
          >
            <Send size={17} />
            {pending ? 'Sending…' : 'Send notification'}
          </button>
        </form>
      </section>
      <aside className="admin-push-preview" aria-label="Notification preview">
        <span className="admin-help">Preview</span>
        <div className="admin-push-preview-card">
          <Bell size={20} aria-hidden="true" />
          <div>
            <span>Daciana · now</span>
            <strong>{title || 'Notification title'}</strong>
            <p>{body || 'Your message will appear here.'}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
