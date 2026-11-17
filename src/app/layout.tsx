import type { Metadata, Viewport } from "next";
import Providers from "@/providers";
import MockModeBar from "@/components/MockModeBar";
import PwaRegister from "@/components/PwaRegister";
import { CervosCommandBar } from "@cervos/ui";
import { getLang } from "@/lib/i18n/server";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#1039b9",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://cervos.online"),
  title: {
    default: "Cervos Pharma — Pharmacy Operations & Supply Chain",
    template: "%s — Cervos Pharma",
  },
  description:
    "Precision logistics, bilingual accounting, and offline-first dispensary operations for modern African pharmacy networks.",
  keywords: [
    "pharmacy pos",
    "fefo inventory",
    "tanzania pharmacy software",
    "m-pesa pharmacy",
    "pharmacy accounting tzs",
    "tmda compliance",
    "pharmacy supply chain",
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cervos Pharma",
  },
  icons: {
    icon: [
      { url: "/cervos-company-logo-circular.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Cervos Pharma — Pharmacy Operations & Supply Chain",
    description: "Precision logistics, bilingual accounting, and offline-first dispensary operations.",
    url: "https://cervos.online",
    siteName: "Cervos Pharma",
    locale: "en_US",
    alternateLocale: ["sw_TZ"],
    type: "website",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "Cervos Pharma Logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cervos Pharma",
    description: "Precision logistics, bilingual accounting, and offline-first dispensary operations.",
    images: ["/logo.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  return (
    <html lang={lang === "SW" ? "sw" : "en"} suppressHydrationWarning>
      <body className="bg-surface text-on-surface font-body-md antialiased selection:bg-primary/15 selection:text-primary">
        <Providers initialLang={lang}>
          {children}
          <CervosCommandBar />
          <PwaRegister />
        </Providers>
        <MockModeBar />
      </body>
    </html>
  );
}
