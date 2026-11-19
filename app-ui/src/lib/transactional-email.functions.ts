import { createClientRpc } from "./server-fn";

export type SendPlatformEmailInput = {
  templateName: string;
  recipientEmail?: string;
  templateData?: Record<string, any>;
  idempotencyKey?: string;
  messageId?: string;
};

export const sendPlatformEmail = createClientRpc<
  SendPlatformEmailInput,
  { ok: true } | { ok: false; reason: string; message?: string }
>("sendPlatformEmail");
