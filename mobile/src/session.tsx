import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { clearPrivateScreens } from './query';

const Context = createContext<{ user: User | null; ready: boolean; error: string | null }>({
  user: null,
  ready: false,
  error: null,
});
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousUser = useRef<string | null>(null);
  useEffect(() => {
    let mounted = true;
    const update = (next: User | null) => {
      if (!mounted) return;
      if (previousUser.current !== (next?.id ?? null)) clearPrivateScreens();
      previousUser.current = next?.id ?? null;
      setUser(next);
      setReady(true);
    };
    // The local session identifies which screen to load; each data read/write
    // is still authorized by Supabase, and mutations verify the user remotely.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) =>
      update(session?.user ?? null),
    );
    supabase.auth
      .getSession()
      .then(({ data }) => update(data.session?.user ?? null))
      .catch(() => {
        if (mounted) {
          setError('Secure sign-in storage is unavailable. Restart the app and try again.');
          setReady(true);
        }
      });
    const reset = () => update(null);
    window.addEventListener('daciana:signed-out', reset);
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      window.removeEventListener('daciana:signed-out', reset);
    };
  }, []);
  return <Context.Provider value={{ user, ready, error }}>{children}</Context.Provider>;
}
export function useSession() {
  return useContext(Context);
}
