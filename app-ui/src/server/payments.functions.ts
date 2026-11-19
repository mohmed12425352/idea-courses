import { createClientRpc } from "@/lib/server-fn";

export type PaddleEnv = "sandbox" | "production";

export const resolvePaddlePrice = createClientRpc<{ priceId: string; environment: PaddleEnv }, string>(
  "resolvePaddlePrice",
);
