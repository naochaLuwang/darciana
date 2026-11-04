'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, X } from 'lucide-react';
import { deleteAccount } from '@/app/account/actions';
function DeleteDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  useEffect(() => {
    const sheet = dialog.current!;
    sheet.showModal();
    return () => sheet.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="checkout-sheet"
      aria-labelledby="delete-account-title"
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      onClose={() => {
        if (!dialog.current?.open) onClose();
      }}
    >
      <div className="checkout-sheet-heading">
        <h2 id="delete-account-title">Delete account?</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close delete account"
          onClick={onClose}
          disabled={pending}
        >
          <X size={20} />
        </button>
      </div>
      <p className="delete-account-warning">
        This permanently deletes your account, profile, saved addresses and order history.
      </p>
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setError('');
          startTransition(async () => {
            try {
              const result = await deleteAccount({ password: data.get('password'), confirmation });
              if (result.error) setError(result.error);
              else if (result.deleted) {
                try {
                  localStorage.removeItem('darciana.bag.v1');
                  localStorage.removeItem('darciana.saved.v1');
                  window.dispatchEvent(new Event('darciana-storage'));
                } catch {
                  /* Deletion still succeeds when browser storage is disabled. */
                }
                router.replace('/account?deleted=1');
                router.refresh();
                onClose();
              }
            } catch {
              setError('Could not delete your account. Try again.');
            }
          });
        }}
      >
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            required
            disabled={pending}
          />
        </label>
        <label>
          Type DELETE to confirm
          <input
            name="confirmation"
            autoComplete="off"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
            disabled={pending}
          />
        </label>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="button button-danger" disabled={pending || confirmation !== 'DELETE'}>
          {pending ? 'Deleting…' : 'Delete my account'}
        </button>
      </form>
    </dialog>
  );
}
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  return (
    <div className="delete-account-section">
      <button
        type="button"
        className="text-link delete-account-button"
        onClick={() => setOpen(true)}
      >
        <Trash2 size={16} /> Delete account
      </button>
      {open ? <DeleteDialog onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
