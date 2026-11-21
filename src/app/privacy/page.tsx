import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How ROAM collects, uses, shares and protects personal information.",
};

export default function PrivacyPage() {
  return <main className="legal-page"><div className="container">
    <header className="legal-nav">
      <Link className="brand" href="/"><span className="brand-symbol">R</span><span className="brand-word">ROAM</span></Link>
      <Link href="/">Back to home ↗</Link>
    </header>
    <article className="legal-content">
      <div className="eyebrow">YOUR INFORMATION MATTERS</div>
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Effective date: November 21, 2026 · Last updated: November 21, 2026</p>
      <div className="legal-notice">
        **Operator details that must be completed before public launch:** Replace the fields below with the actual legal operator's full name, business address and working privacy contact. This policy is a general product draft, not a substitute for review against ROAM's final data flows and applicable law.
      </div>

      <h2>1. Who we are and what this policy covers</h2>
      <p>ROAM (Rental Operations and Asset Management) is a software platform for vehicle rental businesses and, as marketplace features are introduced, people who want to discover or provide rental vehicles. In this policy, “ROAM”, “we”, “us” and “our” mean the operator of the ROAM service: <b>[INSERT FULL LEGAL NAME OF THE INDIVIDUAL OR REGISTERED ENTITY OPERATING ROAM]</b>, with business address at <b>[INSERT BUSINESS ADDRESS]</b>.</p>
      <p>This policy explains how personal information may be collected, used, stored and shared when you visit the ROAM website, create an account, use a workspace, interact with a rental business through ROAM, submit a marketplace interest form, or use a marketplace feature that we make available. A feature may have an additional notice or terms that explain its particular data use.</p>

      <h2>2. Our role and the role of rental businesses</h2>
      <p>Our role depends on the information and feature involved. We generally determine how account registration, authentication, platform security, subscriptions, platform administration and marketplace waitlist information are handled. For those activities, we may act as a personal information controller under applicable privacy law.</p>
      <p>When a rental business uses ROAM to manage its own customers, bookings, rental documents, staff or vehicle records, that business generally decides why and how those records are collected. The rental business may therefore be the personal information controller for those records, while ROAM may process them on the business's documented instructions as a service provider or personal information processor. The rental business is responsible for giving its customers and staff appropriate notices and having a lawful basis for the information it submits.</p>
      <p>These descriptions explain the intended allocation of responsibilities; the legal role of each party depends on what it actually does in a particular processing activity. You should direct questions about a rental business's own customer records to that business first. We will assist the business and the relevant individual where required by law.</p>

      <h2>3. Personal information we may collect</h2>
      <ul>
        <li><b>Account and contact information:</b> name, email address, phone number, login and verification information, account preferences, and communications with us.</li>
        <li><b>Business and workspace information:</b> business name, contact details, branch information, staff accounts, roles, workspace settings and subscription selections.</li>
        <li><b>Rental operations information:</b> customer contact details, booking requests and history, vehicle details, rental dates, prices, deposits, inspection notes, handover and return records, messages and related transaction records supplied by a rental business or its customers.</li>
        <li><b>Documents and images:</b> files, photographs, receipts, identification or driver's licence information, vehicle documents and inspection photographs where a user or rental business chooses or is required to submit them for a particular workflow. Do not upload information that is unnecessary for the requested service.</li>
        <li><b>Billing and subscription information:</b> plan, invoice and payment status, payment references, proof of payment or refund information submitted for manual review, and related support records. Payment card or bank login credentials should be provided only to an appropriately designated payment provider, not in ordinary ROAM forms or messages.</li>
        <li><b>Marketplace interest information:</b> for host and renter early-access forms, name, email address, optional phone number, city or area, host type and vehicle category preferences, together with the time and version of the contact consent recorded.</li>
        <li><b>Technical and usage information:</b> IP address, browser and device information, session and authentication events, logs, security signals, cookie or local preference data, and diagnostics needed to operate and protect the service.</li>
      </ul>
      <p>Some documents or rental records may contain sensitive personal information. They should be collected only where necessary, with the appropriate lawful basis and safeguards. ROAM does not ask users to provide sensitive information through a general marketplace waitlist form.</p>

      <h2>4. Where information comes from</h2>
      <p>Information may come directly from you, from the rental business or workspace that you use, from another authorized account user, from a service provider supporting the platform, or from public or lawful verification sources where a particular feature and applicable law permit it. We may receive updated information when you edit a profile, submit a form, make a booking request, upload a document or contact support.</p>

      <h2>5. Why we use information and lawful grounds</h2>
      <p>We may use personal information, as appropriate and permitted by law, to:</p>
      <ul>
        <li>create and secure accounts, verify access and administer workspaces;</li>
        <li>provide fleet, branch, customer, booking, inspection, messaging, reporting and subscription features requested by a rental business;</li>
        <li>facilitate communications and booking requests between customers and rental businesses;</li>
        <li>operate marketplace interest lists, understand demand by location and vehicle category, and send the early-access updates a person has requested or consented to receive;</li>
        <li>record and review subscription payments, refunds, customer support matters and platform administration;</li>
        <li>maintain, troubleshoot, secure and improve the service, prevent fraud or misuse, investigate incidents and enforce our terms;</li>
        <li>meet legal, regulatory, accounting and record-keeping obligations, and establish, exercise or defend legal claims.</li>
      </ul>
      <p>Depending on the activity, a lawful ground may include your consent, steps taken at your request before or in connection with a contract, performance of a contract, compliance with a legal obligation, protection of vital interests, or another ground recognized by applicable law. Where consent is the basis, you may withdraw it, subject to legal and contractual limits. Withdrawal does not make prior lawful processing unlawful and does not prevent processing that has another valid legal basis.</p>

      <h2>6. Marketplace waitlist and communications</h2>
      <p>Submitting a host or renter interest form does not create a vehicle listing, approve a host, verify ownership, reserve a vehicle, make a booking or collect payment. We use the submitted information to record the interest, assess broad launch demand, and contact the person about the request and marketplace early access. A person may opt out of optional early-access or promotional communications at any time using the method provided in the message or by contacting the privacy contact below.</p>
      <p>We do not ask for a driver's licence, government ID, vehicle registration or payment details in the waitlist forms. Do not send those documents unless a later feature clearly requests them through an approved and secure process.</p>

      <h2>7. How information may be shared</h2>
      <p>We do not sell personal information. We may disclose information, limited to what is reasonably necessary, to:</p>
      <ul>
        <li>the rental business, workspace owner or authorized team members responsible for the relevant booking or business records;</li>
        <li>the customer, host or other participant where disclosure is needed to respond to a request or carry out a feature you use;</li>
        <li>service providers that support hosting, databases, file storage, email delivery, authentication, security, diagnostics, payment processing or customer support, under appropriate safeguards and instructions where required;</li>
        <li>professional advisers, auditors, insurers or potential successors in connection with a legitimate business, legal or corporate purpose, subject to confidentiality and applicable law; and</li>
        <li>courts, regulators, law enforcement or other authorities where disclosure is legally required or reasonably necessary to protect rights, safety, users or the service.</li>
      </ul>
      <p>Where third parties independently determine their own processing purposes, their own privacy notices may also apply. We do not control their independent practices.</p>

      <h2>8. Storage, security and retention</h2>
      <p>We use reasonable organizational, technical and physical safeguards intended to protect information against unauthorized access, loss, misuse, alteration or disclosure. Depending on the information and feature, safeguards may include access controls, authentication, tenant separation, encryption or secure transmission, backups, logging and restricted administrative access. No internet service or storage method can be guaranteed to be completely secure.</p>
      <p>We retain personal information only for as long as it is reasonably necessary for the purpose for which it was collected, to operate the relevant account or service, to meet legal and record-keeping obligations, to resolve disputes, or to establish, exercise or defend legal claims. Account and workspace information is generally retained while the account or workspace is active and for a reasonable period after closure where needed for those purposes. Booking, financial, tax, payment and legal records may be retained for the period required by applicable law. Authentication codes and temporary security records are kept only for their limited operational or security purpose. Marketplace interest records are kept while the waitlist or related launch activity remains relevant and for a reasonable period afterwards, unless a person withdraws consent or asks for deletion and no other lawful retention ground applies. Information is then deleted, anonymized or securely disposed of where appropriate.</p>
      <p>Actual retention may vary by record type, legal requirement, unresolved claim, backup cycle and the rental business's own retention decisions. A rental business may be required to retain its own booking or customer records even after a user closes a ROAM account.</p>

      <h2>9. Processing outside the Philippines</h2>
      <p>ROAM and its service providers may store or process information in the Philippines or in other countries where infrastructure or support services are located. Where personal information is transferred or accessed across borders, we will use safeguards and contractual or other measures required by applicable law. The privacy protections and government access rules in another country may differ from those in the Philippines.</p>

      <h2>10. Your privacy rights and choices</h2>
      <p>Subject to applicable law and its exceptions, you may have the right to be informed, access your personal information, request correction, object to or withdraw consent for certain processing, request blocking or erasure, request data portability where applicable, and lodge a complaint with the National Privacy Commission. You may also seek damages where provided by law.</p>
      <p>To make a request about information controlled by ROAM, contact <b>[INSERT WORKING PRIVACY EMAIL OR PRIVACY REQUEST CHANNEL]</b>. We may need to verify your identity and clarify the request before acting. If the information is controlled by a rental business, please contact that business using the contact information it provided; we will assist that business where required. We will respond within the period required by applicable law.</p>

      <h2>11. Cookies and similar technologies</h2>
      <p>ROAM may use cookies, local storage or similar technologies that are necessary for sign-in, session security, service operation, user preferences and other functions you request. If optional analytics, advertising or other non-essential technologies are introduced, we will provide appropriate notice and obtain consent where required. You can manage cookies through your browser settings, but blocking essential cookies or storage may affect some features.</p>

      <h2>12. Children and eligibility</h2>
      <p>ROAM is intended for business operators and individuals who are legally able to use the relevant service. The platform is not directed to children and we do not knowingly seek to collect children's personal information without the required authority and safeguards. A rental business and any host must independently apply lawful age, licence and eligibility requirements to a rental transaction.</p>

      <h2>13. Changes to this policy</h2>
      <p>We may revise this policy when the service, data flows, service providers or legal requirements change. We will update the effective date and provide notice of material changes through the platform, website or another appropriate channel. Where required, we will obtain fresh consent or ask you to acknowledge or accept the revised terms before the relevant processing or feature continues.</p>

      <h2>14. Operator and privacy contact</h2>
      <p><b>Platform operator:</b> [INSERT FULL LEGAL NAME]</p>
      <p><b>Business address:</b> [INSERT BUSINESS ADDRESS]</p>
      <p><b>Privacy contact:</b> [INSERT WORKING PRIVACY EMAIL OR REQUEST CHANNEL]</p>
      <p><b>General support:</b> [INSERT WORKING SUPPORT CONTACT]</p>
      <p>These details must be completed and tested before ROAM publicly invites users to submit personal information.</p>
      <p><Link href="/terms">Read the ROAM Terms &amp; Conditions</Link></p>
      <p><Link href="/">Return to ROAM home</Link></p>
    </article>
  </div></main>;
}
