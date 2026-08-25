import type { ReactNode } from "react";
import BrandMark from "./BrandMark";
import CloudSnapshot from "./CloudSnapshot";
import Heading from "./Heading";
import Text from "./Text";

interface AuthSplitProps {
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
}

export default function AuthSplit({ title, subtitle, children }: AuthSplitProps) {
  return (
    <div className="relative grid w-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-card/50 shadow-[0_40px_120px_-36px_rgba(194,82,72,0.55)] md:grid-cols-[1.08fr_0.92fr]">
      <div className="relative flex min-h-[18rem] flex-col justify-between overflow-hidden px-8 py-10 sm:min-h-[28rem] sm:px-10">
        <CloudSnapshot variant="cover" priority />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[#101214] via-[#101214]/78 to-[#101214]/35"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-24 size-72 rounded-full bg-primary/30 blur-3xl"
        />
        <BrandMark
          size={56}
          priority
          className="relative z-[1] drop-shadow-[0_0_28px_rgba(194,82,72,0.45)]"
        />
        <div className="relative z-[1]">
          <Heading className="text-4xl sm:text-5xl">{title}</Heading>
          <Text muted className="mt-3 max-w-sm text-sm leading-6">
            {subtitle}
          </Text>
        </div>
      </div>
      <div className="relative flex flex-col justify-center border-t border-white/8 bg-background/70 px-8 py-10 backdrop-blur-md md:border-l md:border-t-0 sm:px-10">
        {children}
      </div>
    </div>
  );
}
