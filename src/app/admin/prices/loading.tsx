import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
export default function LoadingPrices() {
  return (
    <div role="status" aria-busy="true" className="space-y-6" data-skeleton="admin-prices">
      <span className="sr-only">Loading prices</span>
      <div aria-hidden="true" className="space-y-5">
        <div className="space-y-3">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-10 w-96 max-w-full" />
        <Card className="gap-0 overflow-hidden py-0">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="flex items-center gap-3 border-b p-4 last:border-0">
              <Skeleton className="h-12 w-11 shrink-0" />
              <Skeleton className="h-4 w-44 max-w-full flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
