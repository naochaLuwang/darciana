import Link from 'next/link';
import Image from 'next/image';
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
import { ShareApp } from '@/components/share-app';
import appPackage from '../../../package.json';
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
      <div className="more-brand">
        <Image src="/branding/daciana-monogram.png" alt="" width={56} height={56} />
        <div className="more-brand-copy">
          <p className="more-brand-name">daciana</p>
          <p className="more-brand-category">Cosmetics & stationery</p>
        </div>
      </div>
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
          <section
            className="more-section"
            key={section}
            data-section={section}
            aria-labelledby={`more-${section}`}
          >
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
                      <span className="more-link-icon" aria-hidden="true">
                        <Icon size={18} strokeWidth={1.6} />
                      </span>
                      <span className="more-link-label">{page.title}</span>
                      <ChevronRight size={16} aria-hidden="true" />
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
      <section className="more-section" data-section="app" aria-labelledby="more-app">
        <h2 id="more-app">App</h2>
        <div className="more-links">
          <ShareApp />
        </div>
      </section>
      <footer className="more-footer">
        <p className="more-version">Version {appPackage.version}</p>
        <p className="more-credit">
          Designed & developed by <strong>Luwang Tech</strong>
        </p>
      </footer>
    </main>
  );
}
