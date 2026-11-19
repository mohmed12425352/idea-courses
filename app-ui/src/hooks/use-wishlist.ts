import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "fekra_wishlist";
const WISHLIST_EVENT = "fekra:wishlist-changed";

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
  window.dispatchEvent(new CustomEvent(WISHLIST_EVENT));
}

export function useWishlist() {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const sync = () => setIds(read());
    sync();
    window.addEventListener(WISHLIST_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(WISHLIST_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const next = new Set(read());
    const wasSaved = next.has(id);
    if (wasSaved) next.delete(id);
    else next.add(id);
    write(next);
    setIds(next);
    if (wasSaved) {
      toast.success("تم حذف الكورس من المفضلة", { id: `wishlist-${id}` });
    } else {
      toast.success("تم إضافة الكورس إلى المفضلة ❤️", { id: `wishlist-${id}` });
    }
  }, []);

  const isSaved = useCallback((id: string) => ids.has(id), [ids]);

  return { ids, toggle, isSaved };
}
