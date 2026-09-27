"use client";

import Script from "next/script";

declare global {
  interface Window {
    turnstile?: { reset: () => void };
  }
}

export function resetTurnstileWidget() {
  window.turnstile?.reset();
}

export function TurnstileWidget({ action }: { action: string }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div className="cf-turnstile" data-sitekey={siteKey} data-action={action} data-theme="light" />
    </>
  );
}
