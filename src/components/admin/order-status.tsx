'use client';
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
      <label>
        Move request to
        <select value={next} onChange={(event) => setNext(event.target.value)}>
          {options.map((option) => (
            <option key={option} value={option}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-checkbox">
        <input type="checkbox" required key={next} />
        <span>I’ve reviewed this request and want to mark it {next}.</span>
      </label>
      <label className="admin-checkbox">
        <input
          type="checkbox"
          checked={notifyCustomer}
          onChange={(event) => setNotifyCustomer(event.target.checked)}
          disabled={pending}
        />
        <span>Send the customer a push notification.</span>
      </label>
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
      <button className="button button-dark" disabled={pending}>
        {pending ? 'Updating…' : 'Update status'}
      </button>
    </form>
  );
}
