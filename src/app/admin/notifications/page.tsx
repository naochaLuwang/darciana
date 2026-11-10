import { adminSession } from '@/lib/admin';
import { contentWriter } from '@/lib/store-content-server';
import { firebaseConfigured } from '@/lib/firebase-server';
import { pushError } from '@/lib/push';
import { AdminHeading, AdminNotice, adminDate } from '@/components/admin/common';
import { NotificationEditor } from '@/components/admin/notification-editor';
import { resendConfig } from '@/lib/resend-server';
import Link from 'next/link';

export const metadata = { title: 'Notifications' };
export default async function NotificationsPage() {
  if (!(await adminSession())) return null;
  const db = contentWriter();
  const configured = Boolean(db && firebaseConfigured());
  const [devices, announcements, history, emails] = db
    ? await Promise.all([
        db.from('storefront_push_devices').select('id', { count: 'exact', head: true }),
        db
          .from('storefront_push_devices')
          .select('id', { count: 'exact', head: true })
          .eq('announcements', true),
        db
          .from('storefront_push_deliveries')
          .select('id,title,audience,status,success_count,failure_count,created_at')
          .order('created_at', { ascending: false })
          .limit(30),
        db
          .from('storefront_email_deliveries')
          .select('id,order_id,order_status,status,failure_reason,created_at')
          .order('created_at', { ascending: false })
          .limit(30),
      ])
    : [null, null, null, null];
  const error = devices?.error ?? announcements?.error ?? history?.error;
  return (
    <>
      <AdminHeading
        title="Notifications"
        description={`${devices?.count ?? 0} registered devices · ${announcements?.count ?? 0} subscribed to announcements`}
      />
      {!configured ? (
        <AdminNotice>
          Add FIREBASE_SERVICE_ACCOUNT_BASE64 and SUPABASE_SECRET_KEY to the server environment.
        </AdminNotice>
      ) : null}
      {error ? <AdminNotice>{pushError(error)}</AdminNotice> : null}
      <NotificationEditor configured={configured && !error} devices={announcements?.count ?? 0} />
      <section className="admin-panel admin-push-history">
        <div className="admin-panel-heading">
          <h2>Sending history</h2>
        </div>
        {history?.data?.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Notification</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th>Failed</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.data.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.title}</strong>
                    </td>
                    <td>
                      {row.audience === 'admin_order'
                        ? 'New order alert'
                        : row.audience === 'order'
                          ? 'Order update'
                          : 'Announcement'}
                    </td>
                    <td>{row.status === 'empty' ? 'No devices' : row.status}</td>
                    <td>{row.success_count}</td>
                    <td>{row.failure_count}</td>
                    <td>{adminDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-help admin-push-empty">No notifications sent yet.</p>
        )}
      </section>
      <section className="admin-panel admin-push-history">
        <div className="admin-panel-heading">
          <h2>Order emails</h2>
        </div>
        {!resendConfig() ? (
          <AdminNotice>
            Configure RESEND_API_KEY and RESEND_FROM_EMAIL on the website server.
          </AdminNotice>
        ) : null}
        {emails?.error ? (
          <AdminNotice>Run the order email setup SQL to enable sending history.</AdminNotice>
        ) : emails?.data?.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Update</th>
                  <th>Email status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {emails.data.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.order_id ? (
                        <Link href={`/admin/orders/${row.order_id}`}>
                          #{row.order_id.slice(0, 8).toUpperCase()}
                        </Link>
                      ) : (
                        'Deleted order'
                      )}
                    </td>
                    <td>{row.order_status.replaceAll('_', ' ')}</td>
                    <td>
                      {row.status === 'sent'
                        ? 'Accepted by Resend'
                        : row.status.replaceAll('_', ' ')}
                    </td>
                    <td>{adminDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-help admin-push-empty">No order emails yet.</p>
        )}
      </section>
    </>
  );
}
