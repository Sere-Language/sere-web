import Link from "next/link";

const VARIANT_CLASS = {
  primary:
    "bg-primary text-primary-foreground no-underline hover:bg-primary-hover hover:text-primary-foreground hover:no-underline",
  ghost:
    "text-muted no-underline hover:bg-primary/10 hover:text-primary hover:no-underline",
  danger:
    "bg-danger text-white no-underline hover:bg-danger/85 hover:text-white hover:no-underline",
} as const;

interface ButtonProps {
  href?: string;
  variant?: keyof typeof VARIANT_CLASS;
  type?: "button" | "submit";
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}

export default function Button({
  href,
  variant = "primary",
  type = "button",
  className,
  children,
  disabled = false,
  onClick,
}: ButtonProps) {
  const classes = `inline-flex items-center rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASS[variant]} ${className ?? ""}`;

  if (href) {
    return (
      <Link href={href} className={classes} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
