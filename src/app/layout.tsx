import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ROAM — Rental Operations and Asset Management",
  description: "Move More. Manage Smarter. A smarter workspace for vehicle rental businesses."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
