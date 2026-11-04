import { getCatalog } from '@/lib/catalog';
import { CatalogBrowser } from '@/components/catalog-browser';
import { redirect } from 'next/navigation';
export const metadata = { title: 'The shop' };
export default async function Shop({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [catalog, params] = await Promise.all([getCatalog(), searchParams]);
  const value = (name: string) =>
    typeof params[name] === 'string' ? (params[name] as string) : '';
  if (value('saved') === 'true') redirect('/saved');
  return (
    <main id="main" className="page-width shop-page">
      <CatalogBrowser
        {...catalog}
        initialCategory={value('category')}
        initialSearch={value('q')}
        initialSort={value('sort')}
        onlySaved={false}
        key={`${value('category')}-${value('q')}-${value('sort')}-${value('saved')}`}
      />
    </main>
  );
}
