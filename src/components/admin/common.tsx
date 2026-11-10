import Link from 'next/link';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
export function AdminHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="admin-page-heading">
      <div className="min-w-0 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function AdminNotice({ children }: { children: React.ReactNode }) {
  return (
    <Alert className="border-amber-200 bg-amber-50/60">
      <Info />
      <AlertDescription className="text-amber-950">{children}</AlertDescription>
    </Alert>
  );
}
export function StatusBadge({ status, children }: { status: string; children?: React.ReactNode }) {
  const positive = ['active', 'completed', 'confirmed', 'sent', 'in_stock'].includes(status);
  const warning = ['awaiting_confirmation', 'low', 'pending'].includes(status);
  const negative = ['cancelled', 'failed', 'out_of_stock'].includes(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        'admin-status rounded-md font-normal capitalize',
        status,
        positive
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : warning
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : negative
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-border bg-muted/60 text-muted-foreground',
      )}
    >
      {children ?? status.replaceAll('_', ' ')}
    </Badge>
  );
}
export function Pagination({
  page,
  count,
  size = 25,
  href,
}: {
  page: number;
  count: number;
  size?: number;
  href: string;
}) {
  const pages = Math.max(1, Math.ceil(count / size));
  return (
    <div className="admin-pagination">
      <span className="text-xs text-muted-foreground">
        {count} records · Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`${href}&page=${page - 1}`}>
              <ArrowLeft />
              Previous
            </Link>
          </Button>
        ) : null}
        {page < pages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`${href}&page=${page + 1}`}>
              Next
              <ArrowRight />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
export function pageNumber(value: string | undefined) {
  const page = Number(value || 1);
  return Number.isInteger(page) && page > 0 && page <= 10000 ? page : 1;
}
export const adminDate = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
