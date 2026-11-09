'use client';
import { useActionState, useId, useState } from 'react';
import Link from 'next/link';
import { StoreImage as Image } from '@/components/store-image';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { authenticate, signInWithGoogle, type AuthState } from '@/app/auth/actions';
export function AuthForm({ next = '' }: { next?: string }) {
  const [mode, setMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const passwordId = useId();
  const [state, action, pending] = useActionState<AuthState, FormData>(authenticate, {});
  const [googleState, googleAction, googlePending] = useActionState<AuthState, FormData>(
    signInWithGoogle,
    {},
  );
  const busy = pending || googlePending;
  return (
    <div className="auth-card">
      <header className="auth-intro">
        <Link href="/" className="header-logo auth-brand" aria-label="Daciana home">
          <Image
            asset="branding/daciana-logo-transparent.png"
            alt="Daciana — Stationery & Cosmetics"
            width={1774}
            height={887}
            sizes="355px"
            loading="eager"
          />
        </Link>
        <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        {next === 'checkout' ? <p>Sign in to checkout.</p> : null}
      </header>
      <div className="auth-form-panel">
        <form action={googleAction} className="google-sign-in-form">
          <input type="hidden" name="next" value={next} />
          <button className="button google-sign-in" disabled={busy}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.97-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48Z"
              />
            </svg>
            {googlePending ? 'Connecting…' : 'Continue with Google'}
          </button>
          {googleState.error ? (
            <p className="form-error" role="alert">
              {googleState.error}
            </p>
          ) : null}
        </form>
        <div className="auth-divider" aria-hidden="true">
          or
        </div>
        <form action={action} className="form-stack">
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="next" value={next} />
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              maxLength={254}
            />
          </label>
          <div className="auth-password">
            <label htmlFor={passwordId}>Password</label>
            <div className="auth-password-control">
              <input
                id={passwordId}
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'register' ? 8 : 1}
                maxLength={128}
                placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </div>
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
          <button className="button button-dark" disabled={busy}>
            {pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            <ArrowRight size={17} />
          </button>
        </form>
      </div>
      <p className="auth-switch">
        {mode === 'login' ? 'New to Daciana?' : 'Already have an account?'}
        <button
          type="button"
          className="text-link"
          disabled={busy}
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setShowPassword(false);
          }}
        >
          {mode === 'login' ? 'Create account' : 'Sign in'}
        </button>
      </p>
    </div>
  );
}
