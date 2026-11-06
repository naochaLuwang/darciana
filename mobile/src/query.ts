import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
});

export function refreshScreens() {
  void queryClient.invalidateQueries({ queryKey: ['screen'] });
}

export function clearPrivateScreens() {
  void queryClient.cancelQueries({ queryKey: ['screen'] });
  queryClient.removeQueries({ queryKey: ['screen'] });
}
