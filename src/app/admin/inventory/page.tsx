import Link from 'next/link';
import { adminSession } from '@/lib/admin';
import { AdminHeading, AdminNotice, Pagination, pageNumber } from '@/components/admin/common';
import { StockEditor } from '@/components/admin/stock-editor';
export const metadata = { title: 'Inventory' };
export default async function Inventory({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; low?: string; page?: string }>;
}) {
  const session = await adminSession();
  if (!session) return null;
  const params = await searchParams;
  const page = pageNumber(params.page);
  const q = (params.q ?? '').trim().slice(0, 80);
  const low = params.low === 'true';
  let query = session.db
    .from('product_variants')
    .select('id,sku,title,stock,updated_at,products!inner(id,name,status)', { count: 'exact' })
    .eq('products.status', 'active')
    .order('stock')
    .order('id')
    .range((page - 1) * 25, page * 25 - 1);
  if (q) query = query.ilike('sku', `%${q}%`);
  if (low) query = query.lte('stock', 5);
  const result = await query;
  type Row = {
    id: string;
    sku: string;
    title: string;
    stock: number;
    updated_at: string;
    products: { id: string; name: string; status: string };
  };
  const rows = (result.data ?? []) as unknown as Row[];
  return (
    <>
      <AdminHeading
        title="Inventory"
        description="Update option-level stock for active products. Zero stock makes an option unavailable."
      />
      <form className="admin-filterbar">
        <input name="q" aria-label="Search SKU" defaultValue={q} placeholder="Search by SKU" />
        <label className="admin-checkbox">
          <input name="low" type="checkbox" value="true" defaultChecked={low} />
          Low stock only (≤5)
        </label>
        <button className="button button-outline">Apply filters</button>
      </form>
      {result.error ? (
        <AdminNotice>Inventory could not load. Check your admin setup and refresh.</AdminNotice>
      ) : (
        <section className="admin-panel admin-table-panel">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product & option</th>
                  <th>SKU</th>
                  <th>Availability</th>
                  <th>Update stock</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/products/${row.products.id}`}>
                        <strong>{row.products.name}</strong>
                        <small>{row.title}</small>
                      </Link>
                    </td>
                    <td className="admin-sku">{row.sku}</td>
                    <td>
                      <span
                        className={`admin-status ${row.stock === 0 ? 'inactive' : row.stock <= 5 ? 'low' : 'active'}`}
                      >
                        {row.stock === 0
                          ? 'Out of stock'
                          : row.stock <= 5
                            ? 'Low stock'
                            : 'In stock'}
                      </span>
                    </td>
                    <td>
                      <StockEditor id={row.id} stock={row.stock} updatedAt={row.updated_at} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length ? (
            <div className="admin-empty">
              <h3>No matching inventory</h3>
              <p>Try another SKU or change the stock filter.</p>
            </div>
          ) : null}
          <Pagination
            page={page}
            count={result.count ?? 0}
            href={`/admin/inventory?${new URLSearchParams({ q, low: String(low) })}`}
          />
        </section>
      )}
    </>
  );
}
