const GAP_CLASS = {
  sm: "gap-3",
  md: "gap-6",
  lg: "gap-10",
} as const;

interface StackProps {
  gap?: keyof typeof GAP_CLASS;
  children: React.ReactNode;
}

export default function Stack({ gap = "md", children }: StackProps) {
  return <div className={`flex flex-col ${GAP_CLASS[gap]}`}>{children}</div>;
}
