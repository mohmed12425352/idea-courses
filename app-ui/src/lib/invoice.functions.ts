import { createClientRpc } from "./server-fn";

export const sendOrderInvoice = createClientRpc<{ orderId: string }, any>("sendOrderInvoice");
