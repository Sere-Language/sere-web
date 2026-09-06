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
  const baseClasses = variant === "plain"
    ? "border-t border-border pt-5 pb-3"
    : variant === "elevated"
      ? "rounded-lg border border-border bg-card p-5 shadow-lg"
      : "rounded-lg border border-border bg-card p-5 shadow-sm";
  
  const hoverClasses = hover && variant !== "plain"
    ? "transition-all duration-200 hover:shadow-lg hover:border-border-strong hover:-translate-y-0.5"
    : "";
  
  return (
    <div
      className={`${baseClasses} ${hoverClasses} ${className ?? ""}`}
      style={variant === "elevated" ? {
        background: "linear-gradient(180deg, #161a1e 0%, #121417 100%)"
      } : undefined}
    >
      {children}
    </div>
  );
}
