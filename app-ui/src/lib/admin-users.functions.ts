import { createClientRpc } from "./server-fn";

export const adminDeleteUser = createClientRpc<{ userId: string }, { ok: boolean }>("adminDeleteUser");
