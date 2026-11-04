import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { adminSession, adminProductSelect, normalizeAdminProduct } from '@/lib/admin';
import { money, startingPrice } from '@/lib/commerce';
import { AdminHeading, AdminNotice, Pagination, pageNumber } from '@/components/admin/common';
import { ProductImage } from '@/components/product-card';
export const metadata = { title: 'Products' };
export default async function AdminProducts({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const session = await adminSession();
  if (!session) return null;
  const params = await searchParams;
  const page = pageNumber(params.page);
  const q = (params.q ?? '').trim().slice(0, 80);
  const status = ['active', 'inactive'].includes(params.status ?? '') ? params.status! : '';
  let query = session.db
    .from('products')
    .select(adminProductSelect, { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * 25, page * 25 - 1);
  if (q) query = query.ilike('name', `%${q}%`);
  if (status) query = query.eq('status', status);
  const result = await query;
  const products = (result.data ?? []).map((product) => normalizeAdminProduct(product));
  return (
    <>
      <AdminHeading
        title="Products"
        description="Manage the little things your customers come here for."
        action={
          <Link href="/admin/products/new" className="button button-dark">
            <Plus size={17} /> Add product
          </Link>
        }
      />
      <form className="admin-filterbar">
        <div>
          <Search size={18} />
          <input
            name="q"
            aria-label="Search product names"
            defaultValue={q}
            placeholder="Search product names"
          />
        </div>
        <select name="status" aria-label="Product visibility" defaultValue={status}>
          <option value="">All products</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="button button-outline">Search</button>
      </form>
      {result.error ? (
        <AdminNotice>Products could not load. Check your admin setup and try again.</AdminNotice>
      ) : (
        <section className="admin-panel admin-table-panel">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Options</th>
                  <th>
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <Link className="admin-product-cell" href={`/admin/products/${product.id}`}>
                        <span className="admin-thumbnail">
                          <ProductImage src={product.thumbnail_url} alt="" />
                        </span>
                        <span>
                          <strong>{product.name}</strong>
                          <small>{product.brand || 'No brand'}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className={`admin-status ${product.status}`}>{product.status}</span>
                    </td>
                    <td>
                      {product.has_variants ? 'From ' : ''}
                      {money(startingPrice(product))}
                    </td>
                    <td>
                      {product.product_variants.reduce((sum, variant) => sum + variant.stock, 0)}
                    </td>
                    <td>{product.product_variants.length}</td>
                    <td>
                      <Link className="text-link" href={`/admin/products/${product.id}`}>
                        Edit →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!products.length ? (
            <div className="admin-empty">
              <h3>No products found</h3>
              <p>Change the filters or add your first product.</p>
            </div>
          ) : null}
          <Pagination
            page={page}
            count={result.count ?? 0}
            href={`/admin/products?${new URLSearchParams({ q, status })}`}
          />
        </section>
      )}
    </>
  );
}
