'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveContent } from '@/app/admin/content/actions';
import { contentSlug, type ContentPage } from '@/lib/store-content';
export function ContentEditor({
  initial,
  configured,
}: {
  initial?: ContentPage;
  configured: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [key, setKey] = useState(initial?.key ?? '');
  const [customKey, setCustomKey] = useState(false);
  const [section, setSection] = useState(initial?.section ?? 'support');
  const [position, setPosition] = useState(initial?.position ?? 10);
  const [visible, setVisible] = useState(initial?.visible ?? true);
  const [content, setContent] = useState(initial?.content ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const router = useRouter();
  return (
    <form
      className="admin-panel admin-form-section admin-content-editor"
      onSubmit={(event) => {
        event.preventDefault();
        setError('');
        startTransition(async () => {
          try {
            const result = await saveContent({
              key,
              title,
              section,
              position,
              visible,
              content,
              expected_updated_at: initial?.updated_at ?? null,
              expected_meta_updated_at: initial?.meta_updated_at ?? null,
            });
            if (result.error) setError(result.error);
            else {
              router.push(`/admin/content?edit=${result.key}&saved=1`);
              router.refresh();
            }
          } catch {
            setError('Content could not be saved. Try again.');
          }
        });
      }}
    >
      <h2>{initial ? 'Edit page' : 'Add page'}</h2>
      <fieldset className="address-fieldset admin-content-fields" disabled={pending || !configured}>
        <label>
          Title
          <input
            value={title}
            maxLength={100}
            required
            onChange={(event) => {
              setTitle(event.target.value);
              if (!initial && !customKey)
                setKey(
                  event.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '_')
                    .replace(/^_|_$/g, ''),
                );
            }}
          />
        </label>
        <label>
          Link name
          <input
            value={contentSlug(key)}
            maxLength={80}
            pattern="[a-z][a-z0-9-]+"
            required
            readOnly={!!initial}
            onChange={(event) => {
              setCustomKey(true);
              setKey(event.target.value.replaceAll('-', '_'));
            }}
          />
        </label>
        <label>
          Section
          <select
            value={section}
            onChange={(event) => setSection(event.target.value as 'support' | 'legal')}
          >
            <option value="support">Support & info</option>
            <option value="legal">Legal</option>
          </select>
        </label>
        <label>
          Position
          <input
            type="number"
            min={0}
            max={9999}
            value={position}
            required
            onChange={(event) => setPosition(Number(event.target.value))}
          />
        </label>
        <label>
          Page content
          <textarea
            value={content}
            maxLength={50000}
            rows={14}
            required={visible}
            onChange={(event) => setContent(event.target.value)}
          />
        </label>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={visible}
            onChange={(event) => setVisible(event.target.checked)}
          />{' '}
          Show in More
        </label>
        <p className="admin-help">
          These are public information pages. Saving updates the customer app.
        </p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="button button-dark" disabled={pending || !configured}>
          {pending ? 'Saving…' : 'Save page'}
        </button>
      </fieldset>
      {initial?.content && initial.visible ? (
        <Link
          href={`/more/${contentSlug(initial.key)}`}
          className="text-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          View page ↗
        </Link>
      ) : null}
    </form>
  );
}
