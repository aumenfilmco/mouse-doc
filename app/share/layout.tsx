import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Share a Memory — MOUSE Documentary",
  description:
    "Upload a video or voice memo about your experience with Coach Dave 'Mouse' McCollum for the documentary.",
  openGraph: {
    title: "Share a Memory — MOUSE Documentary",
    description:
      "Upload a video or voice memo about your experience with Coach Dave 'Mouse' McCollum for the documentary.",
  },
  twitter: {
    title: "Share a Memory — MOUSE Documentary",
    description:
      "Upload a video or voice memo about your experience with Coach Dave 'Mouse' McCollum for the documentary.",
  },
};

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
