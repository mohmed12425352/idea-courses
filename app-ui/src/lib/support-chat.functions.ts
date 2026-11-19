import { createClientRpc } from "./server-fn";

export const getBotReply = createClientRpc<
  { messages: Array<{ role: "user" | "assistant"; content: string }>; visitorName?: string },
  { reply: string }
>("getBotReply");
