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
    <div className="border-y border-border py-8">
      <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col gap-4">
          <p className="m-0 text-xs font-medium uppercase tracking-wider text-primary">
            Sere Cloud
          </p>
          <Heading level={2}>{title}</Heading>
          <Text muted className="max-w-md text-sm leading-6">
            {body}
          </Text>
          <div className="flex flex-wrap gap-3">
            <Button href={primaryHref} className="px-4 py-2">
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
