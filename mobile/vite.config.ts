import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const mobile = resolve(root, 'mobile');
const client = (path: string) => resolve(mobile, 'src', path);

function clientBoundary(): Plugin {
  return {
    name: 'daciana-mobile-server-boundary',
    enforce: 'pre',
    transformIndexHtml(html, context) {
      // Vite's development React preamble is inline. The installed Android
      // build retains the strict CSP and has no development preamble.
      return context.server
        ? html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]+>/, '')
        : html;
    },
    resolveId(source) {
      if (source === 'server-only' || /^next\/(headers|cache|server)$/.test(source))
        this.error(`Server module ${source} cannot be bundled into the native app.`);
    },
    load(id) {
      if (
        /\/src\/app\/admin\//.test(id) ||
        /\/src\/lib\/(admin|supabase\/server|store-content-server)\.ts$/.test(id)
      )
        this.error(`Server-only source cannot be bundled into the native app: ${id}`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'NEXT_PUBLIC_');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error('Set the public Supabase URL and publishable key before building the app.');
  if (!key.startsWith('sb_publishable_'))
    throw new Error('The mobile build requires a Supabase publishable key.');
  return {
    root: mobile,
    envDir: root,
    plugins: [react(), clientBoundary()],
    define: {
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(url),
      'process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(key),
    },
    resolve: {
      alias: [
        { find: 'next/link', replacement: client('compat/link.tsx') },
        { find: 'next/image', replacement: client('compat/image.tsx') },
        { find: 'next/navigation', replacement: client('compat/navigation.ts') },
        { find: '@/lib/supabase/server', replacement: client('supabase.ts') },
        ...[
          'catalog',
          'address-server',
          'profile-server',
          'shipping-server',
          'store-content-server',
          'product-media-server',
        ].map((name) => ({ find: `@/lib/${name}`, replacement: client('data.ts') })),
        ...['auth', 'account', 'checkout'].map((name) => ({
          find: `@/app/${name}/actions`,
          replacement: client(`actions/${name}.ts`),
        })),
        { find: '@/components/share-app', replacement: client('native-share.tsx') },
        { find: '@/components/push-settings', replacement: client('native-push-settings.tsx') },
        { find: '@/components/delete-account', replacement: client('native-delete-account.tsx') },
        { find: '@', replacement: resolve(root, 'src') },
      ],
    },
    build: { outDir: 'dist', emptyOutDir: true, sourcemap: false, target: 'es2022' },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  };
});
