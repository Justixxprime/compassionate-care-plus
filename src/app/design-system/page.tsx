import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

/*
  This page exists so I can SEE the design system, not just read about it.
  It is not part of the real website - it will be deleted or moved behind
  an internal-only route before this ever goes near a real audience.
  Visit it at /design-system while developing.
*/

// Tailwind scans source code for literal class names at build time, so
// each swatch's classes are written out in full below rather than built
// with a template string like `bg-${name}` - a dynamic class name like
// that would not be detected and the color would silently not appear.
const swatches = [
  { label: "Ink", className: "bg-ink" },
  { label: "Paper", className: "bg-paper border border-border-strong" },
  { label: "Pine", className: "bg-pine" },
  { label: "Sage", className: "bg-sage border border-border-strong" },
  { label: "Marigold", className: "bg-marigold" },
  { label: "Slate", className: "bg-slate" },
] as const;

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-12 px-6 py-16">
      <header>
        <p className="mb-2 text-label font-medium uppercase tracking-wide text-slate">
          Internal reference. Not a real page.
        </p>
        <h1 className="font-display text-display text-ink">Design system</h1>
        <p className="mt-3 text-body-lg text-slate">
          The tokens and base components everything else in this project is
          built from.
        </p>
      </header>

      <section>
        <h2 className="font-display text-h2 text-ink mb-4">Color</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {swatches.map((s) => (
            <div key={s.label}>
              <div className={`h-16 rounded-md ${s.className}`} />
              <p className="mt-1.5 text-caption text-slate">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-h2 text-ink mb-4">Typography</h2>
        <div className="space-y-3">
          <p className="font-display text-display text-ink">Display</p>
          <p className="font-display text-h1 text-ink">Heading 1</p>
          <p className="font-display text-h2 text-ink">Heading 2</p>
          <p className="font-display text-h3 text-ink">Heading 3</p>
          <p className="text-h4 font-semibold text-ink">Heading 4</p>
          <p className="text-body-lg text-ink">
            Body large. Used for intros and lede paragraphs on the public
            site.
          </p>
          <p className="text-body text-ink">
            Body. The default paragraph size for most content.
          </p>
          <p className="text-body-sm text-slate">
            Body small. Secondary or supporting text.
          </p>
          <p className="text-data text-ink">Data. 128 visits this week</p>
        </div>
      </section>

      <section>
        <h2 className="font-display text-h2 text-ink mb-4">Buttons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Request care</Button>
          <Button variant="secondary">Learn more</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </section>

      <section>
        <h2 className="font-display text-h2 text-ink mb-4">Badges</h2>
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">Scheduled</Badge>
          <Badge tone="info">In progress</Badge>
          <Badge tone="success">Completed</Badge>
          <Badge tone="warning">Needs review</Badge>
          <Badge tone="danger">Cancelled</Badge>
        </div>
      </section>

      <section>
        <h2 className="font-display text-h2 text-ink mb-4">Form field</h2>
        <div className="max-w-sm">
          <Label htmlFor="demo-name">Full name</Label>
          <Input id="demo-name" placeholder="Jordan Alvarez" />
        </div>
      </section>

      <section>
        <h2 className="font-display text-h2 text-ink mb-4">Card</h2>
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Next visit</CardTitle>
            <CardDescription>Synthetic demo data</CardDescription>
          </CardHeader>
          <p className="text-body text-ink">
            Tuesday, 9:00 AM. Skilled nursing visit
          </p>
        </Card>
      </section>
    </main>
  );
}
