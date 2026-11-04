'use client';
import { useActionState, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { authenticate, type AuthState } from '@/app/auth/actions';
export function AuthForm({ next = '' }: { next?: string }) {
  const [mode, setMode] = useState('login');
  const [state, action, pending] = useActionState<AuthState, FormData>(authenticate, {});
  return (
    <div className="auth-card">
      <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
      {next === 'checkout' ? <p>Sign in to checkout.</p> : null}
      <div className="auth-tabs">
        <button className={mode === 'login' ? 'selected' : ''} onClick={() => setMode('login')}>
          Sign in
        </button>
        <button
          className={mode === 'register' ? 'selected' : ''}
          onClick={() => setMode('register')}
        >
          Create account
        </button>
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
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'register' ? 8 : 1}
            maxLength={128}
            placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
          />
        </label>
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
          {pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          <ArrowRight size={17} />
        </button>
      </form>
    </div>
  );
}
