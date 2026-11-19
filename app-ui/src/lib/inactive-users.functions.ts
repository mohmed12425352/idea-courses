import { createClientRpc } from "./server-fn";

export const listInactiveUsers = createClientRpc<{ days: number }, any>("listInactiveUsers");
export const deleteInactiveUsers = createClientRpc<{ userIds: string[]; days: number }, any>("deleteInactiveUsers");
