import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://roam-kentbsece-7567.vercel.app"),
  title: { default: "ROAM — Move More. Manage Smarter.", template: "%s | ROAM" },
  description: "ROAM is a vehicle rental operations and asset management platform for motorcycles, cars, SUVs, vans, pickups, buses, and more.",
  applicationName: "ROAM",
  keywords: ["vehicle rental software", "fleet management", "rental operations", "car rental SaaS", "motorcycle rental", "Philippines"],
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/apple-touch-icon.svg" },
  openGraph: { title: "ROAM — Move More. Manage Smarter.", description: "A clearer way to run your vehicle rental business.", type: "website", siteName: "ROAM" },
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
