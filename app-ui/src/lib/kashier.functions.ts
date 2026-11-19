import { createClientRpc } from "./server-fn";

export const createKashierSession = createClientRpc<
  { courseId: string; amount: number; couponCode?: string | null; methods?: string | null },
  { ok: true; checkoutUrl: string; orderRef: string } | { ok: false; error: string }
>("createKashierSession");

export const confirmKashierPayment = createClientRpc<{ params: Record<string, string> }, any>("confirmKashierPayment");

export const checkKashierOrderStatus = createClientRpc<{ orderRef: string }, any>("checkKashierOrderStatus");
