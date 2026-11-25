'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { savePaymentStatus } from '@/app/admin/actions';
import { AdminField, AdminSelect } from './form-controls';
import { StatusBadge } from './common';

export function PaymentStatus({
  id,
  status,
  updatedAt,
}: {
  id: string;
  status: 'unpaid' | 'paid';
  updatedAt: string;
}) {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function update(next: string) {
    if (pending || next === status || !['unpaid', 'paid'].includes(next)) return;
    setError('');
    setMessage('');
    startTransition(async () => {
      try {
        const result = await savePaymentStatus({
          id,
          status: next,
          expected_status: status,
          expected_updated_at: updatedAt,
        });
        if (result.error) setError(result.error);
        else {
          setMessage(result.success ?? 'Payment status saved.');
          router.refresh();
        }
      } catch {
        setError('Could not save the payment status. Refresh the order before trying again.');
      }
    });
  }
  return (
    <div role="group" aria-label="Update payment status" aria-busy={pending} className="space-y-5">
      <StatusBadge status={status}>{status === 'paid' ? 'Paid' : 'Unpaid'}</StatusBadge>
      <p className="admin-help">
        Mark paid after receiving payment. Changes save immediately without sending a push
        notification.
      </p>
      <AdminField label="Mark payment as">
        <AdminSelect
          value={status}
          onValueChange={update}
          disabled={pending}
          options={[
            { value: 'unpaid', label: 'Unpaid' },
            { value: 'paid', label: 'Paid' },
          ]}
        />
      </AdminField>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {(pending || message) && (
        <p role="status" className="admin-saved">
          {pending ? 'Saving payment status…' : message}
        </p>
      )}
    </div>
  );
}
