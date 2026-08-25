"use client";

import type { ComponentType, SVGProps } from "react";

export type WbIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export default function WbIcon({
  icon: Icon,
  className = "size-4 shrink-0",
}: {
  icon: WbIconComponent;
  className?: string;
}) {
  return <Icon className={className} />;
}
