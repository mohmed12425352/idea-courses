import { createClientRpc } from "./server-fn";

export const getOrderAudit = createClientRpc<{ orderId: string }, { order: any; events: any[] }>("getOrderAudit");
