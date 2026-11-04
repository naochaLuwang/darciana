// Inject the client factory so authorization and deletion can be tested locally
// without a service key or a connection to the live project.
export function createDeleteAccountHandler({ createClient, url, publicKey, secretKey }) {
  const reply = (status, body) => Response.json(body, { status });
  return async function handle(request) {
    if (request.method !== 'POST') return reply(405, { error: 'Method not allowed.' });
    if (!url || !publicKey || !secretKey)
      return reply(503, { error: 'Account deletion is unavailable. Try again later.' });
    const token = /^Bearer (.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!token) return reply(401, { error: 'Sign in again to delete your account.' });
    try {
      const options = { auth: { persistSession: false, autoRefreshToken: false } };
      const client = createClient(url, publicKey, options);
      const { data, error } = await client.auth.getUser(token);
      const user = data?.user;
      if (error || !user?.email)
        return reply(401, { error: 'Sign in again to delete your account.' });
      const body = await request.json().catch(() => null);
      if (
        body?.confirmation !== 'DELETE' ||
        typeof body?.password !== 'string' ||
        !body.password ||
        body.password.length > 128
      )
        return reply(400, { error: 'Enter your password and type DELETE to confirm.' });
      // Verify this account's password. Never accept an email or user ID from
      // the request body as the deletion target.
      const verified = await client.auth.signInWithPassword({
        email: user.email,
        password: body.password,
      });
      if (verified.error || verified.data?.user?.id !== user.id)
        return reply(400, { error: 'Incorrect password. Your account was not deleted.' });
      const admin = createClient(url, secretKey, options);
      const revoked = await admin.auth.admin.signOut(token, 'global');
      if (revoked.error)
        return reply(503, {
          error: 'Could not secure your sessions. Please sign in again and retry.',
        });
      const deleted = await admin.auth.admin.deleteUser(user.id);
      if (deleted.error)
        return reply(500, { error: 'Could not delete your account. Contact the store for help.' });
      return reply(200, { deleted: true });
    } catch {
      return reply(500, { error: 'Could not delete your account. Try again later.' });
    }
  };
}
