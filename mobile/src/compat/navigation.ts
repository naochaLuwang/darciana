import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { refreshScreens } from '../query';
import { RouteRedirect, RouteNotFound } from '../navigation';

export function usePathname() {
  return useLocation().pathname;
}
export function useSearchParams() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}
export function useRouter() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      push: (path: string) => {
        void navigate(path);
      },
      replace: (path: string) => {
        void navigate(path, { replace: true });
      },
      back: () => {
        void navigate(-1);
      },
      refresh: refreshScreens,
    }),
    [navigate],
  );
}
export function redirect(path: string): never {
  throw new RouteRedirect(path);
}
export function notFound(): never {
  throw new RouteNotFound('Page not found');
}
