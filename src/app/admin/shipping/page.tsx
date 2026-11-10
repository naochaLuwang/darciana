import { StatusBadge } from '@/components/admin/common';
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
import type { ShippingArea } from '@/lib/shipping';
import { money } from '@/lib/commerce';
import { AdminHeading, AdminNotice } from '@/components/admin/common';
import { ShippingEditor } from '@/components/admin/shipping-editor';
export const metadata = { title: 'Shipping areas' };
export default async function ShippingPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; saved?: string }>;
}) {
  const session = await adminSession();
  if (!session) return null;
  const params = await searchParams;
  const result = await session.db
    .from('storefront_shipping_areas')
    .select('id,name,price,is_active,updated_at')
    .order('name')
    .limit(1000);
  const areas = (result.data ?? []) as ShippingArea[];
  const initial = areas.find((area) => area.id === params.edit);
  return (
    <>
      <AdminHeading
        title="Shipping areas"
        description="Delivery areas and charges shown at checkout"
      />
      {params.saved === '1' ? (
        <p role="status" className="form-success">
          Delivery area saved.
        </p>
      ) : null}
      {result.error ? (
        <AdminNotice>
          Shipping areas could not load. Apply supabase/shipping-setup.sql after the admin setup,
          then refresh.
        </AdminNotice>
      ) : (
        <div className="admin-category-layout">
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="admin-panel-heading">
              <h2>Your delivery areas</h2>
              <span>
                {areas.filter((area) => area.is_active).length} active · {areas.length} total
              </span>
            </CardHeader>
            <div className="min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Area</TableHead>
                    <TableHead>Delivery price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <span className="sr-only">Edit</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {areas.map((area) => (
                    <TableRow key={area.id}>
                      <TableCell>
                        <strong>{area.name}</strong>
                      </TableCell>
                      <TableCell>{area.price === 0 ? 'Free' : money(area.price)}</TableCell>
                      <TableCell>
                        <StatusBadge status={area.is_active ? 'active' : 'inactive'}>
                          {area.is_active ? 'Active' : 'Inactive'}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <Link className="text-link" href={`/admin/shipping?edit=${area.id}`}>
                          Edit →
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {!areas.length ? (
              <div className="admin-empty">
                <h3>Where do you deliver?</h3>
                <p>
                  Add your first area and price to make delivery selection available at checkout.
                </p>
              </div>
            ) : null}
          </Card>
          <ShippingEditor key={initial?.id ?? 'new'} initial={initial} />
        </div>
      )}
    </>
  );
}
