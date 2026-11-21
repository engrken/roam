import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://roamph.vercel.app"),
  title: { default: "ROAM — Vehicle Rental Marketplace & Host Platform", template: "%s | ROAM" },
  description: "Discover vehicles from independent owners and rental businesses through the upcoming ROAM Marketplace. Hosts can prepare their vehicle rental business, while operators can manage fleets and bookings with ROAM Workspace.",
  applicationName: "ROAM",
  keywords: ["vehicle rental software", "fleet management", "rental operations", "car rental SaaS", "motorcycle rental", "Philippines"],
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/apple-touch-icon.svg" },
  openGraph: { title: "ROAM — Vehicle Rental Marketplace", description: "A connected vehicle rental platform for renters, independent Hosts, and rental businesses. Marketplace discovery is coming soon.", type: "website", siteName: "ROAM" },
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
