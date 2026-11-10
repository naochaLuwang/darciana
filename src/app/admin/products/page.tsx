import { StatusBadge } from '@/components/admin/common';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { adminSession, adminProductSelect, normalizeAdminProduct } from '@/lib/admin';
import { money, startingPrice } from '@/lib/commerce';
import { AdminHeading, AdminNotice, Pagination, pageNumber } from '@/components/admin/common';
import { ProductImage } from '@/components/product-card';
import { DeleteProduct } from '@/components/admin/delete-product';
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
        description="Products, pricing and availability"
        action={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus size={17} /> Add product
            </Link>
          </Button>
        }
      />
      <form className="admin-filterbar">
        <div>
          <Search size={18} />
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
        <AdminNotice>Products could not load. Check your admin setup and try again.</AdminNotice>
      ) : (
        <Card className="admin-table-panel gap-0 overflow-hidden py-0">
          <div className="min-w-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Options</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Link className="admin-product-cell" href={`/admin/products/${product.id}`}>
                        <span className="admin-thumbnail">
                          <ProductImage src={product.thumbnail_url} alt="" />
                        </span>
                        <span>
                          <strong>{product.name}</strong>
                          <small>{product.brand || 'No brand'}</small>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={product.status}>{product.status}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      {product.has_variants ? 'From ' : ''}
                      {money(startingPrice(product))}
                    </TableCell>
                    <TableCell>
                      {product.product_variants.reduce((sum, variant) => sum + variant.stock, 0)}
                    </TableCell>
                    <TableCell>{product.product_variants.length}</TableCell>
                    <TableCell>
                      <div className="admin-product-actions">
                        <Link className="text-link" href={`/admin/products/${product.id}`}>
                          Edit →
                        </Link>
                        <DeleteProduct
                          id={product.id}
                          name={product.name}
                          updatedAt={product.updated_at}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
        </Card>
      )}
    </>
  );
}
