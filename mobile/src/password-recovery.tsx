import { useEffect, useState } from 'react';
import { PasswordRecovery } from '@/components/password-recovery';
import { ScreenSkeleton } from '@/components/screen-skeleton';
import { readRecoveryGrant, recoveryStorageKey } from '@/lib/password-recovery';
import { authStorage } from './storage';
import { useSession } from './session';

export function NativeResetPassword() {
  const { user, ready } = useSession();
  const [grant, setGrant] = useState<string | null | undefined>();
  useEffect(() => {
    let active = true;
    void authStorage
      .getItem(recoveryStorageKey)
      .then((raw) => {
        if (active) setGrant(readRecoveryGrant(raw));
      })
      .catch(() => {
        if (active) setGrant(null);
      });
    return () => {
      active = false;
    };
  }, []);
  if (!ready || grant === undefined) return <ScreenSkeleton screen="signin" />;
  return <PasswordRecovery mode={user && user.id === grant ? 'update' : 'expired'} />;
}
