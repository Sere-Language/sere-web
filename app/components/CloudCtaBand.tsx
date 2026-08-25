import Button from "./Button";
import CloudSnapshot from "./CloudSnapshot";
import Heading from "./Heading";
import Text from "./Text";

interface CloudCtaBandProps {
  title?: string;
  body?: string;
  primaryHref?: string;
  primaryLabel?: string;
}

export default function CloudCtaBand({
  title = "Open it in the browser",
  body = "Same native compiler in a Linux VM in this tab. Files, terminal, and IR in one workbench.",
  primaryHref = "/cloud",
  primaryLabel = "Try Sere Cloud",
}: CloudCtaBandProps) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-primary/18 via-card/80 to-card/40 p-6 shadow-[0_40px_90px_-40px_rgba(194,82,72,0.7)] sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-primary/25 blur-3xl"
      />
      <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col gap-4">
          <p className="m-0 text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
            Sere Cloud
          </p>
          <Heading level={2}>{title}</Heading>
          <Text muted className="max-w-md text-sm leading-6">
            {body}
          </Text>
          <div className="flex flex-wrap gap-3">
            <Button href={primaryHref} className="px-4 py-2 shadow-[0_0_28px_-6px_rgba(194,82,72,0.85)]">
              {primaryLabel}
            </Button>
            <Button href="/docs" variant="ghost">
              Docs
            </Button>
          </div>
        </div>
        <CloudSnapshot variant="compact" caption={false} />
      </div>
    </div>
  );
}
