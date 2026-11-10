'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminField, AdminSelect, FormReady } from './form-controls';
import { Card } from '@/components/ui/card';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { saveCategory } from '@/app/admin/actions';
import { slugify } from '@/lib/admin-validation';
import { normalizeCategorySlug } from '@/lib/category-slug';
import { categoryTreeIds, type Category } from '@/lib/commerce';
import { ImageField } from './image-field';
export function CategoryEditor({
  initial,
  categories,
}: {
  initial?: Category;
  categories: Category[];
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(normalizeCategorySlug(initial?.slug ?? ''));
  const [slugEdited, setSlugEdited] = useState(!!initial);
  const [parent, setParent] = useState(initial?.parent_id ?? '');
  const [image, setImage] = useState(initial?.image_url ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const excluded = initial ? categoryTreeIds(categories, initial.id) : [];
  return (
    <Card className="gap-0 py-0">
      <form
        className="admin-form-card p-5 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          startTransition(async () => {
            try {
              const result = await saveCategory({
                id: initial?.id ?? null,
                name,
                slug,
                parent_id: parent || null,
                image_url: image,
              });
              if (result.error) setError(result.error);
              else {
                router.push('/admin/categories?saved=1');
                router.refresh();
              }
            } catch {
              setError('Could not save the category. Please try again.');
            }
          });
        }}
      >
        <FormReady>
          <h2>{initial ? 'Edit category' : 'Add a category'}</h2>
          <AdminField label="Category name">
            <Input
              required
              maxLength={120}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slugEdited) setSlug(slugify(event.target.value));
              }}
            />
          </AdminField>
          <AdminField label="URL slug">
            <Input
              required
              maxLength={160}
              value={slug}
              onBlur={() => setSlug(normalizeCategorySlug(slug))}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(event.target.value);
              }}
            />
          </AdminField>
          <AdminField label="Parent category">
            <AdminSelect
              value={parent}
              onValueChange={setParent}
              options={[
                { value: '', label: 'No parent — top-level category' },
                ...categories
                  .filter((category) => !excluded.includes(category.id))
                  .map((category) => ({ value: category.id, label: category.name })),
              ]}
            />
          </AdminField>
          <ImageField
            label="Category image"
            value={image}
            onChange={setImage}
            onBusy={setBusy}
            folder="categories"
          />
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <Button disabled={pending || busy}>{pending ? 'Saving…' : 'Save category'}</Button>
          {initial ? (
            <Link href="/admin/categories" className="text-link">
              Cancel edit
            </Link>
          ) : null}
        </FormReady>
      </form>
    </Card>
  );
}
