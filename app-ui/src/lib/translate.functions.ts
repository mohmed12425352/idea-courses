import { createClientRpc } from "./server-fn";

export const translateFields = createClientRpc<
  { fields: Array<{ key: string; text: string }>; target?: "en" | "ar" },
  { translations: Record<string, string> }
>("translateFields");
