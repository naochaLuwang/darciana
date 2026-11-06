import { useEffect, useState, type ReactNode } from 'react';
import { Capacitor, SystemBars, SystemBarsStyle, type PluginListenerHandle } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Keyboard } from '@capacitor/keyboard';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from './supabase';
import { queryClient, refreshScreens } from './query';
import { completeAuthCallback } from './auth-flow';
import { updateConnection } from './network';

export function Runtime({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [online, setOnline] = useState(navigator.onLine);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const listener = (event: Event) => {
      const { path, replace } = (event as CustomEvent<{ path: string; replace: boolean }>).detail;
      void navigate(path, { replace });
    };
    const notice = (event: Event) => setMessage(String((event as CustomEvent).detail));
    window.addEventListener('daciana:navigate', listener);
    window.addEventListener('daciana:notice', notice);
    return () => {
      window.removeEventListener('daciana:navigate', listener);
      window.removeEventListener('daciana:notice', notice);
    };
  }, [navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document
      .querySelectorAll<HTMLDialogElement>('dialog[open]')
      .forEach((dialog) => dialog.close());
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(''), 6500);
    return () => clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    let disposed = false;
    const handles: PluginListenerHandle[] = [];
    const register = (promise: Promise<PluginListenerHandle>) => {
      void promise
        .then((handle) => (disposed ? handle.remove() : void handles.push(handle)))
        .catch(() => {});
    };
    const connection = (connected: boolean) => {
      updateConnection(connected);
      setOnline(connected);
      if (connected) {
        void queryClient.invalidateQueries({ queryKey: ['catalog'] });
        refreshScreens();
      }
    };
    const browserOnline = () => connection(navigator.onLine);
    window.addEventListener('online', browserOnline);
    window.addEventListener('offline', browserOnline);
    register(Network.addListener('networkStatusChange', (status) => connection(status.connected)));
    void Network.getStatus()
      .then((status) => {
        if (!disposed) connection(status.connected);
      })
      .catch(() => {});
    if (Capacitor.isNativePlatform()) {
      document.documentElement.dataset.native = 'true';
      void SystemBars.setStyle({ style: SystemBarsStyle.Dark }).catch(() => {});
      register(
        NativeApp.addListener('appUrlOpen', ({ url }) => {
          void completeAuthCallback(url).catch(() =>
            setMessage('Sign-in could not be completed. Please try again.'),
          );
        }),
      );
      register(
        NativeApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            supabase.auth.startAutoRefresh();
            void Network.getStatus().then((status) => connection(status.connected));
          } else supabase.auth.stopAutoRefresh();
        }),
      );
      register(
        Keyboard.addListener('keyboardDidShow', () => {
          document.documentElement.dataset.nativeKeyboard = 'open';
          document.documentElement.dataset.keyboard = 'open';
        }),
      );
      register(
        Keyboard.addListener('keyboardDidHide', () => {
          document.documentElement.dataset.nativeKeyboard = 'closed';
          document.documentElement.dataset.keyboard = 'closed';
        }),
      );
      void NativeApp.getLaunchUrl()
        .then((launch) => {
          if (launch?.url) return completeAuthCallback(launch.url);
        })
        .catch(() => setMessage('Sign-in could not be completed. Please try again.'));
      void SplashScreen.hide().catch(() => {});
    } else if (window.location.pathname === '/auth/callback') {
      void completeAuthCallback(window.location.href).catch(() =>
        setMessage('Sign-in could not be completed. Please try again.'),
      );
    }
    return () => {
      disposed = true;
      handles.forEach((handle) => {
        void handle.remove();
      });
      window.removeEventListener('online', browserOnline);
      window.removeEventListener('offline', browserOnline);
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let handle: PluginListenerHandle | undefined;
    void NativeApp.addListener('backButton', () => {
      const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
      if (dialog) {
        if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
        return;
      }
      if (document.documentElement.dataset.keyboard === 'open') {
        void Keyboard.hide();
        return;
      }
      if ((window.history.state?.idx ?? 0) > 0) {
        void navigate(-1);
        return;
      }
      if (location.pathname !== '/') {
        void navigate('/', { replace: true });
        return;
      }
      void NativeApp.minimizeApp();
    }).then((next) => {
      if (disposed) void next.remove();
      else handle = next;
    });
    return () => {
      disposed = true;
      void handle?.remove();
    };
  }, [navigate, location.pathname]);

  return (
    <div
      onSubmitCapture={(event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement) || form.method.toLowerCase() !== 'get') return;
        const action = form.getAttribute('action');
        if (!action?.startsWith('/') || action.startsWith('//')) return;
        event.preventDefault();
        const search = new URLSearchParams();
        new FormData(form).forEach((value, key) => {
          if (typeof value === 'string') search.append(key, value);
        });
        void navigate(`${action}?${search}`);
      }}
      onClickCapture={(event) => {
        const target = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
        if (!target || event.defaultPrevented) return;
        // A literal #main would otherwise replace HashRouter's route.
        if (target.getAttribute('href') === '#main') {
          event.preventDefault();
          const main = document.getElementById('main');
          main?.setAttribute('tabindex', '-1');
          main?.focus();
          main?.scrollIntoView();
          return;
        }
        if (!Capacitor.isNativePlatform()) return;
        const url = new URL(target.href, window.location.href);
        if (['https:', 'http:'].includes(url.protocol) && url.origin !== window.location.origin) {
          event.preventDefault();
          if (url.protocol === 'https:') void Browser.open({ url: url.href });
        }
      }}
    >
      {!online ? (
        <div className="native-offline" role="status">
          You’re offline. Your bag is saved on this device.
        </div>
      ) : null}
      {children}
      {message ? (
        <div className="native-notice" role="status">
          {message}
          <button type="button" onClick={() => setMessage('')}>
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}
