import { useState } from 'react';
import type { AppleSignInProps } from '../../src/components/apple-sign-in';
import { beginAppleSignIn, supportsAppleSignIn } from './apple-auth';

export function AppleSignIn({ next, disabled, onPendingChange }: AppleSignInProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (!supportsAppleSignIn()) return null;
  return (
    <div className="apple-sign-in-form">
      <button
        type="button"
        className="button apple-sign-in"
        disabled={disabled || pending}
        onClick={async () => {
          setPending(true);
          onPendingChange(true);
          setError('');
          try {
            const result = await beginAppleSignIn(next);
            if (result.error) setError(result.error);
          } finally {
            setPending(false);
            onPendingChange(false);
          }
        }}
      >
        <svg width="20" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.05 12.54c.03 3.17 2.78 4.22 2.81 4.23-.02.08-.44 1.51-1.45 2.99-.87 1.28-1.78 2.55-3.21 2.58-1.4.03-1.85-.83-3.45-.83-1.59 0-2.09.8-3.42.86-1.38.05-2.43-1.39-3.31-2.66-1.8-2.6-3.18-7.35-1.33-10.55A5.14 5.14 0 0 1 8.04 6.5c1.4-.03 2.72.93 3.57.93.86 0 2.46-1.15 4.14-.98.7.03 2.67.28 3.94 2.14-.1.06-2.67 1.55-2.64 4.05ZM14.42 4.69c.73-.88 1.22-2.1 1.08-3.32-1.05.04-2.32.7-3.07 1.58-.67.78-1.26 2.03-1.1 3.22 1.17.09 2.36-.6 3.09-1.48Z" />
        </svg>
        {pending ? 'Connecting…' : 'Continue with Apple'}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
