import Link from 'next/link';
import {
  ChevronRight,
  CircleHelp,
  FileText,
  Info,
  Mail,
  ShieldCheck,
  Truck,
  RotateCcw,
} from 'lucide-react';
import { getStoreContent } from '@/lib/store-content-server';
import { contentSlug } from '@/lib/store-content';
export const metadata = { title: 'More' };
const icons: Record<string, typeof Info> = {
  contact_us: Mail,
  about_us: Info,
  faq: CircleHelp,
  shipping_info: Truck,
  privacy_policy: ShieldCheck,
  return_policy: RotateCcw,
  terms_and_conditions: FileText,
};
export default async function MorePage() {
  const { pages, error } = await getStoreContent();
  return (
    <main id="main" className="page-width more-page">
      <h1 className="sr-only">More</h1>
      {error ? (
        <p className="notice" role="status">
          {error}
        </p>
      ) : null}
      {(['support', 'legal'] as const).map((section) => {
        const items = pages.filter(
          (page) => page.section === section && page.visible && page.content.trim(),
        );
        return (
          <section className="more-section" key={section} aria-labelledby={`more-${section}`}>
            <h2 id={`more-${section}`}>{section === 'support' ? 'Support & info' : 'Legal'}</h2>
            <div className="more-links">
              {items.length ? (
                items.map((page) => {
                  const Icon = icons[page.key] ?? (section === 'support' ? Info : FileText);
                  return (
                    <Link
                      className="more-link"
                      href={`/more/${contentSlug(page.key)}`}
                      key={page.key}
                    >
                      <Icon size={20} strokeWidth={1.6} />
                      <span>{page.title}</span>
                      <ChevronRight size={17} />
                    </Link>
                  );
                })
              ) : (
                <p className="more-empty">No information available yet.</p>
              )}
            </div>
          </section>
        );
      })}
    </main>
  );
}
