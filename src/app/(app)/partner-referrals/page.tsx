import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import { listMyPartnerReferrals } from "@/lib/partner-referrals";
import { formatOrgDate } from "@/lib/time";
import { EmptyState } from "@/components/app/empty-state";
import { NoAccess } from "@/components/app/no-access";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { PartnerReferralForm } from "./partner-referral-form";
export const metadata: Metadata = { title: "My referrals" };
export default async function PartnerReferralsPage() { const user = await requireUser(); try { const referrals = await listMyPartnerReferrals(user.id); return <><PageHeader title="My referrals" description="Send a referral and follow only referrals you submitted. This page does not show patient records or office decisions." /><Section title="Send a referral"><PartnerReferralForm /></Section><Section title="Referrals you sent">{referrals.length ? <div className="divide-y rounded-md border border-border bg-white">{referrals.map((referral) => <article key={referral.id} className="px-4 py-4"><div className="flex items-center justify-between gap-4"><p className="font-medium text-ink">{referral.firstName} {referral.lastName}</p><span className="rounded-full bg-sage px-2 py-0.5 text-caption font-semibold text-pine">{referral.statusLabel}</span></div><p className="mt-1 text-caption text-slate">{referral.sourceLabel} · Sent {formatOrgDate(referral.createdAt)}</p></article>)}</div> : <EmptyState icon={ClipboardList} title="No referrals sent yet">A referral you send appears here with its current status.</EmptyState>}</Section></>; } catch (error) { if (error instanceof AuthorizationError) return <NoAccess area="My referrals" />; throw error; } }
