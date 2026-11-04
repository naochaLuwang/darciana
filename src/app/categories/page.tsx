import Link from 'next/link';
import { ArrowRight, Flower2, BookOpen } from 'lucide-react';
import { getCatalog } from '@/lib/catalog';
import { categoryTreeIds } from '@/lib/commerce';
import { ProductImage } from '@/components/product-card';
export const metadata = { title: 'Categories' };
export default async function CategoriesPage() {
  const { products, categories, error } = await getCatalog();
  const roots = categories.filter((category) => !category.parent_id);
  return (
    <main id="main" className="page-width categories-screen">
      <div className="screen-intro">
        <h1>Shop by category</h1>
      </div>
      {error ? (
        <div className="notice" role="alert">
          {error}
        </div>
      ) : (
        roots.map((root) => {
          const ids = categoryTreeIds(categories, root.id);
          const rootProducts = products.filter((product) =>
            product.categoryIds.some((id) => ids.includes(id)),
          );
          const children = categories.filter((category) => category.parent_id === root.id);
          const Icon = root.slug === 'stationery' ? BookOpen : Flower2;
          return (
            <section
              className={`category-group ${root.slug === 'stationery' ? 'stationery-group' : ''}`}
              key={root.id}
            >
              <Link href={`/shop?category=${root.slug}`} className="category-group-header">
                <span className="category-group-icon">
                  <Icon size={24} strokeWidth={1.5} />
                </span>
                <div>
                  <h2>{root.name.charAt(0).toUpperCase() + root.name.slice(1).toLowerCase()}</h2>
                  <p>{rootProducts.length} products</p>
                </div>
                <span className="text-link">
                  Shop all <ArrowRight size={16} />
                </span>
              </Link>
              <div className="category-tile-grid">
                {children.map((category) => {
                  const childIds = categoryTreeIds(categories, category.id);
                  const fallback = products.find((product) =>
                    product.categoryIds.some((id) => childIds.includes(id)),
                  );
                  return (
                    <Link
                      key={category.id}
                      href={`/shop?category=${category.slug}`}
                      className="category-tile"
                    >
                      <span className="category-tile-image">
                        <ProductImage
                          src={category.image_url || fallback?.thumbnail_url || null}
                          alt={category.name}
                        />
                      </span>
                      <span>
                        {category.name.charAt(0).toUpperCase() +
                          category.name.slice(1).toLowerCase()}
                      </span>
                    </Link>
                  );
                })}
              </div>
              {!children.length ? (
                <Link className="category-empty-link" href={`/shop?category=${root.slug}`}>
                  Explore {root.name.toLowerCase()} <ArrowRight size={17} />
                </Link>
              ) : null}
            </section>
          );
        })
      )}
      <Link className="button button-outline browse-everything" href="/shop">
        All products <ArrowRight size={17} />
      </Link>
    </main>
  );
}
