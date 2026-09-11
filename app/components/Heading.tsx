const LEVEL_CLASS = {
  1: "heading-1 font-semibold tracking-tight leading-[1.08] text-balance",
  2: "text-2xl font-semibold tracking-tight text-balance",
  3: "text-lg font-semibold tracking-tight",
} as const;

interface HeadingProps {
  className?: string;
  level?: keyof typeof LEVEL_CLASS;
  children: React.ReactNode;
}

export default function Heading({ className, level = 1, children }: HeadingProps) {
  const Tag = `h${level}` as const;

  return <Tag className={`${LEVEL_CLASS[level]} ${className ?? ""}`}>{children}</Tag>;
}
