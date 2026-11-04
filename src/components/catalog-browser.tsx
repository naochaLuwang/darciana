'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Search, SlidersHorizontal, Heart, X, ArrowRight } from 'lucide-react';
import { categoryTreeIds, startingPrice, type Category, type Product } from '@/lib/commerce';
import { ProductCard } from './product-card';
import { useShop } from './shop-provider';

export function CatalogBrowser({
  products,
  categories,
  error,
  initialCategory,
  initialSearch,
  initialSort,
  onlySaved,
}: {
  products: Product[];
  categories: Category[];
  error: string | null;
  initialCategory: string;
  initialSearch: string;
  initialSort: string;
  onlySaved: boolean;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState(initialSort || 'newest');
  const [available, setAvailable] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { saved } = useShop();
  const selected = categories.find((item) => item.slug === category);
  const ids = selected ? categoryTreeIds(categories, selected.id) : [];
  const ordered = products
    .filter(
      (product) =>
        (!ids.length || product.categoryIds.some((id) => ids.includes(id))) &&
        (!onlySaved || saved.includes(product.id)) &&
        (!available || product.product_variants.some((variant) => variant.stock > 0)) &&
        `${product.name} ${product.brand ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase().trim()),
    )
    .sort((a, b) =>
      sort === 'price-low'
        ? startingPrice(a) - startingPrice(b)
        : sort === 'price-high'
          ? startingPrice(b) - startingPrice(a)
          : sort === 'name'
            ? a.name.localeCompare(b.name)
            : Date.parse(b.created_at) - Date.parse(a.created_at),
    );
  const roots = categories.filter((item) => !item.parent_id);
  const filtered = !!(category || search || available);
  const emptySaved = onlySaved && !products.some((product) => saved.includes(product.id));
  function clearFilters() {
    setCategory('');
    setSearch('');
    setAvailable(false);
    setSort('newest');
  }
  return (
    <>
      <div className="shop-title">
        <h1>
          {onlySaved
            ? 'Saved items'
            : selected
              ? `${selected.name.charAt(0).toUpperCase()}${selected.name.slice(1).toLowerCase()}`
              : 'All products'}
        </h1>
      </div>
      {!emptySaved ? (
        <>
          <div className="app-search catalog-search">
            <Search size={20} />
            <label className="sr-only" htmlFor="product-search">
              Search products
            </label>
            <input
              id="product-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={onlySaved ? 'Search saved items' : 'Search by name or brand'}
              enterKeyHint="search"
            />
            {search ? (
              <button onClick={() => setSearch('')} aria-label="Clear search">
                <X size={18} />
              </button>
            ) : null}
          </div>
          <div className="catalog-tabs" role="group" aria-label="Collections">
            <button
              className={!category ? 'selected' : ''}
              aria-pressed={!category}
              onClick={() => setCategory('')}
            >
              Shop all
            </button>
            {roots.map((item) => (
              <button
                className={category === item.slug ? 'selected' : ''}
                aria-pressed={category === item.slug}
                key={item.id}
                onClick={() => setCategory(item.slug)}
              >
                {item.name.charAt(0).toUpperCase() + item.name.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <div className="catalog-toolbar">
            <button
              className={`filter-toggle ${filtersOpen || available ? 'selected' : ''}`}
              aria-expanded={filtersOpen}
              aria-controls="catalog-filters"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal size={16} /> Filters
              {available ? <span className="filter-count">1</span> : null}
            </button>
            <label className="sort-control">
              <span>Sort by</span>
              <select
                aria-label="Sort products"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="name">Name: A–Z</option>
              </select>
            </label>
          </div>
          <div className="filter-panel" id="catalog-filters" hidden={!filtersOpen}>
            <label className="field-label" htmlFor="category">
              Category
              <select
                id="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.parent_id ? '— ' : ''}
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={available}
                onChange={(event) => setAvailable(event.target.checked)}
              />{' '}
              In stock only
            </label>
            <button className="text-link" onClick={() => setFiltersOpen(false)}>
              Done <X size={15} />
            </button>
          </div>
          <div className="catalog-result-summary" aria-live="polite">
            <span>
              {ordered.length} {ordered.length === 1 ? 'product' : 'products'}
            </span>
            {filtered && ordered.length > 0 ? (
              <button className="text-link" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null}
          </div>
        </>
      ) : null}
      {error ? (
        <div className="notice" role="alert">
          {error}
        </div>
      ) : ordered.length ? (
        <div className="product-grid catalog-grid">
          {ordered.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} eager={index < 4} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">
            <Heart size={29} strokeWidth={1.5} />
          </span>
          <h2>{emptySaved ? 'No saved items yet' : 'No products found'}</h2>
          <p>
            {emptySaved
              ? 'Tap the heart on a product to save it.'
              : 'Try another search or clear filters.'}
          </p>
          {emptySaved ? (
            <Link href="/shop" className="button button-dark">
              Shop products <ArrowRight size={17} />
            </Link>
          ) : (
            <button className="button button-outline" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}
    </>
  );
}
