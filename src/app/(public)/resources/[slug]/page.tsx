import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { EditorialHero } from "@/components/marketing/editorial-hero";
import { Reveal } from "@/components/motion/reveal";
import { siteImages } from "@/lib/site-images";

const resources = {
  "starting-home-health": { eyebrow: "Resource guide", title: "Starting home health", summary: "A first conversation can make an unfamiliar process feel more understandable.", points: ["What changed recently, and what support is needed at home", "Which questions the patient and family want answered first", "How a referral, assessment, and care plan fit together"] },
  "family-caregivers": { eyebrow: "For family caregivers", title: "You do not have to figure it out alone", summary: "Family care works best when expectations are clear and the right people are included with the patient’s permission.", points: ["Write down the questions that matter before the first call", "Ask what information can be shared and with whom", "Tell the care team what is working, and what is becoming difficult"] },
  "preparing-for-a-visit": { eyebrow: "Before the first visit", title: "A little preparation helps the visit feel easier", summary: "The care team comes to understand the patient’s real routine, space, and priorities.", points: ["Keep a current medication list nearby", "Note recent changes, symptoms, or questions", "Make a comfortable place for conversation and assessment"] },
} as const;

export function generateStaticParams() { return Object.keys(resources).map((slug) => ({ slug })); }

export default async function ResourceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const resource = resources[slug as keyof typeof resources];
  if (!resource) notFound();
  return <div><EditorialHero eyebrow={resource.eyebrow} title={resource.title} summary={resource.summary} image={siteImages.whoWeServePage}><Link href="/request-care" className={buttonVariants({ size: "lg" })}>Talk with the team</Link></EditorialHero><Reveal as="section" className="mx-auto max-w-4xl px-6 py-16 lg:py-24"><Link href="/resources" className="inline-flex items-center gap-2 text-body-sm font-semibold text-pine hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> All resources</Link><div className="mt-12 grid gap-5 sm:grid-cols-3">{resource.points.map((point, index) => <div key={point} className="border-t-2 border-pine bg-white p-6"><span className="text-label font-semibold text-marigold">0{index + 1}</span><CheckCircle2 className="mt-7 h-6 w-6 text-pine" aria-hidden="true" /><p className="mt-5 text-body font-medium leading-relaxed text-ink">{point}</p></div>)}</div><div className="mt-14 flex flex-wrap items-center justify-between gap-5 border-t border-border pt-8"><p className="font-display text-h3 text-ink">Have a question about your situation?</p><Link href="/contact" className={buttonVariants({ variant: "secondary" })}>Contact us <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></div></Reveal></div>;
}
