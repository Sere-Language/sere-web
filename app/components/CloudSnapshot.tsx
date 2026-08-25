import Image from "next/image";

const SRC = "/sere-cloud-snapshot.png";
const WIDTH = 1920;
const HEIGHT = 1080;

type CloudSnapshotVariant = "hero" | "compact" | "cover";

interface CloudSnapshotProps {
  priority?: boolean;
  variant?: CloudSnapshotVariant;
  className?: string;
  caption?: boolean;
}

export default function CloudSnapshot({
  priority = false,
  variant = "hero",
  className,
  caption = true,
}: CloudSnapshotProps) {
  if (variant === "cover") {
    return (
      <div className={`absolute inset-0 ${className ?? ""}`}>
        <Image
          src={SRC}
          alt="Sere Cloud workbench with files, editor, terminal, and LLVM IR"
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, 55vw"
          className="object-cover object-top"
        />
      </div>
    );
  }

  const compact = variant === "compact";

  return (
    <figure className={`cloud-shot ${compact ? "cloud-shot-compact" : ""} ${className ?? ""}`}>
      <div aria-hidden className="cloud-shot-glow" />
      <div aria-hidden className="cloud-shot-orbit" />
      <div className="cloud-shot-frame">
        <div aria-hidden className="cloud-shot-shine" />
        <Image
          src={SRC}
          alt="Sere Cloud workbench with files, editor, terminal, and LLVM IR"
          width={WIDTH}
          height={HEIGHT}
          priority={priority}
          sizes={
            compact
              ? "(max-width: 768px) 100vw, 420px"
              : "(max-width: 768px) 100vw, 1120px"
          }
          className="relative z-[1] h-auto w-full"
        />
      </div>
      {caption ? (
        <figcaption className="cloud-shot-caption">
          <span>Monaco</span>
          <span aria-hidden>·</span>
          <span>NanoVM</span>
          <span aria-hidden>·</span>
          <span>LLVM 22</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
