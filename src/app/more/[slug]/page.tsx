import { notFound } from 'next/navigation';
import { getStoreContent } from '@/lib/store-content-server';
import { contentSlug } from '@/lib/store-content';
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { pages } = await getStoreContent();
  return {
    title:
      pages.find((page) => contentSlug(page.key) === slug && page.visible)?.title ?? 'Information',
  };
}
export default async function InformationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { pages, error } = await getStoreContent();
  if (error)
    return (
      <main id="main" className="page-width section-space">
        <p className="notice" role="status">
          {error}
        </p>
      </main>
    );
  const page = pages.find(
    (page) => contentSlug(page.key) === slug && page.visible && page.content.trim(),
  );
  if (!page) notFound();
  return (
    <main id="main" className="page-width info-page">
      <h1>{page.title}</h1>
      <article className="info-content">{page.content}</article>
    </main>
  );
}
