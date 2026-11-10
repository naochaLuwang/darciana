'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormReady } from './form-controls';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveStock } from '@/app/admin/actions';
export function StockEditor({
  id,
  stock,
  updatedAt,
}: {
  id: string;
  stock: number;
  updatedAt: string;
}) {
  const [value, setValue] = useState(String(stock));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <form
      className="admin-stock-editor"
      onSubmit={(event) => {
        event.preventDefault();
        setError('');
        setMessage('');
        startTransition(async () => {
          try {
            const result = await saveStock({
              id,
              stock: Number(value),
              expected_updated_at: updatedAt,
            });
            if (result.error) setError(result.error);
            else {
              setMessage('Saved');
              router.refresh();
            }
          } catch {
            setError('Could not save. Try again.');
          }
        });
      }}
    >
      <FormReady>
        <div>
          <Input
            aria-label="Stock quantity"
            type="number"
            min="0"
            max="1000000"
            step="1"
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <Button variant="outline" disabled={pending || Number(value) === stock}>
            {pending ? 'Saving…' : 'Save stock'}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : message ? (
          <p role="status" className="admin-saved">
            {message}
          </p>
        ) : null}
      </FormReady>
    </form>
  );
}
