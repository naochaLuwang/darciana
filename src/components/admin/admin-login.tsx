'use client';
import { useActionState } from 'react';
import { ArrowRight } from 'lucide-react';
import { adminSignIn, type AdminResult } from '@/app/admin/actions';
import Link from 'next/link';
import { AdminBrand } from './admin-brand';
export function AdminLogin() {
  const [state, action, pending] = useActionState<AdminResult, FormData>(adminSignIn, {});
  return (
    <form action={action} className="admin-login-form">
      <AdminBrand className="admin-login-brand" />
      <h1>Admin sign in</h1>
      <p>Use your approved store account</p>
      <label>
        Email address
        <input name="email" type="email" autoComplete="username" required maxLength={254} />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </label>
      <Link href="/account/forgot-password" className="text-link auth-forgot">
        Forgot password?
      </Link>
      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
      <button disabled={pending} className="button button-dark">
        {pending ? 'Signing in…' : 'Sign in to admin'}
        <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </form>
  );
}
