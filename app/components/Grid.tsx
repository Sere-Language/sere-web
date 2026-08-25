const COL_CLASS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
} as const;

interface GridProps {
  cols?: keyof typeof COL_CLASS;
  children: React.ReactNode;

  className?: string;
  style?: React.CSSProperties;
}

export default function Grid({ cols = 2, children, className, style }: GridProps) {
  return (
    <div className={`grid grid-cols-1 gap-4 ${COL_CLASS[cols]} ${className}`} style={style}>
      {children}
    </div>
  );
}
