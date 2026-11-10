import { notFound } from 'next/navigation';
import { z } from 'zod';
import { adminSession, adminProductSelect, normalizeAdminProduct } from '@/lib/admin';
import { AdminHeading, AdminNotice } from '@/components/admin/common';
import { ProductEditor } from '@/components/admin/product-editor';
export const metadata = { title: 'Edit product' };
export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const session = await adminSession();
  if (!session) return null;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [product, categories] = await Promise.all([
    session.db.from('products').select(adminProductSelect).eq('id', id).maybeSingle(),
    session.db
      .from('categories')
      .select('id,name,slug,parent_id,image_url')
      .order('name')
      .limit(1000),
  ]);
  if (product.error || categories.error)
    return <AdminNotice>This product could not load. Refresh and try again.</AdminNotice>;
  if (!product.data) notFound();
  return (
    <>
      <AdminHeading title="Edit product" description="Update details, pricing and stock" />
      <ProductEditor
        initial={normalizeAdminProduct(product.data)}
        categories={categories.data ?? []}
      />
    </>
  );
}
