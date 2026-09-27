import Link from "next/link";

export const metadata = { title: "You are offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <p className="font-display text-display text-ink">You are offline</p>
      <p className="mt-5 text-body-lg leading-relaxed text-slate">Cheliv needs an internet connection for secure records, messages, and documents. No private information is stored for offline viewing.</p>
      <Link href="/" className="mt-8 inline-flex min-h-11 w-fit items-center rounded-md bg-pine px-5 text-body-sm font-semibold text-paper">Try again</Link>
    </main>
  );
}
