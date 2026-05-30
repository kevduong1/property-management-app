import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SeriesBooks — Property Management for Series LLCs",
  description:
    "Bookkeeping-first property management for family-owned Series LLC rental businesses.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
