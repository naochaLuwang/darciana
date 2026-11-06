export function navigateApp(path: string, replace = false) {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid app route.');
  window.dispatchEvent(new CustomEvent('daciana:navigate', { detail: { path, replace } }));
}

export class RouteRedirect extends Error {
  constructor(public path: string) {
    super('Route redirect');
  }
}
export class RouteNotFound extends Error {}

export function notify(message: string) {
  window.dispatchEvent(new CustomEvent('daciana:notice', { detail: message }));
}
