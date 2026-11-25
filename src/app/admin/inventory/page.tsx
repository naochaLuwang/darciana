import { AdminCheck } from '@/components/admin/form-controls';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { adminSession } from '@/lib/admin';
import { categoryTreeIds, type Category } from '@/lib/commerce';
import { AdminHeading, AdminNotice, Pagination, pageNumber } from '@/components/admin/common';
import { InventoryList, type InventoryProduct } from '@/components/admin/inventory-list';
export const metadata = { title: 'Inventory' };
export default async function Inventory({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; low?: string; page?: string; category?: string }>;
}) {
  const session = await adminSession();
  if (!session) return null;
  const params = await searchParams;
  const page = pageNumber(params.page);
  const q = (params.q ?? '').trim().slice(0, 80);
  const low = params.low === 'true';
  const categoryResult = await session.db
    .from('categories')
    .select('id,name,slug,parent_id,image_url')
    .order('name')
    .order('id');
  if (categoryResult.error)
    return (
      <>
        <AdminHeading
          title="Inventory"
          description="Find active products and update stock for each variant."
        />
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
    .select(
      `id,name,has_variants,product_variants${low ? '!inner' : ''}(id,title,stock,updated_at)${category ? ',inventory_category:product_categories()' : ''}`,
      {
        count: 'exact',
      },
    )
    .eq('status', 'active')
    .order('name')
    .order('id')
    .range((page - 1) * 25, page * 25 - 1);
  if (q) query = query.ilike('name', `%${q}%`);
  if (low) query = query.lte('product_variants.stock', 5);
  if (category)
    query = query
      .in('inventory_category.category_id', categoryIds)
      .or(`category_id.in.(${categoryIds.join(',')}),inventory_category.not.is.null`);
  const result = await query;
  const products = (result.data ?? []) as unknown as InventoryProduct[];
  return (
    <>
      <AdminHeading
        title="Inventory"
        description="Find active products and update stock for each variant."
      />
      <Card className="admin-inventory gap-0 overflow-hidden py-0">
        <form
          key={`${q}:${low}:${category}`}
          action="/admin/inventory"
          className="admin-filterbar admin-inventory-filters"
        >
          <div>
            <Search aria-hidden="true" />
            <Input
              name="q"
              type="search"
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
          <div className="min-w-fit">
            <AdminCheck
              name="low"
              value="true"
              defaultChecked={low}
              label="Low stock only (5 or fewer)"
            />
          </div>
          <Button>Search</Button>
          {q || low || category ? (
            <Link href="/admin/inventory" className="text-link">
              Clear filters
            </Link>
          ) : null}
        </form>
        {result.error ? (
          <div className="p-5">
            <AdminNotice>Inventory could not load. Check your admin setup and refresh.</AdminNotice>
          </div>
        ) : (
          <>
            <InventoryList
              key={`${q}:${low}:${category}:${page}`}
              products={products}
              filtered={!!q || low || !!category}
            />
            <Pagination
              page={page}
              count={result.count ?? 0}
              href={`/admin/inventory?${new URLSearchParams({ q, low: String(low), category })}`}
            />
          </>
        )}
      </Card>
    </>
  );
}
