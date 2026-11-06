'use client';

import { useFormStatus } from 'react-dom';
import { LogOut, ArrowUpRight } from 'lucide-react';

export function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="account-sign-out" disabled={pending}>
      <span className="account-menu-icon" aria-hidden="true">
        <LogOut size={19} />
      </span>
      <span className="account-menu-label">{pending ? 'Signing out…' : 'Sign out'}</span>
      <ArrowUpRight size={18} aria-hidden="true" />
    </button>
  );
}
