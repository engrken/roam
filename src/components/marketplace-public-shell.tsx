import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
export default function MarketplacePublicShell({ children }: { children: ReactNode }) {
  return <main className="marketplace-public">
    <header className="marketplace-public-header"><div className="container marketplace-public-header-inner">
      <Link className="marketplace-wordmark" href="/" aria-label="ROAM home"><span className="marketplace-wordmark-mark">R</span><span>ROAM</span></Link>
      <nav className="marketplace-public-nav" aria-label="Marketplace navigation"><Link href="/marketplace">Marketplace</Link><Link href="/become-a-host">Become a host</Link><Link href="/early-access">For renters</Link></nav>
      <div className="marketplace-header-actions"><Link className="marketplace-business-link" href="/#plans">For rental businesses</Link><Link className="marketplace-header-cta" href="/early-access">Get early access <ArrowUpRight size={15}/></Link></div>
    </div></header>
    {children}
    <footer className="marketplace-public-footer"><div className="container marketplace-footer-inner">
      <div><span className="marketplace-footer-brand">ROAM</span><p>Move more. Manage smarter.</p></div>
      <div className="marketplace-footer-links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/">ROAM home</Link></div>
      <span className="marketplace-footer-copy">© {new Date().getFullYear()} ROAM</span>
    </div></footer>
  </main>;
}
