interface ContainerProps {
  className?: string;
  children: React.ReactNode;
}

export default function Container({ className, children }: ContainerProps) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-6 ${className ?? ""}`}>
      {children}
    </div>
  );
}
