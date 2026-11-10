'use client';
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
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
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Field className="admin-image-field">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="admin-image-row">
        <span className="admin-image-preview">
          <ProductImage src={value || null} alt={`${label} preview`} />
        </span>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Upload />
            {busy ? 'Uploading…' : value ? 'Replace image' : 'Upload image'}
          </Button>
          <Input
            ref={input}
            className="sr-only"
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
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={busy}
              onClick={() => {
                setError('');
                onChange('');
              }}
            >
              <X size={14} />
              Remove image
            </Button>
          ) : null}
          <small>JPEG, PNG, WebP, AVIF · up to 5 MB</small>
        </div>
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}
