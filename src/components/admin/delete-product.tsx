'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { deleteProduct } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError } from '@/components/ui/field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AdminField } from './form-controls';
type Product = { id: string; name: string; updatedAt: string };
export function DeleteProduct(product: Product) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (pending) return;
        setOpen(value);
        setConfirmation('');
        setError('');
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/5 hover:text-destructive"
          aria-label={`Delete ${product.name}`}
        >
          <Trash2 />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Delete product?</DialogTitle>
          <DialogDescription>
            This permanently deletes the product and all its options. Existing orders are kept.
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-md border bg-muted/50 p-3 text-sm font-medium">{product.name}</p>
        <form
          className="space-y-5"
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
                  setOpen(false);
                  router.refresh();
                }
              } catch {
                setError('Could not delete this product. Try again.');
              }
            });
          }}
        >
          <AdminField label="Type DELETE to confirm">
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              maxLength={6}
              pattern="DELETE"
              required
              disabled={pending}
            />
          </AdminField>
          {error ? <FieldError>{error}</FieldError> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
              autoFocus
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending || confirmation !== 'DELETE'}
            >
              {pending ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
