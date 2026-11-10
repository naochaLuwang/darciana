import { Search } from 'lucide-react';
import { adminSession, adminProductSelect, normalizeAdminProduct } from '@/lib/admin';
import { productPricing } from '@/lib/product-pricing';
import { AdminHeading, AdminNotice, Pagination, pageNumber } from '@/components/admin/common';
import { PriceEditor } from '@/components/admin/price-editor';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Card, CardContent } from '@/components/ui/card';
export const metadata = { title: 'Prices' };
export default async function PricesPage({
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
    .order('name')
    .order('id')
    .range((page - 1) * 25, page * 25 - 1);
  if (q) query = query.ilike('name', `%${q}%`);
  if (status) query = query.eq('status', status);
  const result = await query;
  const products = (result.data ?? []).map((product) =>
    productPricing(normalizeAdminProduct(product)),
  );
  return (
    <>
      <AdminHeading title="Prices" description="Choose a product to update its price" />
      <form className="admin-filterbar">
        <div>
          <Search aria-hidden="true" />
          <Input
            name="q"
            aria-label="Search product names"
            defaultValue={q}
            placeholder="Search product names"
          />
        </div>
        <NativeSelect name="status" aria-label="Product visibility" defaultValue={status}>
          <NativeSelectOption value="">All products</NativeSelectOption>
          <NativeSelectOption value="active">Active</NativeSelectOption>
          <NativeSelectOption value="inactive">Inactive</NativeSelectOption>
        </NativeSelect>
        <Button variant="outline">Search</Button>
      </form>
      {result.error ? (
        <AdminNotice>Prices could not load. Refresh and try again.</AdminNotice>
      ) : products.length ? (
        <Card className="gap-0 overflow-hidden py-0">
          {products.map((product) => (
            <PriceEditor key={product.id} initial={product} />
          ))}
        </Card>
      ) : (
        <Card>
          <CardContent className="admin-empty">
            <h2>No products found</h2>
            <p>Change the filters or add products to set their prices</p>
          </CardContent>
        </Card>
      )}
      {!result.error ? (
        <Pagination
          page={page}
          count={result.count ?? 0}
          href={`/admin/prices?${new URLSearchParams({ q, status })}`}
        />
      ) : null}
    </>
  );
}
