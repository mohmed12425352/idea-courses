import { createClientRpc } from "./server-fn";

export const getMeetConfigStatus = createClientRpc<void, any>("getMeetConfigStatus");
export const saveMeetWebhookSecret = createClientRpc<{ webhookSecret: string }, { ok: boolean }>("saveMeetWebhookSecret");
