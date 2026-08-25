import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "./components/Footer";
import SiteNavbar from "./components/SiteNavbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sere Language",
  description: "All things Sere.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/sere-mark.png", type: "image/png" },
    ],
    apple: "/sere-mark.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      className={`dark ${geistSans.variable} ${geistMono.variable}`}
      data-theme="dark"
      data-scroll-behavior="smooth"
    >
      <body>
        <SiteNavbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
