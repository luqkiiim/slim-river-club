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
  themeColor: "#FBF8F1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body className={`${headingFont.className} ${headingFont.variable} ${monoFont.variable} text-ink`}>
        <div className="min-h-screen overflow-x-clip">{children}</div>
      </body>
    </html>
  );
}
