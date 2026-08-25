"use client";

import Code from "@gravity-ui/icons/Code";
import Cpu from "@gravity-ui/icons/Cpu";
import File from "@gravity-ui/icons/File";
import FileText from "@gravity-ui/icons/FileText";
import Folder from "@gravity-ui/icons/Folder";
import FolderOpen from "@gravity-ui/icons/FolderOpen";
import Gear from "@gravity-ui/icons/Gear";
import WbIcon from "./WbIcon";

interface FileIconProps {
  name: string;
  kind: "file" | "dir";
  open?: boolean;
}

export default function FileIcon({ name, kind, open = false }: FileIconProps) {
  if (kind === "dir") {
    const tone =
      name === "src"
        ? "text-[#e8a598]"
        : name === "libs"
          ? "text-[#c9a227]"
          : name === "scripts"
            ? "text-[#6aa8d8]"
            : "text-[#c9a46c]";
    return <WbIcon icon={open ? FolderOpen : Folder} className={`size-3.5 shrink-0 ${tone}`} />;
  }

  const lower = name.toLowerCase();
  if (lower.endsWith(".sere")) {
    return <WbIcon icon={Code} className="size-3.5 shrink-0 text-primary" />;
  }
  if (lower.endsWith(".toml")) {
    return <WbIcon icon={Gear} className="size-3.5 shrink-0 text-muted" />;
  }
  if (lower.endsWith(".ll") || lower.endsWith(".ir")) {
    return <WbIcon icon={Cpu} className="size-3.5 shrink-0 text-accent" />;
  }

  const lines = lower.endsWith(".txt") || lower.endsWith(".sh") || lower.endsWith(".md");
  return (
    <WbIcon
      icon={lines ? FileText : File}
      className="size-3.5 shrink-0 text-muted"
    />
  );
}
