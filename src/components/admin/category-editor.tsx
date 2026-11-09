'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { saveCategory } from '@/app/admin/actions';
import { slugify } from '@/lib/admin-validation';
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
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(!!initial);
  const [parent, setParent] = useState(initial?.parent_id ?? '');
  const [image, setImage] = useState(initial?.image_url ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const excluded = initial ? categoryTreeIds(categories, initial.id) : [];
  return (
    <form
      className="admin-panel admin-form-section"
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
      <h2>{initial ? 'Edit category' : 'Add a category'}</h2>
      <label>
        Category name
        <input
          required
          maxLength={120}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugEdited) setSlug(slugify(event.target.value));
          }}
        />
      </label>
      <label>
        URL slug
        <input
          required
          maxLength={160}
          value={slug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(event.target.value);
          }}
        />
      </label>
      <label>
        Parent category
        <select value={parent} onChange={(event) => setParent(event.target.value)}>
          <option value="">No parent — top-level category</option>
          {categories
            .filter((category) => !excluded.includes(category.id))
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </select>
      </label>
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
      <button className="button button-dark" disabled={pending || busy}>
        {pending ? 'Saving…' : 'Save category'}
      </button>
      {initial ? (
        <Link href="/admin/categories" className="text-link">
          Cancel edit
        </Link>
      ) : null}
    </form>
  );
}
