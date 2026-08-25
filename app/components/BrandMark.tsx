import Image from "next/image";

interface BrandMarkProps {
  size?: number;
  className?: string;
  priority?: boolean;
}

export default function BrandMark({
  size = 32,
  className,
  priority = false,
}: BrandMarkProps) {
  return (
    <Image
      src="/sere-mark.png"
      alt="Sere"
      width={size}
      height={size}
      priority={priority}
      className={className}
    />
  );
}
