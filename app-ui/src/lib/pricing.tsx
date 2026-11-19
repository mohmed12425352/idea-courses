import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getVisitorPricing } from "@/lib/geo.functions";

type PricingCtx = {
  multiplier: number;
  country: string;
  /** Applies the regional multiplier to a base (EGP) price. */
  adjust: (amount: number) => number;
  /** Formatted price with currency suffix. */
  fmt: (amount: number) => string;
};

const Ctx = createContext<PricingCtx>({
  multiplier: 1,
  country: "",
  adjust: (a) => a,
  fmt: (a) => `${Math.round(Number(a) || 0)} ج.م`,
});

let cached: { country: string; multiplier: number } | null = null;

export function PricingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(cached ?? { country: "", multiplier: 1 });

  useEffect(() => {
    if (cached) return;
    let alive = true;
    getVisitorPricing()
      .then((res) => {
        cached = { country: res.country, multiplier: res.multiplier };
        if (alive) setState(cached);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const adjust = (amount: number) =>
    Math.round((Number(amount) || 0) * state.multiplier * 100) / 100;

  const value: PricingCtx = {
    ...state,
    adjust,
    fmt: (amount: number) => `${Math.round(adjust(amount))} ج.م`,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePricing() {
  return useContext(Ctx);
}
