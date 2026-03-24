import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.coachmouse.com"),
  title: "MOUSE — 50 Years on the Mat",
  description:
    "A feature-length documentary honoring Coach Dave 'Mouse' McCollum — the winningest wrestling coach in District 3 history. Share your story.",
  openGraph: {
    type: "website",
    siteName: "MOUSE Documentary",
    locale: "en_US",
    title: "MOUSE — 50 Years on the Mat",
    description:
      "A feature-length documentary honoring Coach Dave 'Mouse' McCollum — the winningest wrestling coach in District 3 history.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MOUSE — 50 Years on the Mat",
    description:
      "A feature-length documentary honoring Coach Dave 'Mouse' McCollum — the winningest wrestling coach in District 3 history.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
