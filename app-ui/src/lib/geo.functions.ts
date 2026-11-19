import { createClientRpc } from "./server-fn";

export const getVisitorPricing = createClientRpc<void, { country: string; multiplier: number }>("getVisitorPricing");
