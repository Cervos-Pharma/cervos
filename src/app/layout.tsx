import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import Providers from "@/providers";

const interFont = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const outfitFont = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
import MockModeBar from "@/components/MockModeBar";
import PwaRegister from "@/components/PwaRegister";
import { CervosCommandBar } from "@cervos/ui";
import { getLang } from "@/lib/i18n/server";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#1039b9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://cervos.online"),
  title: {
    default: "Cervos Pharma Software for Pharmacies and Wholesale Supply",
    template: "%s · Cervos Pharma",
  },
  description:
    "Everyday software built for pharmacies in Tanzania. Keep serving customers when internet drops, stop expired medicines at checkout, close shifts cleanly, and restock from trusted distributors.",
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
    title: "Cervos Pharma Software for Pharmacies and Wholesale Supply",
    description:
      "Everyday software built for pharmacies in Tanzania. Keep serving customers when internet drops, stop expired medicines at checkout, and restock from trusted wholesalers.",
    url: "https://cervos.online",
    siteName: "Cervos Pharma",
    locale: "en_US",
    alternateLocale: ["sw_TZ"],
    type: "website",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "Cervos Pharma Logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cervos Pharma Software for Pharmacies and Wholesale Supply",
    description:
      "Everyday software built for pharmacies in Tanzania. Keep serving even when internet drops, protect shelves from expired stock, and restock directly.",
    images: ["/logo.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  return (
    <html
      lang={lang === "SW" ? "sw" : "en"}
      className={`${interFont.variable} ${outfitFont.variable}`}
      suppressHydrationWarning
    >
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
