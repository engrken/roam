import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions | ROAM",
  description: "General terms for using the ROAM rental management platform.",
};

export default function TermsPage() {
  return <main className="legal-page"><div className="container">
    <header className="legal-nav"><Link className="brand" href="/"><span className="brand-symbol">R</span><span className="brand-word">ROAM</span></Link><Link href="/">Back to home ↗</Link></header>
    <article className="legal-content">
      <div className="eyebrow">GENERAL PLATFORM TERMS</div><h1>Terms & Conditions</h1>
      <p className="legal-updated">General terms for the ROAM platform · Last updated: November 19, 2026</p>
      <div className="legal-notice">These terms govern use of ROAM as a software platform. They are not a vehicle rental agreement. Each rental business is responsible for preparing and displaying its own rental terms to customers. This general template should be reviewed and completed by the ROAM operator and qualified local counsel before production use.</div>
      <h2>1. About ROAM</h2><p>ROAM (Rental Operations and Asset Management) is a software platform that helps vehicle rental businesses manage vehicles, branches, customers, booking requests, inspections, communications and related business records. ROAM provides tools only; it does not itself rent, own, operate, inspect, insure or guarantee any vehicle listed by a rental business.</p>
      <h2>2. Agreement and eligibility</h2><p>By creating an account, accessing a workspace or using ROAM, you agree to these terms. If you use ROAM for a business, you confirm that you are authorized to act for that business. You must provide accurate information and have legal capacity to use the service.</p>
      <h2>3. Accounts and access</h2><p>You are responsible for keeping your sign-in credentials and private access links secure, maintaining accurate account information, and notifying the service operator if you suspect unauthorized access. Workspace owners are responsible for assigning appropriate access to their team members.</p>
      <h2>4. Rental businesses and customers</h2><p>Rental businesses independently determine their vehicles, availability, prices, deposits, eligibility requirements, rental conditions, pickup and return procedures, cancellations, refunds and customer support. A booking submitted through ROAM is a request unless and until the rental business confirms it. Any rental contract is between the rental business and its customer, not ROAM. Customers should read and agree to the rental business&apos;s own terms before proceeding with a rental.</p>
      <h2>5. User responsibilities</h2><p>You must use ROAM lawfully, provide information you are entitled to submit, respect other people&apos;s rights, and avoid uploading unlawful, misleading, malicious or unnecessary information. You must not attempt unauthorized access, interfere with the platform, bypass security controls, or misuse another user&apos;s data.</p>
      <h2>6. Data and privacy</h2><p>Use of personal information is described in the ROAM Privacy Policy. Rental businesses are responsible for ensuring they have an appropriate legal basis, notices and permissions for personal information they collect from their customers and staff. Access to customer documents and records should be limited to authorized personnel.</p>
      <h2>7. Plans, fees and availability</h2><p>Any applicable subscription price, plan limits, trial period, billing frequency and payment conditions will be presented separately when a plan is offered. Features may change as ROAM develops. We will make reasonable efforts to keep the service available, but do not guarantee uninterrupted or error-free operation.</p>
      <h2>8. Intellectual property</h2><p>ROAM and its software, branding, design and documentation are owned by or licensed to the platform operator. Subject to these terms and any applicable plan, users receive a limited, non-exclusive and non-transferable right to use the service for their authorized business purposes.</p>
      <h2>9. Suspension and termination</h2><p>Access may be limited or suspended where reasonably necessary to address security risks, unlawful activity, material breach, non-payment or legal requirements. Account closure, data export and retention will be handled according to the applicable service terms and legal obligations.</p>
      <h2>10. Disclaimers and liability</h2><p>ROAM is a business software tool and does not guarantee rental demand, revenue, customer eligibility, vehicle condition, availability or the accuracy of information entered by users. Nothing in these terms excludes any right or liability that cannot lawfully be excluded. Any additional liability allocation must be agreed in the final operator terms and remain subject to applicable law.</p>
      <h2>11. Changes to these terms</h2><p>We may update these terms to reflect changes to the service or applicable requirements. Material changes will be communicated through the platform or another appropriate channel. Where required, users will be asked to accept the updated version before continuing to use protected workspace features.</p>
      <h2>12. Governing law and contact</h2><p>The ROAM operator&apos;s legal name, registered address, governing law, dispute process and support contact must be confirmed and published before production launch. Mandatory rights under applicable law remain unaffected.</p>
      <p><Link href="/privacy">Read the ROAM Privacy Policy</Link></p><p><Link href="/">Return to ROAM home</Link></p>
    </article>
  </div></main>;
}
