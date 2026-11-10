import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
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
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function AdminNotice({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="admin-notice">
      {children}
    </div>
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
      <span>
        {count} records · Page {page} of {pages}
      </span>
      <div>
        {page > 1 ? (
          <Link href={`${href}&page=${page - 1}`}>
            <ArrowLeft size={15} /> Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={`${href}&page=${page + 1}`}>
            Next <ArrowRight size={15} />
          </Link>
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
