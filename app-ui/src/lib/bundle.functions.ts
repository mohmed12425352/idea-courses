import { createClientRpc } from "./server-fn";

export const createKashierBundleSession = createClientRpc<
  { courseIds: string[] },
  | {
      ok: true;
      checkoutUrl: string;
      orderRef: string;
      amount: number;
      subtotal: number;
      discountPercent: number;
      count: number;
    }
  | { ok: false; error: string }
>("createKashierBundleSession");
