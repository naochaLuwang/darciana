import { Bag } from '@/components/bag';
export const metadata = { title: 'Your shopping bag' };
export default function BagPage() {
  return (
    <main id="main" className="page-width section-space">
      <Bag />
    </main>
  );
}
