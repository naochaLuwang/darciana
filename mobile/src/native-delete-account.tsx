import { useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { DeleteAccount as PasswordDeleteAccount } from '../../src/components/delete-account';
import { useSession } from './session';
import { beginGoogleSignIn } from './auth-flow';
import { isDeviceOnline } from './network';

function GoogleDeleteDialog({ onClose }: { onClose: () => void }) {
  const { user } = useSession();
  const ref = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="checkout-sheet"
      aria-labelledby="google-delete-title"
      onClose={onClose}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
    >
      <div className="checkout-sheet-heading">
        <h2 id="google-delete-title">Delete account?</h2>
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
        This permanently deletes your account, profile, saved addresses and order history. Confirm
        with the same Google account to continue.
      </p>
      <form
        className="form-stack"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!user || confirmation !== 'DELETE') return;
          if (!isDeviceOnline()) {
            setError('Reconnect to delete your account.');
            return;
          }
          setPending(true);
          setError('');
          try {
            const result = await beginGoogleSignIn('account', user.id);
            if (result.error) setError(result.error);
          } finally {
            setPending(false);
          }
        }}
      >
        <label>
          Type DELETE to confirm
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            disabled={pending}
            required
          />
        </label>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="button button-danger" disabled={pending || confirmation !== 'DELETE'}>
          {pending ? 'Connecting…' : 'Confirm with Google'}
        </button>
      </form>
    </dialog>
  );
}

export function DeleteAccount() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const providers = user?.app_metadata?.providers as string[] | undefined;
  const googleOnly =
    (providers?.includes('google') || user?.app_metadata?.provider === 'google') &&
    !providers?.includes('email');
  if (!googleOnly) return <PasswordDeleteAccount />;
  return (
    <div className="delete-account-section">
      <button
        type="button"
        className="text-link delete-account-button"
        onClick={() => setOpen(true)}
      >
        <Trash2 size={16} /> Delete account
      </button>
      {open ? <GoogleDeleteDialog onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
