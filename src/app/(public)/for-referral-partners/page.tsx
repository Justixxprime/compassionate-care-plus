import Link from "next/link";
import { ClipboardCheck, HeartHandshake, Send } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EditorialHero } from "@/components/marketing/editorial-hero";
import { Reveal } from "@/components/motion/reveal";
import { siteImages } from "@/lib/site-images";

const steps = [
  { icon: Send, title: "Send a referral", body: "Share the information your team has available. The referral is received securely by the office." },
  { icon: ClipboardCheck, title: "Follow the next step", body: "Sign in to the referral partner portal to follow the status of referrals your team submitted." },
  { icon: HeartHandshake, title: "Keep care connected", body: "The office coordinates directly with the patient and authorized care team from there." },
] as const;

export default function ReferralPartnersPage() {
  return <div><EditorialHero eyebrow="For referral partners" title="A clearer handoff into home-based care." summary="For hospitals, physician offices, and care teams looking for a respectful next step for a patient." image={siteImages.hero}><Link href="/request-care" className={buttonVariants({ size: "lg" })}>Start a referral</Link><Link href="/sign-in" className={buttonVariants({ variant: "secondary", size: "lg" })}>Partner sign in</Link></EditorialHero><Reveal as="section" className="mx-auto max-w-6xl px-6 py-18 lg:py-24"><div className="max-w-2xl"><p className="text-label font-semibold uppercase tracking-[.18em] text-pine">A simple path</p><h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.25rem)] leading-tight text-ink">Information moves forward. The patient stays at the center.</h2></div><ol className="mt-12 grid gap-5 md:grid-cols-3">{steps.map(({ icon: Icon, title, body }, index) => <li key={title} className="border-t-2 border-pine bg-white px-6 py-7 shadow-[0_16px_45px_-36px_rgba(23,36,32,.55)]"><span className="text-label font-semibold text-marigold">0{index + 1}</span><Icon className="mt-7 h-7 w-7 text-pine" aria-hidden="true" /><h3 className="mt-5 text-h3 font-semibold text-ink">{title}</h3><p className="mt-3 text-body-sm text-slate">{body}</p></li>)}</ol><div className="mt-12 rounded-md bg-sage px-7 py-8 sm:flex sm:items-center sm:justify-between"><div><p className="text-h4 font-semibold text-ink">Already have portal access?</p><p className="mt-1 text-body-sm text-slate">Use the secure referral-partner portal to check only your submitted referrals.</p></div><Link href="/sign-in" className={buttonVariants({ variant: "secondary", className: "mt-5 sm:mt-0" })}>Open secure portal</Link></div></Reveal></div>;
}
