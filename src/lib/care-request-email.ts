// A care-request alert is intentionally content-free. A public form can carry
// private health information, so the email only tells the office to sign in.
// The protected application is the one and only place request details appear.

import "server-only";
import { careRequestNotifyEmail } from "@/lib/care-request-constants";

function officeAlertLink(): string | null {
  try {
    const base = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "");
    if (base.protocol !== "https:" && base.hostname !== "localhost") return null;
    base.pathname = "/care-requests";
    base.search = "";
    return base.toString();
  } catch {
    return null;
  }
}

export async function sendCareRequestAlert(): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const link = officeAlertLink();
  if (!apiKey || !from || !link) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [careRequestNotifyEmail()],
        subject: "Cheliv: new care request",
        html: `<p>A new care request is waiting.</p><p><a href="${link}">Sign in to review it securely</a></p><p>This email intentionally contains no name, contact details, or health information.</p>`,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
