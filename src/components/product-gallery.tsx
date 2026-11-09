'use client';

import { useRef, useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { GalleryImage } from '@/lib/product-media';
import { ProductImage } from './product-card';

export function ProductGallery({
  images,
  label,
  variant,
  error,
}: {
  images: GalleryImage[];
  label: string;
  variant: boolean;
  error?: string | null;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const thumbnails = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const index = Math.min(activeIndex, Math.max(0, images.length - 1));
  const active = images[index];
  const multiple = images.length > 1;
  function selectPhoto(next: number) {
    const selected = Math.max(0, Math.min(images.length - 1, next));
    setActiveIndex(selected);
    const strip = thumbnails.current;
    const thumbnail = strip?.children[selected] as HTMLElement | undefined;
    if (strip && thumbnail)
      strip.scrollTo({
        left: thumbnail.offsetLeft - (strip.clientWidth - thumbnail.offsetWidth) / 2,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
  }
  return (
    <figure
      className="detail-gallery"
      role="region"
      aria-label={`${label} photos`}
      aria-roledescription="carousel"
    >
      <div
        className="detail-photo tint-0 gallery-stage"
        role="group"
        aria-label="Current product photo"
        tabIndex={multiple ? 0 : undefined}
        onDragStart={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || !multiple) return;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            selectPhoto(index + (event.key === 'ArrowRight' ? 1 : -1));
          }
        }}
        onPointerDown={(event) => {
          if (!event.isPrimary || (event.target as Element).closest('button')) {
            gesture.current = null;
            return;
          }
          gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          gesture.current = null;
        }}
        onPointerUp={(event) => {
          const start = gesture.current;
          gesture.current = null;
          if (!start || start.id !== event.pointerId || !multiple) return;
          const dx = event.clientX - start.x,
            dy = event.clientY - start.y;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4)
            selectPhoto(index + (dx < 0 ? 1 : -1));
        }}
      >
        <ProductImage
          src={active?.url ?? null}
          alt={active ? `${active.alt || label} — photo ${index + 1} of ${images.length}` : label}
          eager
        />
        {multiple ? (
          <div className="gallery-controls">
            <button
              type="button"
              aria-label="Previous photo"
              disabled={index === 0}
              onClick={() => selectPhoto(index - 1)}
            >
              <ChevronLeft size={21} />
            </button>
            <span className="gallery-count" aria-live="polite" aria-atomic="true">
              {index + 1} / {images.length}
            </span>
            <button
              type="button"
              aria-label="Next photo"
              disabled={index === images.length - 1}
              onClick={() => selectPhoto(index + 1)}
            >
              <ChevronRight size={21} />
            </button>
          </div>
        ) : null}
      </div>
      {multiple ? (
        <div
          className="gallery-thumbnails"
          ref={thumbnails}
          role="group"
          aria-label="Choose a product photo"
        >
          {images.map((image, imageIndex) => (
            <button
              type="button"
              key={image.url}
              aria-label={`Show photo ${imageIndex + 1} of ${images.length}`}
              aria-pressed={index === imageIndex}
              onClick={() => selectPhoto(imageIndex)}
            >
              <span aria-hidden="true">
                <ProductImage src={image.url} alt="" />
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {!images.length ? (
        <figcaption className="gallery-empty">
          {variant ? 'Photos unavailable for this option' : 'Photo unavailable'}
        </figcaption>
      ) : null}
      {error ? (
        <p className="gallery-error" role="status">
          {error}
          <button
            type="button"
            className="text-link"
            disabled={pending}
            onClick={() => startTransition(() => router.refresh())}
          >
            Retry
          </button>
        </p>
      ) : null}
    </figure>
  );
}
