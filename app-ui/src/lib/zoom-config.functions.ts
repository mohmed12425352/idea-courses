import { createClientRpc } from "./server-fn";

export const getZoomConfigStatus = createClientRpc<void, any>("getZoomConfigStatus");
export const saveZoomConfig = createClientRpc<
  { accountId: string; clientId: string; clientSecret: string; webhookSecret?: string },
  { ok: boolean }
>("saveZoomConfig");
export const saveZoomWebhookSecret = createClientRpc<{ webhookSecret: string }, { ok: boolean }>("saveZoomWebhookSecret");
export const clearZoomConfig = createClientRpc<void, { ok: boolean }>("clearZoomConfig");
export const checkZoomTokenScopes = createClientRpc<void, { ok: boolean; scopes: string[]; missing: string[] }>(
  "checkZoomTokenScopes",
);
