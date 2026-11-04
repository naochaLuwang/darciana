import { getCatalog } from '@/lib/catalog';
import { CatalogBrowser } from '@/components/catalog-browser';
export const metadata = { title: 'Saved items' };
export default async function SavedPage() {
  const catalog = await getCatalog();
  return (
    <main id="main" className="page-width shop-page">
      <CatalogBrowser
        {...catalog}
        initialCategory=""
        initialSearch=""
        initialSort="newest"
        onlySaved
      />
    </main>
  );
}
