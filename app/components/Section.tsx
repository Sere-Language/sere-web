interface SectionProps {
  id?: string;
  className?: string;
  children: React.ReactNode;
}

export default function Section({ id, className, children }: SectionProps) {
  return (
    <section id={id} className={`py-16 ${className ?? ""}`}>
      {children}
    </section>
  );
}
