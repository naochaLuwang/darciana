'use client';
import { useId, useState } from 'react';
import { Upload } from 'lucide-react';
import { uploadAdminImage } from '@/app/admin/actions';
import { ProductImage } from '@/components/product-card';
export function ImageField({
  label,
  value,
  onChange,
  onBusy,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="admin-image-field">
      <label htmlFor={id}>{label}</label>
      <div className="admin-image-row">
        <span className="admin-image-preview">
          <ProductImage
            src={value.startsWith('https://') ? value : null}
            alt={`${label} preview`}
          />
        </span>
        <div>
          <input
            id={id}
            type="url"
            value={value}
            placeholder="https://…"
            onChange={(event) => onChange(event.target.value)}
            maxLength={2048}
          />
          <label className={`admin-upload-button ${busy ? 'disabled' : ''}`}>
            <Upload size={15} />
            {busy ? 'Uploading…' : 'Upload image'}
            <input
              aria-label={`Upload ${label.toLowerCase()}`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              disabled={busy}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                  setError('Choose an image smaller than 5 MB.');
                  return;
                }
                setError('');
                setBusy(true);
                onBusy?.(true);
                try {
                  const form = new FormData();
                  form.set('file', file);
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
