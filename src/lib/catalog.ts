import 'server-only';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './supabase/config';
import type { Category, Product } from './commerce';
export const getCatalog = cache(async () => {
  const config = supabaseConfig();
  if (!config)
    return {
      products: [] as Product[],
      categories: [] as Category[],
      error: 'The shop is being set up. Please check back soon.',
    };
  const db = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [products, categories] = await Promise.all([
    db
      .from('products')
      .select(
        'id,name,slug,description,brand,category_id,has_variants,base_price,currency,thumbnail_url,discount_type,discount_value,created_at,product_variants(id,title,price,stock,image_url,hex_code,discount_type,discount_value,is_default),product_categories(category_id)',
      )
      .eq('status', 'active')
      .eq('currency', 'INR')
      .order('created_at', { ascending: false })
      .limit(1000),
    db.from('categories').select('id,name,slug,parent_id,image_url').order('name').limit(1000),
  ]);
  if (products.error || categories.error) {
    console.error('Catalog request failed', products.error?.code, categories.error?.code);
    return {
      products: [] as Product[],
      categories: [] as Category[],
      error: 'We couldn’t load the shop. Please refresh and try again.',
    };
  }
  return {
    products: (products.data ?? []).map(({ product_categories, ...product }) => ({
      ...product,
      categoryIds: [
        ...new Set([
          ...(product.category_id ? [product.category_id] : []),
          ...product_categories.map((link) => link.category_id),
        ]),
      ],
    })) as Product[],
    categories: (categories.data ?? []) as Category[],
    error: null,
  };
});
