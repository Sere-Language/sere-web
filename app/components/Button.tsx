import Link from "next/link";

const VARIANT_CLASS = {
  primary:
    "btn btn-primary",
  secondary:
    "btn btn-secondary",
  ghost:
    "btn btn-ghost",
  danger:
    "btn bg-danger text-background shadow-md hover:bg-danger/90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-inset-sm active:brightness-95 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
} as const;

interface ButtonProps {
  href?: string;
  variant?: keyof typeof VARIANT_CLASS;
  type?: "button" | "submit";
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
}

export default function Button({
  href,
  variant = "primary",
  type = "button",
  className,
  children,
  disabled = false,
  onClick,
  size = "md",
}: ButtonProps) {
  const sizeClasses = {
    sm: "btn-sm",
    md: "btn-md",
    lg: "btn-lg",
  }[size];
  
  const classes = `inline-flex w-fit justify-center items-center gap-2 rounded-md font-medium ${sizeClasses} ${VARIANT_CLASS[variant]} ${className ?? ""}`;

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
