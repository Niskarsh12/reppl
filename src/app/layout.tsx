import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./studio.css";

const interTight = localFont({
  src: [
    { path: "../../public/fonts/InterTight-400.woff", weight: "400", style: "normal" },
    { path: "../../public/fonts/InterTight-500.woff", weight: "500", style: "normal" },
    { path: "../../public/fonts/InterTight-600.woff", weight: "600", style: "normal" },
  ],
  variable: "--font-inter-tight",
  display: "swap",
});

const instrumentSerif = localFont({
  src: [
    { path: "../../public/fonts/InstrumentSerif-Regular.woff", weight: "400", style: "normal" },
    { path: "../../public/fonts/InstrumentSerif-Italic.woff", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Reppl · Culture first. Partnerships follow.",
  description:
    "Turn your event's cultural identity into evidence-backed brand partnership opportunities, tailored activation strategies and compelling sponsorship proposals. Powered by Qloo cultural intelligence.",
};

export const viewport: Viewport = {
  themeColor: "#f5f1e8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${interTight.variable} ${instrumentSerif.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
