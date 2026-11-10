'use client';
import { useActionState } from 'react';
import { LockKeyhole, ArrowRight } from 'lucide-react';
import { adminSignIn, type AdminResult } from '@/app/admin/actions';
import Link from 'next/link';
export function AdminLogin() {
  const [state, action, pending] = useActionState<AdminResult, FormData>(adminSignIn, {});
  return (
    <form action={action} className="admin-login-form">
      <span className="admin-login-icon">
        <LockKeyhole size={24} />
      </span>
      <span className="eyebrow">DARCIANA STORE CONSOLE</span>
      <h1>A little space to run your store.</h1>
      <p>Sign in with your approved admin account.</p>
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
        <ArrowRight size={17} />
      </button>
    </form>
  );
}
