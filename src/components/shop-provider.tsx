'use client';
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { parseCart, resolveCart, type CartItem, type Product, type CartLine } from '@/lib/commerce';
const CART_KEY = 'darciana.bag.v1';
const WISH_KEY = 'darciana.saved.v1';
const subscribe = (callback: () => void) => {
  window.addEventListener('storage', callback);
  window.addEventListener('darciana-storage', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('darciana-storage', callback);
  };
};
const snapshot = () => {
  try {
    return window.localStorage.getItem(CART_KEY) ?? '[]';
  } catch {
    return '[]';
  }
};
const wishesSnapshot = () => {
  try {
    return window.localStorage.getItem(WISH_KEY) ?? '[]';
  } catch {
    return '[]';
  }
};
const serverSnapshot = () => '[]';
function readJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event('darciana-storage'));
    return true;
  } catch {
    return false;
  }
}
type Shop = {
  products: Product[];
  items: CartItem[];
  lines: CartLine[];
  count: number;
  total: number;
  saved: string[];
  add: (productId: string, variantId: string, quantity?: number) => boolean;
  update: (variantId: string, quantity: number) => void;
  clear: () => void;
  toggleSaved: (id: string) => void;
};
const Context = createContext<Shop | null>(null);
export function ShopProvider({
  products,
  children,
}: {
  products: Product[];
  children: React.ReactNode;
}) {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const wishRaw = useSyncExternalStore(subscribe, wishesSnapshot, serverSnapshot);
  const items = parseCart(readJson(raw));
  const wished = readJson(wishRaw);
  const saved = Array.isArray(wished)
    ? wished.filter((id): id is string => typeof id === 'string')
    : [];
  const lines = resolveCart(items, products);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (message) {
      const id = setTimeout(() => setMessage(''), 3500);
      return () => clearTimeout(id);
    }
  }, [message]);
  function add(productId: string, variantId: string, quantity = 1) {
    const current = parseCart(readJson(snapshot()));
    const variant = products
      .find((product) => product.id === productId)
      ?.product_variants.find((variant) => variant.id === variantId);
    const existing = current.find((item) => item.variantId === variantId);
    if (
      !variant ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      (current.length >= 30 && !existing) ||
      (existing?.quantity ?? 0) + quantity > Math.min(10, variant.stock)
    ) {
      setMessage('That quantity is unavailable. Please check your bag.');
      return false;
    }
    const ok = write(
      CART_KEY,
      existing
        ? current.map((item) =>
            item.variantId === variantId ? { ...item, quantity: item.quantity + quantity } : item,
          )
        : [...current, { productId, variantId, quantity }],
    );
    setMessage(ok ? 'Added to bag' : 'Enable browser storage to save your bag.');
    return ok;
  }
  function update(variantId: string, quantity: number) {
    const current = parseCart(readJson(snapshot()));
    const line = resolveCart(current, products).find((line) => line.variantId === variantId);
    if (quantity > 0 && (!line || quantity > Math.min(10, line.variant.stock))) {
      setMessage('That quantity is unavailable.');
      return;
    }
    if (
      !write(
        CART_KEY,
        quantity <= 0
          ? current.filter((item) => item.variantId !== variantId)
          : current.map((item) => (item.variantId === variantId ? { ...item, quantity } : item)),
      )
    )
      setMessage('Enable browser storage to update your bag.');
  }
  const value = {
    products,
    items,
    lines,
    saved,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    total: Math.round(lines.reduce((sum, line) => sum + line.price * line.quantity, 0) * 100) / 100,
    add,
    update,
    clear: () => {
      write(CART_KEY, []);
    },
    toggleSaved: (id: string) => {
      if (
        !write(
          WISH_KEY,
          saved.includes(id) ? saved.filter((savedId) => savedId !== id) : [...saved, id],
        )
      )
        setMessage('Enable browser storage to save favourites.');
    },
  };
  return (
    <Context.Provider value={value}>
      {children}
      <div role="status" className={`toast ${message ? 'visible' : ''}`}>
        {message}
      </div>
    </Context.Provider>
  );
}
export function useShop() {
  const context = useContext(Context);
  if (!context) throw new Error('ShopProvider is required');
  return context;
}
