import Link from 'next/link';
import { ArrowRight, Search, Sparkles, Flower2, BookOpen, Grid2X2 } from 'lucide-react';
import { getCatalog } from '@/lib/catalog';
import { ProductCard } from '@/components/product-card';
import { categoryTreeIds, type Product } from '@/lib/commerce';

export default async function Home() {
  const { products, categories, error } = await getCatalog();
  const ordered = [...products]
    .sort(
      (a, b) =>
        Number(b.product_variants.some((v) => v.stock > 0)) -
        Number(a.product_variants.some((v) => v.stock > 0)),
    )
    .filter((product) => !/^https?:\/\//i.test(product.name));
  const inCategory = (slug: string) => {
    const root = categories.find((category) => category.slug === slug);
    const ids = root ? categoryTreeIds(categories, root.id) : [];
    return ordered
      .filter((product) => product.categoryIds.some((id) => ids.includes(id)))
      .slice(0, 4);
  };
  const beauty = inCategory('cosmetics');
  const stationery = inCategory('stationery');
  const mixed = beauty
    .flatMap((product, index) => [product, stationery[index]])
    .filter((product): product is Product => !!product);
  const picks = [
    ...new Map(
      [...mixed, ...stationery, ...ordered].map((product) => [product.id, product]),
    ).values(),
  ].slice(0, 8);
  const shortcuts = [
    { title: 'Shop all', href: '/shop', icon: Grid2X2, color: 'lilac' },
    { title: 'Cosmetics', href: '/shop?category=cosmetics', icon: Flower2, color: 'pink' },
    { title: 'Stationery', href: '/shop?category=stationery', icon: BookOpen, color: 'green' },
    { title: 'New arrivals', href: '/shop?sort=newest', icon: Sparkles, color: 'peach' },
  ];
  return (
    <main id="main" className="home-screen page-width">
      <div className="home-welcome">
        <div>
          <h1>
            Beauty & <em>stationery</em>
          </h1>
        </div>
        <Flower2 size={29} strokeWidth={1.4} />
      </div>
      <div className="home-discovery">
        <form action="/shop" className="app-search">
          <Search size={20} />
          <input
            name="q"
            type="search"
            aria-label="Search products"
            placeholder="Search products"
            enterKeyHint="search"
          />
          <button type="submit" aria-label="Find products">
            <ArrowRight size={19} />
          </button>
        </form>
        <nav className="home-shortcuts" aria-label="Shop collections">
          {shortcuts.map(({ title, href, icon: Icon, color }) => (
            <Link key={title} href={href}>
              <span className={`shortcut-icon ${color}`}>
                <Icon size={26} strokeWidth={1.5} />
              </span>
              <span>{title}</span>
            </Link>
          ))}
        </nav>
      </div>
      <Link href="/shop" className="home-campaign">
        <div className="campaign-copy">
          <h2>
            Everyday
            <br />
            essentials.
          </h2>
          <span className="campaign-cta">
            Shop now <ArrowRight size={15} />
          </span>
        </div>
        <div className="campaign-art" aria-hidden="true">
          <span className="campaign-orbit" />
          <div className="campaign-notebook">
            <span>
              <em>notes</em>
            </span>
          </div>
          <div className="campaign-lipstick">
            <span />
            <div />
            <small>darciana</small>
          </div>
          <Flower2 className="campaign-flower" size={33} strokeWidth={1.1} />
        </div>
      </Link>
      <section className="home-picks" aria-labelledby="picks">
        <div className="section-heading">
          <div>
            <h2 id="picks">Explore products</h2>
          </div>
          <Link href="/shop" className="text-link">
            View all <ArrowRight size={15} />
          </Link>
        </div>
        {error ? (
          <div className="notice" role="alert">
            {error}
          </div>
        ) : picks.length ? (
          <div className="product-grid">
            {picks.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} eager={index < 4} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Sparkles />
            <h2>No products available.</h2>
          </div>
        )}
      </section>
    </main>
  );
}
