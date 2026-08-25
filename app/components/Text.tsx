interface TextProps {
  className?: string;
  muted?: boolean;
  children: React.ReactNode;
}

export default function Text({ className, muted = false, children }: TextProps) {
  return (
    <p className={`${muted ? "text-muted" : ""} text-base ${className ?? ""}`}>
      {children}
    </p>
  );
}
