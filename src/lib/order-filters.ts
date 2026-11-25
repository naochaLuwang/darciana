import { orderStatuses } from './order-status.ts';
export const activeOrderStatuses = orderStatuses.filter(
  (status) => status !== 'awaiting_confirmation' && status !== 'cancelled',
);

export type OrderFilters = {
  q: string;
  status: string;
  tab: 'pending' | 'active' | 'cancelled';
  payment: string;
  mode: string;
  from: string;
  to: string;
  sort: string;
  page: number;
  fromInstant: string | null;
  toInstant: string | null;
  error?: string;
};
export function parseOrderFilters(
  params: Record<string, string | string[] | undefined>,
): OrderFilters {
  const value = (key: string) => {
    const item = params[key];
    return (Array.isArray(item) ? item[0] : item) ?? '';
  };
  function date(text: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const parsed = new Date(`${text}T00:00:00Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.getUTCFullYear() > 0 &&
      parsed.toISOString().slice(0, 10) === text
    );
  }
  const from = value('from');
  const to = value('to');
  const invalid = (from && !date(from)) || (to && !date(to));
  const error = invalid
    ? 'Enter valid start and end dates.'
    : from && to && from > to
      ? 'The end date must be on or after the start date.'
      : undefined;
  const page = Number(value('page') || 1);
  const requestedStatus = value('status');
  const inferredTab =
    requestedStatus === 'cancelled'
      ? 'cancelled'
      : activeOrderStatuses.some((status) => status === requestedStatus)
        ? 'active'
        : 'pending';
  const tab = ['pending', 'active', 'cancelled'].includes(value('tab'))
    ? (value('tab') as OrderFilters['tab'])
    : inferredTab;
  return {
    q: value('q').trim().slice(0, 80),
    tab,
    status:
      tab === 'active' && activeOrderStatuses.some((status) => status === requestedStatus)
        ? requestedStatus
        : '',
    payment: ['paid', 'unpaid'].includes(value('payment')) ? value('payment') : '',
    mode: ['cash_on_delivery', 'manual_upi', 'unrecorded'].includes(value('mode'))
      ? value('mode')
      : '',
    sort: ['newest', 'oldest', 'highest_total', 'lowest_total'].includes(value('sort'))
      ? value('sort')
      : 'newest',
    from,
    to,
    error,
    page: Number.isInteger(page) && page >= 1 && page <= 10000 ? page : 1,
    fromInstant: !error && from ? new Date(`${from}T00:00:00+05:30`).toISOString() : null,
    toInstant:
      !error && to ? new Date(Date.parse(`${to}T00:00:00+05:30`) + 86400000).toISOString() : null,
  };
}
export function orderFilterHref(filters: OrderFilters, change: Partial<OrderFilters> = {}) {
  const next = { ...filters, ...change };
  const params = new URLSearchParams();
  for (const key of [
    'tab',
    'q',
    'status',
    'payment',
    'mode',
    'from',
    'to',
    'sort',
    'page',
  ] as const) {
    const value = next[key];
    if (value && !(key === 'sort' && value === 'newest') && !(key === 'page' && value === 1))
      params.set(key, String(value));
  }
  return `/admin/orders?${params}`;
}
export function orderQueryStatus(filters: OrderFilters) {
  return filters.tab === 'active'
    ? filters.status || 'active'
    : filters.tab === 'cancelled'
      ? 'cancelled'
      : 'awaiting_confirmation';
}
export function orderDatePresets(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const before = (days: number) =>
    new Date(Date.parse(`${today}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  return [
    { label: 'Today', from: today, to: today },
    { label: 'Last 7 days', from: before(6), to: today },
    { label: 'Last 30 days', from: before(29), to: today },
    { label: 'All time', from: '', to: '' },
  ];
}
