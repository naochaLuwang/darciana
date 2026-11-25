'use client';

import { useId, useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function OrderFiltersPanel({
  search,
  stage,
  actions,
  children,
  appliedCount,
  initiallyExpanded,
}: {
  search: ReactNode;
  stage: ReactNode;
  actions: ReactNode;
  children: ReactNode;
  appliedCount: number;
  initiallyExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const id = useId();
  return (
    <>
      <div className="admin-orders-filter-toolbar">
        {search}
        {stage}
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={expanded}
          aria-controls={id}
          aria-label={appliedCount ? `Filters, ${appliedCount} active` : 'Filters'}
          onClick={() => setExpanded((value) => !value)}
        >
          <SlidersHorizontal aria-hidden="true" />
          Filters
          {appliedCount ? (
            <span className="admin-orders-filter-count" aria-hidden="true">
              {appliedCount}
            </span>
          ) : null}
        </Button>
        {actions}
      </div>
      <div className="admin-orders-advanced" id={id} hidden={!expanded}>
        {children}
      </div>
    </>
  );
}
