import { cookies } from 'next/headers';
import { PasswordRecovery } from '@/components/password-recovery';
import { createClient } from '@/lib/supabase/server';
import { recoveryCookie, readRecoveryGrant } from '@/lib/password-recovery';
export const metadata = { title: 'Reset password', robots: { index: false, follow: false } };
export default async function ResetPassword() {
  const db = await createClient();
  const user = db ? (await db.auth.getUser()).data.user : null;
  const recoveryUser = readRecoveryGrant((await cookies()).get(recoveryCookie)?.value);
  return <PasswordRecovery mode={user && user.id === recoveryUser ? 'update' : 'expired'} />;
}
