import { Search } from 'lucide-react';
import Link from 'next/link';
import { adminSession, adminProductSelect, normalizeAdminProduct } from '@/lib/admin';
import { categoryTreeIds, type Category } from '@/lib/commerce';
import { productPricing } from '@/lib/product-pricing';
import { AdminHeading, AdminNotice, Pagination, pageNumber } from '@/components/admin/common';
import { PricingList } from '@/components/admin/pricing-list';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Card } from '@/components/ui/card';
export const metadata = { title: 'Prices' };
export default async function PricesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; category?: string }>;
}) {
  const session = await adminSession();
  if (!session) return null;
  const params = await searchParams;
  const page = pageNumber(params.page);
  const q = (params.q ?? '').trim().slice(0, 80);
  const status = ['active', 'inactive'].includes(params.status ?? '') ? params.status! : '';
  const categoryResult = await session.db
    .from('categories')
    .select('id,name,slug,parent_id,image_url')
    .order('name')
    .order('id');
  if (categoryResult.error)
    return (
      <>
        <AdminHeading title="Prices" description="Manage product and variant prices." />
        <AdminNotice>Categories could not load. Refresh and try again.</AdminNotice>
      </>
    );
  const categories = (categoryResult.data ?? []) as Category[];
  const category = categories.some((item) => item.id === params.category) ? params.category! : '';
  const categoryIds = category ? categoryTreeIds(categories, category) : [];
  const categoryMap = new Map(categories.map((item) => [item.id, item]));
  function categoryLabel(item: Category) {
    const names: string[] = [];
    const visited = new Set<string>();
    let current: Category | undefined = item;
    while (current && !visited.has(current.id)) {
      names.unshift(current.name);
      visited.add(current.id);
      current = current.parent_id ? categoryMap.get(current.parent_id) : undefined;
    }
    return names.join(' / ');
  }
  let query = session.db
    .from('products')
    .select(`${adminProductSelect}${category ? ',inventory_category:product_categories()' : ''}`, {
      count: 'exact',
    })
    .order('name')
    .order('id')
    .range((page - 1) * 25, page * 25 - 1);
  if (q) query = query.ilike('name', `%${q}%`);
  if (status) query = query.eq('status', status);
  if (category)
    query = query
      .in('inventory_category.category_id', categoryIds)
      .or(`category_id.in.(${categoryIds.join(',')}),inventory_category.not.is.null`);
  const result = await query.overrideTypes<Record<string, unknown>[], { merge: false }>();
  const products = (result.data ?? []).map((product) =>
    productPricing(normalizeAdminProduct(product)),
  );
  return (
    <>
      <AdminHeading
        title="Prices"
        description="Update prices and discounts for products and variants."
      />
      <Card className="admin-pricing gap-0 overflow-hidden py-0">
        <form
          key={`${q}:${status}:${category}`}
          action="/admin/prices"
          className="admin-filterbar admin-inventory-filters"
        >
          <div>
            <Search aria-hidden="true" />
            <Input
              type="search"
              name="q"
              aria-label="Search product names"
              defaultValue={q}
              placeholder="Search by product name"
            />
          </div>
          <NativeSelect
            name="category"
            aria-label="Filter by category"
            title="Category (includes subcategories)"
            defaultValue={category}
          >
            <NativeSelectOption value="">All categories</NativeSelectOption>
            {categories.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {categoryLabel(item)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect name="status" aria-label="Product visibility" defaultValue={status}>
            <NativeSelectOption value="">All products</NativeSelectOption>
            <NativeSelectOption value="active">Active</NativeSelectOption>
            <NativeSelectOption value="inactive">Inactive</NativeSelectOption>
          </NativeSelect>
          <Button>Search</Button>
          {(q || status || category) && (
            <Link className="text-link" href="/admin/prices">
              Clear filters
            </Link>
          )}
        </form>
        {result.error ? (
          <div className="p-5">
            <AdminNotice>Prices could not load. Refresh and try again.</AdminNotice>
          </div>
        ) : (
          <>
            {products.length ? (
              <PricingList key={`${q}:${status}:${category}:${page}`} products={products} />
            ) : (
              <div className="admin-empty">
                <h2>No products found</h2>
                <p>Try another product name or clear the filters.</p>
              </div>
            )}
            <Pagination
              page={page}
              count={result.count ?? 0}
              href={`/admin/prices?${new URLSearchParams({ q, status, category })}`}
            />
          </>
        )}
      </Card>
    </>
  );
}
