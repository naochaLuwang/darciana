'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { StoreImage } from './store-image';
import { forgotPassword, updatePassword, type AuthState } from '@/app/auth/actions';

export function PasswordRecovery({ mode }: { mode: 'request' | 'update' | 'expired' }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === 'update' ? updatePassword : forgotPassword,
    {},
  );
  return (
    <main id="main" className="page-width auth-page">
      <div className="auth-card">
        <header className="auth-intro">
          <Link href="/" className="header-logo auth-brand" aria-label="Daciana home">
            <StoreImage
              asset="branding/daciana-logo-transparent.png"
              alt="Daciana — Stationery & Cosmetics"
              width={1774}
              height={887}
              sizes="355px"
              loading="eager"
            />
          </Link>
          <h1>
            {mode === 'request'
              ? 'Forgot password'
              : mode === 'update'
                ? 'Set new password'
                : 'Reset link expired'}
          </h1>
        </header>
        <div className="auth-form-panel">
          {mode === 'expired' ? (
            <Link href="/account/forgot-password" className="button button-dark">
              Request a new link
            </Link>
          ) : (
            <form action={action} className="form-stack">
              {mode === 'request' ? (
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                    maxLength={254}
                    disabled={pending}
                  />
                </label>
              ) : (
                <>
                  <label>
                    New password
                    <input
                      name="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      disabled={pending}
                    />
                  </label>
                  <label>
                    Confirm new password
                    <input
                      name="confirmation"
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      disabled={pending}
                    />
                  </label>
                </>
              )}
              {state.error ? (
                <p className="form-error" role="alert">
                  {state.error}
                </p>
              ) : null}
              {state.message ? (
                <p className="form-success" role="status">
                  {state.message}
                </p>
              ) : null}
              <button className="button button-dark" disabled={pending}>
                {pending
                  ? 'Please wait…'
                  : mode === 'request'
                    ? 'Send reset link'
                    : 'Update password'}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
        </div>
        <p className="auth-switch">
          <Link href="/account" className="text-link">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
