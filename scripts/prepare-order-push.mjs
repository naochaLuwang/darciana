import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
let contents = '';
try {
  contents = await readFile('.env.local', 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const local = parseEnv(contents);
let saved = {};
try {
  saved = parseEnv(await readFile('.secrets/order-push-webhook.env', 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const secret =
  local.ORDER_PUSH_WEBHOOK_SECRET ||
  saved.ORDER_PUSH_WEBHOOK_SECRET ||
  randomBytes(32).toString('hex');
if (!/^[a-f0-9]{64}$/.test(secret))
  throw Error('ORDER_PUSH_WEBHOOK_SECRET must be a 64-character hexadecimal secret.');
await mkdir('.secrets', { recursive: true, mode: 0o700 });
await chmod('.secrets', 0o700);
if (!local.ORDER_PUSH_WEBHOOK_SECRET)
  await writeFile('.env.local', `${contents.trimEnd()}\nORDER_PUSH_WEBHOOK_SECRET=${secret}\n`, {
    mode: 0o600,
  });
await writeFile('.secrets/order-push-webhook.env', `ORDER_PUSH_WEBHOOK_SECRET=${secret}\n`, {
  mode: 0o600,
});
const scripts = await Promise.all(
  ['push-setup.sql', 'admin-order-push-setup.sql', 'order-push-webhook-setup.sql'].map((name) =>
    readFile(`supabase/${name}`, 'utf8'),
  ),
);
const vault = `\nbegin;\ndo $$ declare saved_id uuid; begin\nselect id into saved_id from vault.secrets where name='daciana_order_push_secret';\nif saved_id is null then\nperform vault.create_secret('${secret}','daciana_order_push_secret','Daciana new-order webhook authentication');\nelse\nperform vault.update_secret(saved_id,'${secret}','daciana_order_push_secret','Daciana new-order webhook authentication');\nend if;\nend $$;\ncommit;\n`;
await writeFile(
  '.secrets/notifications-setup.sql',
  '-- Private setup: contains a webhook secret. Do not commit or share.\n' +
    scripts.join('\n') +
    vault,
  { mode: 0o600 },
);
await chmod('.secrets/order-push-webhook.env', 0o600);
await chmod('.secrets/notifications-setup.sql', 0o600);
console.log(
  'Prepared private SQL setup and server environment files. No secret values printed. Existing webhook secret retained.',
);
