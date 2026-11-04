import Link from 'next/link';
import { adminSession } from '@/lib/admin';
import { buildContentPages, type SettingRow } from '@/lib/store-content';
import { AdminHeading, AdminNotice } from '@/components/admin/common';
import { ContentEditor } from '@/components/admin/content-editor';
export const metadata = { title: 'More content' };
export default async function ContentAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string; saved?: string }>;
}) {
  const session = await adminSession();
  if (!session) return null;
  const params = await searchParams;
  const { data, error } = await session.db
    .from('site_settings')
    .select('id,key,content,updated_at')
    .order('updated_at', { ascending: false })
    .limit(512);
  const pages = buildContentPages((data ?? []) as SettingRow[]);
  const initial = params.new
    ? undefined
    : (pages.find((page) => page.key === params.edit) ??
      pages.find((page) => page.key === 'contact_us'));
  const configured = !!process.env.SUPABASE_SECRET_KEY;
  return (
    <>
      <AdminHeading
        title="More content"
        description="Manage Support & info and Legal pages."
        action={
          <Link href="/admin/content?new=1" className="button button-dark">
            Add page
          </Link>
        }
      />
      {params.saved === '1' ? (
        <p className="form-success" role="status">
          Page saved.
        </p>
      ) : null}
      {!configured ? (
        <AdminNotice>Configure the server-only SUPABASE_SECRET_KEY to save content.</AdminNotice>
      ) : null}
      {error ? (
        <AdminNotice>Content could not load. Refresh and try again.</AdminNotice>
      ) : (
        <div className="admin-category-layout">
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <h2>Pages</h2>
            </div>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Page</th>
                    <th>Section</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page) => (
                    <tr key={page.key}>
                      <td>
                        <strong>{page.title}</strong>
                      </td>
                      <td>{page.section === 'support' ? 'Support & info' : 'Legal'}</td>
                      <td>
                        {!page.content.trim() ? 'Not added' : page.visible ? 'Visible' : 'Hidden'}
                      </td>
                      <td>
                        <Link href={`/admin/content?edit=${page.key}`} className="text-link">
                          Edit →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <ContentEditor key={initial?.key ?? 'new'} initial={initial} configured={configured} />
        </div>
      )}
    </>
  );
}
