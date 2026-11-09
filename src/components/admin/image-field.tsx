'use client';
import { useId, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { MAX_IMAGE_BYTES, type MediaFolder } from '@/lib/media';
import { uploadAdminImage } from '@/app/admin/actions';
import { ProductImage } from '@/components/product-card';
export function ImageField({
  label,
  value,
  onChange,
  onBusy,
  folder = 'products',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBusy?: (busy: boolean) => void;
  folder?: MediaFolder;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="admin-image-field">
      <label htmlFor={id}>{label}</label>
      <div className="admin-image-row">
        <span className="admin-image-preview">
          <ProductImage src={value || null} alt={`${label} preview`} />
        </span>
        <div>
          <label className={`admin-upload-button ${busy ? 'disabled' : ''}`}>
            <Upload size={15} />
            {busy ? 'Uploading…' : value ? 'Replace image' : 'Upload image'}
            <input
              id={id}
              aria-label={`Upload ${label.toLowerCase()}`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              disabled={busy}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                if (file.size > MAX_IMAGE_BYTES) {
                  setError('Choose an image up to 5 MB.');
                  return;
                }
                setError('');
                setBusy(true);
                onBusy?.(true);
                try {
                  const form = new FormData();
                  form.set('file', file);
                  form.set('folder', folder);
                  const result = await uploadAdminImage(form);
                  if (result.error) setError(result.error);
                  else if (result.url) onChange(result.url);
                } catch {
                  setError('The upload could not finish. Please try again.');
                } finally {
                  setBusy(false);
                  onBusy?.(false);
                }
              }}
            />
          </label>
          {value ? (
            <button
              type="button"
              className="text-link admin-remove-image"
              disabled={busy}
              onClick={() => {
                setError('');
                onChange('');
              }}
            >
              <X size={14} />
              Remove image
            </button>
          ) : null}
          <small>JPEG, PNG, WebP, AVIF · up to 5 MB</small>
        </div>
      </div>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
