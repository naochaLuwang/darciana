import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminSkeletonScreen } from '@/components/screen-skeleton';
export function AdminScreenSkeleton({ screen }: { screen: AdminSkeletonScreen }) {
  const table = ['products', 'orders', 'inventory'].includes(screen);
  const fields = screen === 'product' ? 5 : screen === 'content' ? 4 : 3;
  const fieldCard = (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="space-y-5">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton
              className={
                screen === 'content' && index === fields - 1 ? 'h-40 w-full' : 'h-10 w-full'
              }
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
  const tableCard = (
    <Card className="gap-0 py-0">
      <div className="grid grid-cols-3 gap-6 border-b bg-muted/30 p-5">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-3 w-20" />
        ))}
      </div>
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className="grid grid-cols-3 items-center gap-6 border-b p-5 last:border-0">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </Card>
  );
  return (
    <div role="status" aria-busy="true" data-skeleton={`admin-${screen}`} className="space-y-6">
      <span className="sr-only">Loading {screen}</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        {table ? (
          <>
            <div className="flex gap-3">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-9 w-24" />
            </div>
            {tableCard}
          </>
        ) : screen === 'overview' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <Card key={index}>
                  <CardContent className="space-y-5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-9 w-16" />
                    <Skeleton className="h-3 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
              {tableCard}
              {fieldCard}
            </div>
          </>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_288px]">
            {fieldCard}
            <Card>
              <CardContent className="space-y-5">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
