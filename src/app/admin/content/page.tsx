import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
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
          <Button asChild>
            <Link href="/admin/content?new=1">Add page</Link>
          </Button>
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
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="admin-panel-heading">
              <h2>Pages</h2>
            </CardHeader>
            <div className="min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <span className="sr-only">Edit</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.map((page) => (
                    <TableRow key={page.key}>
                      <TableCell>
                        <strong>{page.title}</strong>
                      </TableCell>
                      <TableCell>
                        {page.section === 'support' ? 'Support & info' : 'Legal'}
                      </TableCell>
                      <TableCell>
                        {!page.content.trim() ? 'Not added' : page.visible ? 'Visible' : 'Hidden'}
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/content?edit=${page.key}`} className="text-link">
                          Edit →
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
          <ContentEditor key={initial?.key ?? 'new'} initial={initial} configured={configured} />
        </div>
      )}
    </>
  );
}
