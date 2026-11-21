import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://roam-kentbsece-7567.vercel.app"),
  title: { default: "ROAM — Move More. Manage Smarter.", template: "%s | ROAM" },
  description: "ROAM helps rental businesses manage their fleets, bookings, and operations. A vehicle rental marketplace for renters and independent vehicle hosts is coming soon.",
  applicationName: "ROAM",
  keywords: ["vehicle rental software", "fleet management", "rental operations", "car rental SaaS", "motorcycle rental", "Philippines"],
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/apple-touch-icon.svg" },
  openGraph: { title: "ROAM — Vehicle Rental Operations & Marketplace", description: "Manage a rental business today. Discover vehicles and become a host on the upcoming ROAM Marketplace.", type: "website", siteName: "ROAM" },
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
