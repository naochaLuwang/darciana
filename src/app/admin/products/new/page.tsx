import { adminSession } from '@/lib/admin';
import { AdminHeading, AdminNotice } from '@/components/admin/common';
import { ProductEditor } from '@/components/admin/product-editor';
export const metadata = { title: 'Add product' };
export default async function NewProduct() {
  const session = await adminSession();
  if (!session) return null;
  const result = await session.db
    .from('categories')
    .select('id,name,slug,parent_id,image_url')
    .order('name')
    .limit(1000);
  return (
    <>
      <AdminHeading
        title="Add a lovely new find"
        description="Create the product, its options, stock, and category links in one save."
      />
      {result.error ? (
        <AdminNotice>Categories could not load. Try again before creating a product.</AdminNotice>
      ) : (
        <ProductEditor categories={result.data ?? []} />
      )}
    </>
  );
}
