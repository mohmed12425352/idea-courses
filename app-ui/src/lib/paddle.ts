const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

declare global {
  interface Window { Paddle: any }
}

export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

export function isPaddleConfigured(): boolean {
  return !!clientToken;
}

let paddleInitialized = false;
let paddlePromise: Promise<void> | null = null;

export async function initializePaddle(): Promise<void> {
  if (paddleInitialized) return;
  if (paddlePromise) return paddlePromise;
  if (!clientToken) throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");

  paddlePromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-paddle-sdk]');
    const onReady = () => {
      const env = getPaddleEnvironment() === "sandbox" ? "sandbox" : "production";
      window.Paddle.Environment.set(env);
      window.Paddle.Initialize({ token: clientToken });
      paddleInitialized = true;
      resolve();
    };
    if (existing && (window as any).Paddle) { onReady(); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.dataset.paddleSdk = "true";
    script.onload = onReady;
    script.onerror = () => reject(new Error("فشل تحميل Paddle.js"));
    document.head.appendChild(script);
  });
  return paddlePromise;
}