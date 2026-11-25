const appleIssuer = 'https://appleid.apple.com';
const appleClientId = 'com.luwangtech.daciana';
const encode = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
const decode = (value) => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')), (c) =>
    c.charCodeAt(0),
  );
};
const jsonPart = (value) => encode(new TextEncoder().encode(JSON.stringify(value)));

export function createAppleRevocation({
  keyId,
  privateKey,
  teamId = 'VJ6CZ336M8',
  fetcher = fetch,
}) {
  if (!keyId || !privateKey || !teamId) return null;
  return async ({ identityToken, authorizationCode, nonce, subject }) => {
    const now = Math.floor(Date.now() / 1000);
    const parts = identityToken.split('.');
    if (parts.length !== 3) throw new Error('Invalid Apple proof');
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    if (header.alg !== 'RS256' || typeof header.kid !== 'string')
      throw new Error('Invalid Apple key');
    const keysResponse = await fetcher(`${appleIssuer}/auth/keys`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!keysResponse.ok) throw new Error('Apple verification unavailable');
    const { keys } = await keysResponse.json();
    const jwk = keys?.find(
      (key) => key.kid === header.kid && key.alg === 'RS256' && key.use === 'sig',
    );
    if (!jwk) throw new Error('Unknown Apple key');
    const verificationKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      verificationKey,
      decode(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
    const hashedNonce = [...new Uint8Array(digest)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
    if (
      !valid ||
      claims.iss !== appleIssuer ||
      claims.aud !== appleClientId ||
      claims.sub !== subject ||
      claims.nonce !== hashedNonce ||
      !Number.isInteger(claims.iat) ||
      claims.iat < now - 300 ||
      claims.iat > now + 30 ||
      !Number.isInteger(claims.exp) ||
      claims.exp <= now
    )
      throw new Error('Confirm with the same Apple account again');

    // Generate a short-lived client secret on the server. The .p8 never leaves
    // server storage; there is no six-month static JWT to expire unnoticed.
    const signingKey = await crypto.subtle.importKey(
      'pkcs8',
      decode(privateKey.replace(/-----[\w ]+-----/g, '').replace(/\s/g, '')),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
    const unsigned = `${jsonPart({ alg: 'ES256', kid: keyId, typ: 'JWT' })}.${jsonPart({
      iss: teamId,
      sub: appleClientId,
      aud: appleIssuer,
      iat: now,
      exp: now + 300,
    })}`;
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      signingKey,
      new TextEncoder().encode(unsigned),
    );
    const clientSecret = `${unsigned}.${encode(new Uint8Array(signature))}`;
    const post = (path, body) =>
      fetcher(`${appleIssuer}/auth/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: appleClientId,
          client_secret: clientSecret,
          ...body,
        }),
        signal: AbortSignal.timeout(10000),
      });
    // Apple's single-use authorization code also prevents replaying deletion
    // proof. Check its owner before revoking any authorization.
    const exchange = await post('token', {
      code: authorizationCode,
      grant_type: 'authorization_code',
    });
    if (!exchange.ok) throw new Error('Apple authorization expired');
    const tokens = await exchange.json();
    const exchanged = JSON.parse(
      new TextDecoder().decode(decode(tokens.id_token?.split('.')[1] ?? '')),
    );
    if (exchanged.sub !== subject || exchanged.aud !== appleClientId || !tokens.refresh_token)
      throw new Error('Apple authorization does not match');
    const revoked = await post('revoke', {
      token: tokens.refresh_token,
      token_type_hint: 'refresh_token',
    });
    if (!revoked.ok) throw new Error('Apple revocation unavailable');
  };
}
