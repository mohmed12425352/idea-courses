import { createClientRpc } from "./server-fn";

export const runPaymentE2ETest = createClientRpc<{ courseId: string; cleanup?: boolean }, any>("runPaymentE2ETest");
