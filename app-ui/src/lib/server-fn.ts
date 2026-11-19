import { useCallback } from "react";
import { getAccessToken } from "./api-sdk";
import { getAppsApiBase } from "./apps-runtime";

export function createClientRpc<TInput = any, TOutput = any>(fnName: string) {
  const caller = async (opts?: { data?: TInput } | TInput): Promise<TOutput> => {
    const token = getAccessToken();
    const payload =
      opts && typeof opts === "object" && "data" in (opts as any)
        ? { data: (opts as any).data }
        : opts !== undefined
          ? { data: opts }
          : {};

    const base = getAppsApiBase();
    const res = await fetch(`${base}/api/fn/${encodeURIComponent(fnName)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.message || json?.error || `Request failed (${res.status})`);
    }
    return json as TOutput;
  };
  return caller;
}

export function useServerFn<TFn extends (...args: any[]) => Promise<any>>(fn: TFn): TFn {
  return useCallback(((...args: any[]) => fn(...args)) as TFn, [fn]);
}
