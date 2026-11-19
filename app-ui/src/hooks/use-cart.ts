import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "fekra_cart";
const CART_EVENT = "fekra:cart-changed";

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function write(set: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  window.dispatchEvent(new CustomEvent(CART_EVENT));
}

export function useCart() {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const sync = () => setIds(read());
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const add = useCallback((id: string) => {
    const next = new Set(read());
    if (next.has(id)) return;
    next.add(id);
    write(next);
    setIds(next);
    toast.success("تم إضافة الكورس للسلة 🛒", { id: `cart-${id}` });
  }, []);

  const remove = useCallback((id: string) => {
    const next = new Set(read());
    if (!next.delete(id)) return;
    write(next);
    setIds(next);
    toast.success("تم حذف الكورس من السلة", { id: `cart-${id}` });
  }, []);

  const toggle = useCallback((id: string) => {
    const next = new Set(read());
    const was = next.has(id);
    if (was) next.delete(id);
    else next.add(id);
    write(next);
    setIds(next);
    toast.success(was ? "تم حذف الكورس من السلة" : "تم إضافة الكورس للسلة 🛒", {
      id: `cart-${id}`,
    });
  }, []);

  const clear = useCallback(() => {
    write(new Set());
    setIds(new Set());
  }, []);

  const has = useCallback((id: string) => ids.has(id), [ids]);

  return { ids, add, remove, toggle, clear, has, count: ids.size };
}

export function bundleDiscountPercent(count: number): number {
  if (count >= 4) return 20;
  if (count === 3) return 15;
  if (count === 2) return 10;
  return 0;
}
