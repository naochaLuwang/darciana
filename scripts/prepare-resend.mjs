import { readFile, writeFile, chmod } from 'node:fs/promises';
import { parseEnv } from 'node:util';
const contents = await readFile('.env.local', 'utf8');
const local = parseEnv(contents);
let saved = {};
try {
  saved = parseEnv(await readFile('.secrets/resend.env', 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const key = saved.RESEND_API_KEY || local.RESEND_API_KEY;
if (!key || key.length < 20 || !/^re_[A-Za-z0-9_-]+$/.test(key))
  throw new Error('Save the full, unmasked Resend API key in .secrets/resend.env first.');
const values = {
  RESEND_API_KEY: key,
  RESEND_FROM_EMAIL:
    saved.RESEND_FROM_EMAIL || local.RESEND_FROM_EMAIL || 'Daciana <noreply@dacianastore.in>',
  RESEND_REPLY_TO: saved.RESEND_REPLY_TO || local.RESEND_REPLY_TO || 'luwangtech0@gmail.com',
};
let next = contents;
for (const [name, value] of Object.entries(values)) {
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  const line = `${name}=${JSON.stringify(value)}`;
  next = pattern.test(next) ? next.replace(pattern, () => line) : `${next.trimEnd()}\n${line}\n`;
}
await writeFile('.env.local', next, { mode: 0o600 });
await chmod('.env.local', 0o600);
await writeFile(
  '.secrets/resend.env',
  Object.entries(values)
    .map(([name, value]) => `${name}=${value}`)
    .join('\n') + '\n',
  { mode: 0o600 },
);
await chmod('.secrets/resend.env', 0o600);
const secret = local.ORDER_PUSH_WEBHOOK_SECRET;
if (!secret || !/^[a-f0-9]{64}$/.test(secret))
  throw new Error('Prepare the order webhook secret first.');
const scripts = await Promise.all(
  ['order-email-setup.sql', 'order-email-webhook-setup.sql'].map((name) =>
    readFile(`supabase/${name}`, 'utf8'),
  ),
);
const vault = `\nbegin;\ndo $$ declare saved_id uuid; begin\nselect id into saved_id from vault.secrets where name='daciana_order_push_secret';\nif saved_id is null then\nperform vault.create_secret('${secret}','daciana_order_push_secret','Daciana order webhook authentication');\nelse\nperform vault.update_secret(saved_id,'${secret}','daciana_order_push_secret','Daciana order webhook authentication');\nend if;\nend $$;\ncommit;\n`;
await writeFile(
  '.secrets/email-setup.sql',
  '-- Private setup. Contains a webhook secret; do not commit or share.\n' +
    scripts.join('\n') +
    vault,
  { mode: 0o600 },
);
await chmod('.secrets/email-setup.sql', 0o600);
console.log(
  'Prepared Resend server environment and private order-email SQL. No secret values printed.',
);
