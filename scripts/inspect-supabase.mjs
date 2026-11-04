import { loadEnvFile } from 'node:process';
loadEnvFile('.env.local');
await Promise.all(
  [
    'products?select=id,name,product_variants(id,price,stock),product_categories(category_id)&status=eq.active&limit=2',
    'product_categories?select=*&limit=3',
  ].map(async (path) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    });
    console.log(JSON.stringify({ path, status: response.status, data: await response.json() }));
  }),
);
