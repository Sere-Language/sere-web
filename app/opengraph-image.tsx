import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "./lib/og";
import { SITE_NAME, SITE_TAGLINE } from "./lib/seo";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return renderOgImage({
    badge: "Compiled language",
    title: "Simple. Compiled. Powerful.",
    subtitle:
      "Reads like Python. Compiles to standalone native binaries through LLVM. No interpreter, VM, or bundled runtime.",
    command: "sere build main.sere → ./main",
  });
}
