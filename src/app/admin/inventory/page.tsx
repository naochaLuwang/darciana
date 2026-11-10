import { AdminCheck } from '@/components/admin/form-controls';
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
      <AdminHeading title="Inventory" description="Stock levels for active products" />
      <form className="admin-filterbar">
        <Input name="q" aria-label="Search SKU" defaultValue={q} placeholder="Search by SKU" />
        <div className="min-w-fit">
          <AdminCheck name="low" value="true" defaultChecked={low} label="Low stock only (≤5)" />
        </div>
        <Button variant="outline">Apply filters</Button>
      </form>
      {result.error ? (
        <AdminNotice>Inventory could not load. Check your admin setup and refresh.</AdminNotice>
      ) : (
        <Card className="admin-table-panel gap-0 overflow-hidden py-0">
          <div className="min-w-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product & option</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead>Update stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link href={`/admin/products/${row.products.id}`}>
                        <strong>{row.products.name}</strong>
                        <small>{row.title}</small>
                      </Link>
                    </TableCell>
                    <TableCell className="admin-sku">{row.sku}</TableCell>
                    <TableCell>
                      <span
                        className={`admin-status ${row.stock === 0 ? 'inactive' : row.stock <= 5 ? 'low' : 'active'}`}
                      >
                        {row.stock === 0
                          ? 'Out of stock'
                          : row.stock <= 5
                            ? 'Low stock'
                            : 'In stock'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StockEditor id={row.id} stock={row.stock} updatedAt={row.updated_at} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
        </Card>
      )}
    </>
  );
}
