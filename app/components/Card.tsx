interface CardProps {
  className?: string;
  variant?: "panel" | "plain" | "elevated";
  children: React.ReactNode;
  hover?: boolean;
}

export default function Card({
  className,
  children,
  variant = "panel",
  hover = true,
}: CardProps) {
  if (variant === "plain") {
    return (
      <div className={`border-t border-border pt-5 pb-3 ${className ?? ""}`}>
        {children}
      </div>
    );
  }

  const base =
    variant === "elevated"
      ? "panel panel-raised panel-interactive"
      : "panel panel-interactive";

  return (
    <div className={`${base} ${hover ? "" : "hover:!transform-none"} p-5 ${className ?? ""}`}>
      {children}
    </div>
  );
}
