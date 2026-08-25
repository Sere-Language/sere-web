interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export default function Card({ className, children }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/8 bg-card/80 p-5 backdrop-blur-sm transition-colors hover:border-primary/40 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
