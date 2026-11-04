'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function CheckoutTerms({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const sheet = dialog.current!;
    sheet.showModal();
    return () => sheet.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="checkout-sheet checkout-terms-sheet"
      aria-labelledby="checkout-terms-title"
      onClose={() => {
        if (!dialog.current?.open) onClose();
      }}
    >
      <div className="checkout-sheet-heading">
        <h2 id="checkout-terms-title">Terms and conditions</h2>
        <button type="button" className="icon-button" aria-label="Close terms" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <ul>
        <li>Your order request is subject to stock availability and store confirmation.</li>
        <li>The displayed total includes the selected delivery area’s charge.</li>
        <li>Payment is by cash on delivery. No payment is collected at checkout.</li>
        <li>Your contact and address are used to fulfil your order.</li>
      </ul>
      <button type="button" className="button button-dark" onClick={onClose}>
        Done
      </button>
    </dialog>
  );
}
