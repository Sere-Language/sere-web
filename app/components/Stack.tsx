const GAP_CLASS = {
  xs: "gap-2",
  sm: "gap-3",
  md: "gap-6",
  lg: "gap-10",
} as const;

interface StackProps {
  gap?: keyof typeof GAP_CLASS;
  children: React.ReactNode;
  className?: string;
}

export default function Stack({ gap = "md", children, className }: StackProps) {
  return <div className={`flex flex-col ${GAP_CLASS[gap]} ${className ?? ""}`}>{children}</div>;
}
