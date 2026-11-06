import type { AnchorHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';

export default function AppLink({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  if (/^(https?:|mailto:|tel:|#)/i.test(href))
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  return (
    <Link to={href} {...props}>
      {children}
    </Link>
  );
}
