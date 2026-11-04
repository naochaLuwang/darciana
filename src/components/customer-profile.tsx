'use client';
import { useState, useTransition } from 'react';
import { saveProfile } from '@/app/account/actions';
import type { CustomerProfile as Profile } from '@/lib/profile-server';
export function CustomerProfile({
  profile,
  fallback,
  error,
}: {
  profile: Profile | null;
  fallback: Profile | null;
  error: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  return (
    <section className="account-panel" aria-labelledby="customer-profile-title">
      <h2 id="customer-profile-title">{profile ? 'Profile' : 'Complete your profile'}</h2>
      {error ? (
        <p className="notice" role="status">
          {error}
        </p>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setSaveError('');
          setMessage('');
          startTransition(async () => {
            try {
              const result = await saveProfile({
                name: data.get('name'),
                phone: data.get('phone'),
              });
              if (result.error) setSaveError(result.error);
              else setMessage('Profile updated.');
            } catch {
              setSaveError('Could not save your profile. Try again.');
            }
          });
        }}
      >
        <fieldset disabled={pending} className="address-fieldset">
          <div className="form-grid">
            <label>
              Full name
              <input
                name="name"
                autoComplete="name"
                maxLength={100}
                required
                defaultValue={profile?.name ?? fallback?.name ?? ''}
              />
            </label>
            <label>
              Mobile number
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={15}
                required
                defaultValue={profile?.phone ?? fallback?.phone ?? ''}
              />
            </label>
          </div>
          {saveError ? (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          ) : null}
          {message ? (
            <p className="form-success" role="status">
              {message}
            </p>
          ) : null}
          <div className="address-actions">
            <button className="button button-dark" disabled={pending || !!error}>
              {pending ? 'Saving…' : profile ? 'Update profile' : 'Save profile'}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
