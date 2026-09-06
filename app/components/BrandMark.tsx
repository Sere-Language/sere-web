import Image from "next/image";

interface BrandMarkProps {
  size?: number;
  alt?: string;
  className?: string;
  priority?: boolean;
}

export default function BrandMark({
  size = 32,
  alt = "Sere",
  className,
  priority = false,
}: BrandMarkProps) {
  return (
    <Image
      src="/sere-mark.png"
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={className}
    />
  );
}
