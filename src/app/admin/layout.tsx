import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAdminContext } from '@/lib/admin';
import { AdminShell } from '@/components/admin/admin-shell';
import { AdminLogin } from '@/components/admin/admin-login';
import { adminSignOut } from './actions';
import './admin.css';
import { AdminBrand } from '@/components/admin/admin-brand';
export const metadata = {
  title: { default: 'Store admin | Daciana', template: '%s | Daciana Admin' },
  robots: { index: false, follow: false },
};
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await getAdminContext();
  return (
    <div className="admin-root">
      {context.state === 'authorized' && context.user ? (
        <AdminShell email={context.user.email ?? ''}>{children}</AdminShell>
      ) : (
        <main id="main" className="admin-access-screen">
          {context.state === 'signed_out' ? (
            <AdminLogin />
          ) : (
            <Card className="admin-access-card">
              <AdminBrand className="admin-login-brand" />
              <h1>
                {context.state === 'denied'
                  ? 'Admin access required'
                  : context.state === 'setup'
                    ? 'Finish your admin setup'
                    : 'We couldn’t check your access'}
              </h1>
              <p>
                {context.state === 'denied'
                  ? `${context.user?.email ?? 'This account'} is signed in but is not an approved store administrator.`
                  : context.state === 'setup'
                    ? 'Run the database setup scripts and enroll the owner account before opening the console. Instructions are in README.md.'
                    : 'Please try again shortly. Store data stays protected until your access can be verified.'}
              </p>
              {context.user ? (
                <form action={adminSignOut}>
                  <Button>Use another account</Button>
                </form>
              ) : null}
            </Card>
          )}
          <Link href="/" className="text-link">
            ← Back to the storefront
          </Link>
        </main>
      )}
    </div>
  );
}
