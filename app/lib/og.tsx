import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const COLORS = {
  background: "#0b0d0f",
  foreground: "#eeeae3",
  muted: "#9a948c",
  primary: "#c4584a",
  primaryHover: "#da6d5e",
};

export interface OgImageInput {
  /** Large headline — the page or site title. */
  title: string;
  /** Supporting line under the headline. */
  subtitle: string;
  /** Small uppercase label in the top-left chip. */
  badge: string;
  /** Optional monospace command line rendered along the bottom. */
  command?: string;
}

/**
 * Shared 1200x630 social card, used by both opengraph-image and twitter-image
 * so the two never drift apart.
 */
export function renderOgImage({ title, subtitle, badge, command }: OgImageInput) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: COLORS.background,
          backgroundImage:
            "radial-gradient(circle at 12% 0%, rgba(196,88,74,0.30), rgba(11,13,15,0) 55%), radial-gradient(circle at 92% 100%, rgba(196,88,74,0.16), rgba(11,13,15,0) 50%)",
          padding: "64px 72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              border: "1px solid rgba(238,234,227,0.16)",
              borderRadius: 999,
              padding: "10px 22px",
              color: COLORS.muted,
              fontSize: 22,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            <div
              style={{
                display: "flex",
                width: 12,
                height: 12,
                borderRadius: 999,
                backgroundColor: COLORS.primary,
              }}
            />
            {badge}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              display: "flex",
              fontSize: title.length > 46 ? 76 : 92,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              color: COLORS.foreground,
              maxWidth: 940,
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              lineHeight: 1.35,
              color: COLORS.muted,
              maxWidth: 900,
            }}
          >
            {subtitle}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(238,234,227,0.12)",
            paddingTop: 26,
          }}
        >
          <div style={{ display: "flex", fontSize: 26, color: COLORS.foreground }}>
            Sere
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              color: COLORS.primaryHover,
              fontFamily: "monospace",
            }}
          >
            {command ?? "sere-lang.com"}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
