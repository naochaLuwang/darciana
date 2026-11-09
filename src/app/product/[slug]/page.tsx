import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCatalog } from '@/lib/catalog';
import { ProductDetail } from '@/components/product-detail';
import { ProductCard } from '@/components/product-card';
import { getProductMedia } from '@/lib/product-media-server';
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { products } = await getCatalog();
  return { title: products.find((product) => product.slug === slug)?.name ?? 'Product' };
}
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { products, error } = await getCatalog();
  if (error)
    return (
      <main id="main" className="page-width section-space">
        <div className="notice" role="alert">
          {error}
        </div>
      </main>
    );
  const product = products.find((product) => product.slug === slug);
  if (!product) notFound();
  const gallery = await getProductMedia(product.id);
  const related = products
    .filter(
      (item) =>
        item.id !== product.id &&
        (item.brand === product.brand ||
          item.categoryIds.some((id) => product.categoryIds.includes(id))),
    )
    .slice(0, 4);
  return (
    <main id="main" className="page-width">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/shop">Shop</Link>
        <span>/</span>
        <span>{product.brand || product.name}</span>
      </nav>
      <ProductDetail
        key={product.id}
        product={product}
        media={gallery.media}
        mediaError={gallery.error}
      />
      {related.length ? (
        <section className="section-space">
          <div className="section-heading">
            <h2>Related products</h2>
          </div>
          <div className="product-grid">
            {related.map((item, index) => (
              <ProductCard key={item.id} product={item} index={index} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
