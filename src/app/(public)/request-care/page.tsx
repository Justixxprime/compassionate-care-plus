import { RequestCareForm } from "@/components/marketing/request-care-form";
import { Reveal } from "@/components/motion/reveal";

export default function RequestCarePage() {
  return (
    <Reveal as="section" className="mx-auto max-w-2xl px-6 py-16 lg:py-24">
      <h1 className="font-display text-h1 text-ink">Request care</h1>
      <p className="mt-4 text-body-lg text-slate">
        Tell the care team a little about the situation, and someone will
        follow up. For anything urgent, call the office directly at{" "}
        <a href="tel:2819037551" className="font-medium text-pine hover:underline">
          (281) 903-7551
        </a>
        .
      </p>

      <div className="mt-10">
        <RequestCareForm />
      </div>
    </Reveal>
  );
}
