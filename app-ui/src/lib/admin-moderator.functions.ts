import { createClientRpc } from "./server-fn";

export const adminCreateModerator = createClientRpc<
  { email: string; name: string },
  { ok: boolean; userId: string; email: string; password: string; created: boolean }
>("adminCreateModerator");
