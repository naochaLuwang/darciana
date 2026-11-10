'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminField, AdminCheck, AdminSelect, FormReady } from './form-controls';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

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
  const [position, setPosition] = useState(String(initial?.position ?? 10));
  const [visible, setVisible] = useState(initial?.visible ?? true);
  const [content, setContent] = useState(initial?.content ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const router = useRouter();
  return (
    <Card className="gap-0 py-0">
      <form
        className="admin-content-editor admin-form-card p-5 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          startTransition(async () => {
            try {
              const result = await saveContent({
                key,
                title,
                section,
                position: Number(position),
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
        <FormReady>
          <h2>{initial ? 'Edit page' : 'Add page'}</h2>
          <fieldset className="min-w-0 space-y-5" disabled={pending || !configured}>
            <AdminField label="Title">
              <Input
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
            </AdminField>
            <AdminField label="Link name">
              <Input
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
            </AdminField>
            <AdminField label="Section">
              <AdminSelect
                value={section}
                onValueChange={(value) => setSection(value as 'support' | 'legal')}
                options={[
                  { value: 'support', label: 'Support & info' },
                  { value: 'legal', label: 'Legal' },
                ]}
              />
            </AdminField>
            <AdminField label="Position">
              <Input
                type="number"
                min={0}
                max={9999}
                value={position}
                required
                onChange={(event) => setPosition(event.target.value)}
              />
            </AdminField>
            <AdminField label="Page content">
              <Textarea
                value={content}
                maxLength={50000}
                rows={14}
                required={visible}
                onChange={(event) => setContent(event.target.value)}
              />
            </AdminField>
            <AdminCheck
              checked={visible}
              onCheckedChange={(checked) => setVisible(checked === true)}
              label={<>Show in More</>}
            />
            <p className="admin-help">
              These are public information pages. Saving updates the customer app.
            </p>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <Button disabled={pending || !configured}>{pending ? 'Saving…' : 'Save page'}</Button>
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
        </FormReady>
      </form>
    </Card>
  );
}
