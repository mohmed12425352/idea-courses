import { createClientRpc } from "./server-fn";

export const checkDomainHealth = createClientRpc<{ domain: string }, any>("checkDomainHealth");
