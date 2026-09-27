// Cloudflare Turnstile verification for the one public write endpoint. The
// public site key only draws a widget; this server-only module is the actual
// security boundary because it holds and uses the secret key.

import "server-only";
import { randomUUID } from "node:crypto";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileResponse {
  success?: boolean;
  hostname?: string;
  action?: string;
}

function expectedHostname(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "").hostname;
  } catch {
    return null;
  }
}

export function turnstileEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(token: string, action: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const hostname = expectedHostname();
  if (!secret || !hostname || !token || token.length > 2048) return false;

  const body = new URLSearchParams({
    secret,
    response: token,
    idempotency_key: randomUUID(),
  });

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return false;
    const result = await response.json() as TurnstileResponse;
    return result.success === true && result.hostname === hostname && result.action === action;
  } catch {
    // A public write fails closed when Turnstile is configured but cannot be
    // verified. This avoids treating an outage as a bot bypass.
    return false;
  }
}
