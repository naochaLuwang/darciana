'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { deleteProduct } from '@/app/admin/actions';

type Product = { id: string; name: string; updatedAt: string };

function DeleteProductDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const router = useRouter();
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="admin-delete-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      onClose={() => {
        if (!dialog.current?.open) onClose();
      }}
    >
      <h2 id={titleId}>Delete product?</h2>
      <p className="admin-delete-name">{product.name}</p>
      <p id={descriptionId}>
        This permanently deletes the product and all its options. Existing orders are kept.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          startTransition(async () => {
            try {
              const result = await deleteProduct({
                id: product.id,
                expected_updated_at: product.updatedAt,
                confirmation,
              });
              if (result.error) setError(result.error);
              else {
                onClose();
                router.refresh();
              }
            } catch {
              setError('Could not delete this product. Try again.');
            }
          });
        }}
      >
        <label>
          Type DELETE to confirm
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            maxLength={6}
            pattern="DELETE"
            required
            disabled={pending}
          />
        </label>
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        <div className="admin-delete-actions">
          <button
            type="button"
            className="button button-outline"
            onClick={onClose}
            disabled={pending}
            autoFocus
          >
            Cancel
          </button>
          <button
            type="submit"
            className="button button-danger"
            disabled={pending || confirmation !== 'DELETE'}
          >
            {pending ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function DeleteProduct(product: Product) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="text-link admin-delete-product"
        aria-label={`Delete ${product.name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 size={16} />
        Delete
      </button>
      {open
        ? createPortal(
            <DeleteProductDialog product={product} onClose={() => setOpen(false)} />,
            document.querySelector('.admin-root') ?? document.body,
          )
        : null}
    </>
  );
}
