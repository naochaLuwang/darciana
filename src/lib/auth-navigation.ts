export const oauthDestinationCookie = 'darciana.oauth-next';

export function authDestination(next: string | undefined) {
  return next === 'checkout' ? '/checkout' : '/account';
}
