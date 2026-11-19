import { createClientRpc } from "./server-fn";

export const verifyTurnstileTokenFn = createClientRpc<
  string,
  { success: boolean; error?: string; errorCodes?: string[] }
>("verifyTurnstileTokenFn");
