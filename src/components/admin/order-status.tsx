'use client';
import { Button } from '@/components/ui/button';
import { AdminField, AdminCheck, AdminSelect, FormReady } from './form-controls';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { orderTransitions } from '@/lib/admin-validation';
import { saveOrderStatus } from '@/app/admin/actions';
export function OrderStatus({ id, status }: { id: string; status: string }) {
  const options = orderTransitions[status] ?? [];
  const [next, setNext] = useState(options[0] ?? '');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  if (!options.length)
    return (
      <p className="admin-help">
        This request is {status}. No further status changes are available.
      </p>
    );
  return (
    <form
      className="admin-order-status-form"
      onSubmit={(event) => {
        event.preventDefault();
        setError('');
        startTransition(async () => {
          try {
            const result = await saveOrderStatus({
              id,
              expected_status: status,
              status: next,
              notify_customer: notifyCustomer,
            });
            if (result.error) setError(result.error);
            else {
              setMessage(result.success ?? 'Status updated.');
              router.refresh();
            }
          } catch {
            setError('Could not save the status. Try again.');
          }
        });
      }}
    >
      <FormReady>
        <AdminField label="Move request to">
          <AdminSelect
            value={next}
            onValueChange={setNext}
            options={options.map((option) => ({
              value: option,
              label: option.charAt(0).toUpperCase() + option.slice(1),
            }))}
          />
        </AdminField>
        <AdminCheck
          required
          key={next}
          label={
            <>
              <span>I’ve reviewed this request and want to mark it {next}.</span>
            </>
          }
        />
        <AdminCheck
          checked={notifyCustomer}
          onCheckedChange={(checked) => setNotifyCustomer(checked === true)}
          disabled={pending}
          label={
            <>
              <span>Send the customer a push notification.</span>
            </>
          }
        />
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="admin-saved">
            {message}
          </p>
        ) : null}
        <Button disabled={pending}>{pending ? 'Updating…' : 'Update status'}</Button>
      </FormReady>
    </form>
  );
}
