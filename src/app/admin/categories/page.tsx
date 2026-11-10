import { Card, CardHeader } from '@/components/ui/card';
import Link from 'next/link';
import { adminSession } from '@/lib/admin';
import { AdminHeading, AdminNotice } from '@/components/admin/common';
import { CategoryEditor } from '@/components/admin/category-editor';
import { ProductImage } from '@/components/product-card';
export const metadata = { title: 'Categories' };
export default async function AdminCategories({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; saved?: string }>;
}) {
  const session = await adminSession();
  if (!session) return null;
  const params = await searchParams;
  const result = await session.db
    .from('categories')
    .select('id,name,slug,parent_id,image_url')
    .order('name')
    .limit(1000);
  const categories = result.data ?? [];
  const initial = categories.find((category) => category.id === params.edit);
  return (
    <>
      <AdminHeading
        title="Categories"
        description="Collections and subcategories for your storefront"
      />
      {params.saved === '1' ? (
        <p className="form-success" role="status">
          Category saved.
        </p>
      ) : null}
      {result.error ? (
        <AdminNotice>Categories could not load. Refresh and try again.</AdminNotice>
      ) : (
        <div className="admin-category-layout">
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="admin-panel-heading">
              <h2>Your collections</h2>
              <span>{categories.length} categories</span>
            </CardHeader>
            <div className="admin-category-list">
              {categories.map((category) => (
                <Link
                  href={`/admin/categories?edit=${category.id}`}
                  key={category.id}
                  aria-current={initial?.id === category.id ? 'true' : undefined}
                >
                  <span className="admin-thumbnail">
                    <ProductImage src={category.image_url} alt="" />
                  </span>
                  <div>
                    <strong>{category.name}</strong>
                    <small>
                      {category.parent_id
                        ? (categories.find((parent) => parent.id === category.parent_id)?.name ??
                          'Subcategory')
                        : 'Top-level category'}{' '}
                      · /{category.slug}
                    </small>
                  </div>
                  <span className="text-link">Edit</span>
                </Link>
              ))}
            </div>
            {!categories.length ? (
              <div className="admin-empty">
                <h3>No categories yet</h3>
                <p>Add your first collection to get started.</p>
              </div>
            ) : null}
          </Card>
          <CategoryEditor key={initial?.id ?? 'new'} initial={initial} categories={categories} />
        </div>
      )}
    </>
  );
}
