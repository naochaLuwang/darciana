'use client';
import { AdminField, AdminSelect } from './form-controls';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  orderTransitions,
  orderStatusOptions,
  orderStatusLabel,
  type OrderStatus as DeliveryStatus,
} from '@/lib/order-status';
import { saveOrderStatus } from '@/app/admin/actions';

export function OrderStatus({ id, status }: { id: string; status: string }) {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const options = orderTransitions[status] ?? [];
  function update(next: string) {
    if (pending || next === status || !options.includes(next as DeliveryStatus)) return;
    setError('');
    setMessage('');
    startTransition(async () => {
      try {
        const result = await saveOrderStatus({ id, expected_status: status, status: next });
        if (result.error) setError(result.error);
        else {
          setMessage(result.success ?? 'Status updated.');
          router.refresh();
        }
      } catch {
        setError('Could not save the status. Refresh the order before trying again.');
      }
    });
  }
  return (
    <div className="admin-order-status-form space-y-5" aria-busy={pending}>
      <AdminField label="Delivery status">
        <AdminSelect
          value={status}
          onValueChange={update}
          options={orderStatusOptions(status)}
          disabled={pending}
        />
      </AdminField>
      <p className="admin-help">
        Changes save immediately and notify the customer on registered devices. Cancellation is
        available only before shipping.
      </p>
      {!options.length && (
        <p className="admin-help">
          This order is {orderStatusLabel(status).toLowerCase()}. No further delivery changes are
          available.
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {(pending || message) && (
        <p role="status" className="admin-saved">
          {pending ? 'Saving status…' : message}
        </p>
      )}
    </div>
  );
}
