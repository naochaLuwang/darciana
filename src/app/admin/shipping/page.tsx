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
        description="Set an area name and delivery price. Customers search and select their area at checkout."
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
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <h2>Your delivery areas</h2>
              <span>
                {areas.filter((area) => area.is_active).length} active · {areas.length} total
              </span>
            </div>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Area</th>
                    <th>Delivery price</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {areas.map((area) => (
                    <tr key={area.id}>
                      <td>
                        <strong>{area.name}</strong>
                      </td>
                      <td>{area.price === 0 ? 'Free' : money(area.price)}</td>
                      <td>
                        <span className={`admin-status ${area.is_active ? 'active' : 'inactive'}`}>
                          {area.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <Link className="text-link" href={`/admin/shipping?edit=${area.id}`}>
                          Edit →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!areas.length ? (
              <div className="admin-empty">
                <h3>Where do you deliver?</h3>
                <p>
                  Add your first area and price to make delivery selection available at checkout.
                </p>
              </div>
            ) : null}
          </section>
          <ShippingEditor key={initial?.id ?? 'new'} initial={initial} />
        </div>
      )}
    </>
  );
}
