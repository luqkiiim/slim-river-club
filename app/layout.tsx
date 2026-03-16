import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import "@/app/globals.css";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Slim River Club",
  description: "Mobile-friendly office weight loss tracker with per-participant monthly targets and penalty rules.",
  applicationName: "Slim River Club",
  manifest: "/manifest.webmanifest",
  icons: {
    apple: [{ url: "/apple-icon.png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Slim River Club",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8f2e8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${headingFont.className} ${headingFont.variable} ${monoFont.variable} bg-hero-glow text-ink`}>
        <div className="relative min-h-screen overflow-x-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_transparent_60%)]" />
          <div className="pointer-events-none absolute left-[-8rem] top-20 h-48 w-48 rounded-full bg-leaf/10 blur-3xl" />
          <div className="pointer-events-none absolute right-[-6rem] top-40 h-56 w-56 rounded-full bg-blush/20 blur-3xl" />
          {children}
        </div>
      </body>
    </html>
  );
}
