import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="main" className="page-width empty-state">
      <h1>Page not found</h1>
      <Link href="/shop" className="button button-dark">
        Shop products →
      </Link>
    </main>
  );
}
