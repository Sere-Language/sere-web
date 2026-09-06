interface SectionProps {
  id?: string;
  className?: string;
  children: React.ReactNode;
}

export default function Section({ id, className, children }: SectionProps) {
  return (
    <section id={id} className={`${className && /(?:^|\s)(?:py|pt|pb)-/.test(className) ? "" : "py-12 md:py-16"} ${className ?? ""}`}>
      {children}
    </section>
  );
}
