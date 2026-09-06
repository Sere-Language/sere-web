import type { ReactNode } from "react";
import BrandMark from "./BrandMark";
import Heading from "./Heading";
import Text from "./Text";

interface AuthSplitProps {
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
}

export default function AuthSplit({ title, subtitle, children }: AuthSplitProps) {
  return (
    <div className="relative grid w-full overflow-hidden rounded-lg border border-border bg-card md:grid-cols-2">
      <div className="relative flex flex-col gap-8 justify-between overflow-hidden px-6 py-8 md:min-h-[24rem] sm:px-8">
        <BrandMark
          size={40}
          priority
          className="relative"
        />
        <div className="relative z-[1]">
          <Heading className="text-3xl sm:text-4xl">{title}</Heading>
          <Text muted className="mt-3 max-w-sm text-sm leading-6">
            {subtitle}
          </Text>
        </div>
      </div>
      <div className="relative flex flex-col justify-center border-t border-border bg-background px-6 py-8 md:border-l md:border-t-0 sm:px-8">
        {children}
      </div>
    </div>
  );
}
