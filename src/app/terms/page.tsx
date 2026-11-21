import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions | ROAM",
  description: "Terms governing access to and use of ROAM rental operations software and marketplace features.",
};

export default function TermsPage() {
  return <main className="legal-page"><div className="container">
    <header className="legal-nav">
      <Link className="brand" href="/"><span className="brand-symbol">R</span><span className="brand-word">ROAM</span></Link>
      <Link href="/">Back to home ↗</Link>
    </header>
    <article className="legal-content">
      <div className="eyebrow">GENERAL PLATFORM TERMS</div>
      <h1>Terms &amp; Conditions</h1>
      <p className="legal-updated">Effective date: November 21, 2026 · Last updated: November 21, 2026</p>
      <div className="legal-notice">
        These general terms cover ROAM's rental-management software, website and marketplace features. Marketplace interest forms are not bookings or vehicle listings. Any live marketplace transaction, host onboarding, payment or rental may be subject to additional terms displayed before you proceed. **Operator details that must be completed before public launch:** [INSERT FULL LEGAL NAME OF ROAM OPERATOR], [INSERT BUSINESS ADDRESS] and [INSERT WORKING SUPPORT CONTACT]. This general draft requires review by qualified Philippine counsel against the final service model.
      </div>

      <h2>1. The ROAM service and operator</h2>
      <p>ROAM (Rental Operations and Asset Management) provides online software and related tools for vehicle rental businesses, including account and workspace management, vehicle and fleet records, booking workflows, customer records, inspections, communications, reporting and subscription administration. ROAM may also make marketplace discovery, host and renter onboarding, booking or related features available in stages.</p>
      <p>The operator of the service is <b>[INSERT FULL LEGAL NAME OF THE INDIVIDUAL OR REGISTERED ENTITY OPERATING ROAM]</b>, with business address at <b>[INSERT BUSINESS ADDRESS]</b> (“ROAM”, “we”, “us” or “our”). The operator's working support contact is <b>[INSERT WORKING SUPPORT EMAIL OR CONTACT CHANNEL]</b>. “You” means the individual accessing the service or the business you are authorized to represent.</p>

      <h2>2. Acceptance, eligibility and authority</h2>
      <p>By creating an account, accessing a workspace or using a ROAM feature, you agree to these Terms. If you use ROAM for a business, you represent that you are authorized to bind that business to these Terms. You must provide accurate, current and complete information, keep it updated, and have the legal capacity required to use the relevant service. Marketplace host and renter features may have additional age, identity, licence or eligibility requirements.</p>

      <h2>3. Scope and additional terms</h2>
      <p>These Terms govern general use of ROAM. Specific features may be subject to additional terms, plan descriptions, booking conditions, host rules, cancellation policies, payment instructions or privacy notices shown when you use them. If an additional term clearly applies to a particular feature or transaction, it supplements these Terms and prevails only to the extent of a direct conflict for that feature or transaction. Mandatory legal rights and obligations remain unaffected.</p>
      <p>Marketplace pages and early-access forms are currently an expression-of-interest service only. Submitting an interest form does not create an account, publish a vehicle listing, approve a host, guarantee early access, confirm a reservation, enter into a rental contract or authorize a payment.</p>

      <h2>4. Accounts, security and workspace administration</h2>
      <p>You are responsible for maintaining the confidentiality of your sign-in details, verification codes and private access links, using appropriate devices and security practices, and promptly notifying us if you suspect unauthorized access. You must not share credentials in a way that compromises security or use another person's account without authority.</p>
      <p>Workspace owners and administrators are responsible for choosing authorized users, assigning appropriate roles, reviewing access when staff leave or responsibilities change, and ensuring that their team members use the workspace lawfully. You are responsible for activity carried out through your account, except to the extent caused by our own failure to meet an obligation that cannot lawfully be excluded.</p>

      <h2>5. ROAM as software provider and marketplace platform</h2>
      <p>For rental businesses using the management software, ROAM supplies technology and workflow tools. The rental business remains responsible for its own rental business, vehicles, staff, customers, operating licences, legal compliance, vehicle maintenance, pricing, rental conditions and performance of its rental contracts.</p>
      <p>Where marketplace features are made available, ROAM may provide tools that help users discover, communicate with or transact with independent vehicle owners or rental businesses. Unless the relevant listing, checkout or transaction document expressly identifies ROAM as the rental provider or contracting party, the vehicle and rental service are offered by the host or rental business identified for that offer. The rental agreement is between the renter and that provider. ROAM does not, merely by providing a listing or communication tool, own the vehicle or become the vehicle's lessor, driver, insurer or maintenance provider.</p>
      <p>The actual legal role and obligations of ROAM depend on the features it operates and the control it exercises over a transaction. Nothing in these Terms is intended to avoid, contract out of or reduce any duty that applicable law imposes on ROAM as a digital platform, e-marketplace, service provider or other regulated participant.</p>

      <h2>6. Responsibilities of rental businesses and hosts</h2>
      <p>Each rental business or host is responsible for ensuring that it has the legal right and authority to offer each vehicle and rental service. It must provide accurate, complete and current listing and business information; disclose the provider's identity and contact details as required; set lawful and transparent prices, deposits and conditions; and comply with applicable tax, consumer, business registration, licensing, insurance, road safety and other legal requirements.</p>
      <p>Hosts and rental businesses are responsible for the roadworthiness, maintenance, cleanliness, legal registration, required insurance, safety equipment, availability, handover and return of their vehicles, and for accurately describing vehicle condition, restrictions and included services. They must respond to booking requests, honor confirmed commitments, handle customer support and complaints, and apply fair and lawful cancellation, refund and security-deposit practices.</p>
      <p>ROAM may request business information, identity or registration documents, vehicle details or other evidence before enabling a listing or feature, and may review, restrict or remove content where appropriate. Any document review, verification badge, screening or platform check is limited to the stated scope and time of that check. It is not a warranty, guarantee, insurance policy, safety certification or substitute for a user's own checks, and does not relieve a host of its responsibilities. This does not limit any verification or oversight duty imposed on ROAM by law.</p>

      <h2>7. Responsibilities of renters and customers</h2>
      <p>Renters must provide accurate booking and contact information, satisfy the provider's lawful age and driver-licence requirements, use the vehicle only as permitted, comply with road and safety laws, and follow the rental agreement and handover instructions. A renter should review the provider's identity, vehicle description, price, deposit, mileage or usage restrictions, insurance information, cancellation conditions and other rental terms before confirming a rental.</p>
      <p>Renters must not misuse a vehicle, permit an unauthorized driver, use it for unlawful purposes, conceal material information, or submit false documents or payment references. Any required licence, permit, deposit or eligibility check is determined by applicable law and the relevant rental provider's disclosed conditions.</p>

      <h2>8. Listings, availability and information</h2>
      <p>Vehicle descriptions, photographs, availability, rates, location information and provider details are generally supplied by the relevant host or rental business. Users must not post misleading, unlawful, infringing, discriminatory, unsafe or unauthorized listings or content. Prices, discounts, taxes, deposits, inclusions and material conditions must be clearly disclosed before a customer commits to a transaction.</p>
      <p>ROAM may use reasonable automated or manual measures to moderate listings, detect suspicious activity, improve search results or enforce platform rules. A listing's appearance on ROAM is not a representation that the vehicle is suitable for a particular journey or that a provider will perform as expected.</p>

      <h2>9. Booking requests, cancellations, refunds and payments</h2>
      <p>A booking request is not confirmed unless the relevant rental provider or the ROAM booking flow clearly confirms it. The rental provider is responsible for honoring a confirmed rental and for the vehicle or service supplied. The provider's disclosed rental and cancellation terms, the booking confirmation and applicable law govern changes, cancellations, refunds, deposits, damage claims and other rental matters.</p>
      <p>Any payment method, payment recipient, service fee, deposit, refund process or timing will be identified in the relevant checkout, invoice or transaction instructions before you pay. Do not send funds to an account or person unless the payment instructions identify that recipient. Where a third-party payment provider is used, its terms and privacy notice may also apply. ROAM's role in receiving, holding, transmitting or refunding funds, if any, will be stated in the relevant transaction flow and applicable supplementary terms. Nothing here limits statutory refund or consumer remedies.</p>
      <p>At the current marketplace pre-launch stage, ROAM's public marketplace interest forms do not accept bookings or payments. Do not treat a waitlist response or host interest acknowledgement as a reservation or listing approval.</p>

      <h2>10. Plans, subscriptions and service fees</h2>
      <p>Subscription tiers, prices, trial periods, capacity limits, billing frequency and included features are described on the ROAM website or within the relevant workspace and may change for future subscription periods with appropriate notice. You are responsible for reviewing the plan selected and maintaining accurate billing information. Any applicable taxes, fees, due dates, accepted payment methods and manual verification requirements will be shown in the billing instructions.</p>
      <p>Unless a plan or checkout expressly states otherwise, a subscription is not automatically renewed or charged by a payment card. A payment submission or receipt uploaded for manual review is not proof that payment has been accepted. A paid feature or plan change may remain pending until ROAM verifies the payment and confirms activation. We will not represent an unverified payment as received.</p>

      <h2>11. Acceptable use</h2>
      <p>You must use ROAM lawfully and only for the purpose for which a feature is provided. You must not: (a) submit false, misleading, stolen or unauthorized information; (b) infringe intellectual property, privacy or other rights; (c) harass, defraud, threaten or harm another user; (d) publish unlawful, discriminatory, unsafe or prohibited listings; (e) upload malware or attempt to disrupt, probe or gain unauthorized access to systems or data; (f) scrape, copy, reverse engineer or commercially exploit the service except as permitted by law; (g) bypass usage, security or subscription restrictions; or (h) use ROAM to facilitate unlawful vehicle use, rental activity, payments or other transactions.</p>

      <h2>12. Personal information and user data</h2>
      <p>Our handling of personal information is described in the ROAM Privacy Policy, which forms part of the information governing your use of the service. You must not upload or disclose personal information unless you have the authority and lawful basis to do so. Rental businesses are responsible for providing suitable privacy notices to their customers and staff, limiting access to authorized personnel, responding to requests they control and following applicable retention and security requirements.</p>
      <p>Where ROAM processes customer or staff information on a rental business's behalf, the business must provide lawful instructions and ensure that any required data-processing agreement or additional terms are in place. You must notify us promptly of any suspected unauthorized access or disclosure involving information submitted through your account.</p>

      <h2>13. User content and intellectual property</h2>
      <p>You retain ownership of content and information you lawfully submit, subject to the rights of other people. You grant ROAM a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, adapt for technical display, transmit and display that content only as reasonably necessary to operate, secure, support and improve the feature you use, including displaying an authorized vehicle listing to potential renters. This licence ends when the content is deleted from the service, except for copies retained in backups, legal records or as otherwise permitted by law.</p>
      <p>ROAM and its software, platform design, branding, documentation and related intellectual property are owned by or licensed to the operator. Subject to these Terms and any applicable plan, we grant you a limited, revocable, non-exclusive and non-transferable right to use the service for its intended purpose. No other rights are granted by implication.</p>

      <h2>14. Third-party services and links</h2>
      <p>ROAM may rely on or link to third-party hosting, communications, payment, mapping, identity, storage or other services. Those services may be subject to separate terms, privacy notices, availability limits and fees. We are not responsible for independent third-party products or services, except to the extent applicable law makes us responsible or our own conduct gives rise to liability. You should review the third party's terms before using its service.</p>

      <h2>15. Availability, changes and beta features</h2>
      <p>We may update, improve, suspend or discontinue features to maintain security, comply with law, respond to operational needs or develop the service. We aim to keep ROAM available and reliable but do not guarantee uninterrupted, error-free or universally compatible operation. Maintenance, outages, internet or telecommunications problems, third-party failures and events outside our reasonable control may affect access.</p>
      <p>Early-access, preview, beta or experimental features may be incomplete or change without notice and should not be relied on as the sole record for a critical business process. You remain responsible for maintaining your own appropriate records and backups.</p>

      <h2>16. Suspension and termination</h2>
      <p>We may restrict, suspend or terminate access where reasonably necessary to protect users or the service, investigate suspected fraud or security incidents, address a breach of these Terms, respond to non-payment, comply with law or prevent harm. Where reasonably practicable, we will provide notice and an opportunity to address the issue. We may act immediately where urgent security, safety, legal or fraud concerns require it.</p>
      <p>You may stop using ROAM and request account closure through the available account or support channel. Closure does not automatically cancel obligations or rental contracts already entered into with a provider. We may retain limited information where required or permitted by law, to resolve disputes, maintain security or complete legitimate record-keeping.</p>

      <h2>17. Disclaimers</h2>
      <p>To the fullest extent permitted by law, ROAM is provided on an “as available” basis. We do not warrant that the service will meet every business requirement, produce a particular financial result, generate rental demand, prevent every error or security incident, or ensure the accuracy or conduct of independent hosts, renters or rental businesses. We do not guarantee a vehicle's condition, suitability, availability, legal status, insurance coverage or a provider's ability to perform.</p>
      <p>ROAM does not provide legal, tax, accounting, insurance, mechanical or travel advice. Users are responsible for obtaining advice and checks appropriate to their business and transaction. Nothing in these Terms excludes a warranty, representation, duty or consumer protection that applicable law does not allow us to exclude.</p>

      <h2>18. Limitation of liability</h2>
      <p>To the maximum extent permitted by applicable law, ROAM will not be liable for indirect, incidental, special, exemplary or consequential loss, or loss of profit, revenue, business opportunity, goodwill or anticipated savings arising from use of the service, where such loss may lawfully be excluded. We are not responsible for loss caused by inaccurate information supplied by a user, a host's or renter's conduct, a rental provider's failure to perform, or an independent third-party service, except to the extent our own act or omission is legally responsible for that loss.</p>
      <p>Nothing in these Terms limits or excludes liability for fraud, wilful misconduct, gross negligence, death or personal injury where exclusion is prohibited, breach of mandatory privacy or consumer obligations, or any other liability that cannot lawfully be limited or excluded. Nothing in these Terms removes a user's right to pursue remedies available under applicable law. Any limitation applies only to the extent a court or competent authority would permit it.</p>

      <h2>19. Indemnity</h2>
      <p>To the extent permitted by law, you agree to be responsible for and to indemnify the ROAM operator and its personnel against third-party claims, losses and reasonable costs arising from your unlawful conduct, your material breach of these Terms, content or documents you submit without authority, or a rental or other transaction you offer or enter into, except to the extent the claim was caused by ROAM's own unlawful act, breach, negligence or conduct for which ROAM is legally responsible. We will give reasonable notice of a claim where practicable and will not agree to a settlement that imposes a non-monetary obligation on you without your consent, not to be unreasonably withheld.</p>

      <h2>20. Complaints and dispute resolution</h2>
      <p>For a concern about ROAM, use the support or complaint channel published by the operator. For a concern about a vehicle, host, rental condition, cancellation or rental performance, contact the rental provider identified in the relevant offer or booking confirmation. We may assist with communications or review a platform-rule complaint, but this does not make ROAM the rental provider or replace a party's legal rights.</p>
      <p>Where an internet transaction is covered by Philippine law, the parties may use the applicable internal redress mechanism and any required escalation process. Nothing in these Terms prevents a user from bringing a complaint before a court, regulator or agency where permitted by law, or shortens a statutory deadline or remedy.</p>

      <h2>21. Governing law and general provisions</h2>
      <p>These Terms are governed by the laws of the Republic of the Philippines, without excluding mandatory protections or rights that apply in another jurisdiction. Disputes are subject to the jurisdiction of the competent courts or authorities, with venue and procedure determined by applicable law. If a provision is found invalid or unenforceable, the remaining provisions continue to apply to the extent legally possible. A failure to enforce a provision is not a waiver of it. These Terms, together with feature-specific terms that apply to you, form the agreement for your use of ROAM.</p>

      <h2>22. Updates and contact</h2>
      <p>We may update these Terms as ROAM changes or legal requirements develop. We will update the effective date and provide notice of material changes through the website, platform or another appropriate channel. Where required, we will request acceptance before you continue to use the affected service.</p>
      <p><b>Operator:</b> [INSERT FULL LEGAL NAME]</p>
      <p><b>Business address:</b> [INSERT BUSINESS ADDRESS]</p>
      <p><b>Support and legal notices:</b> [INSERT WORKING SUPPORT EMAIL OR CONTACT CHANNEL]</p>
      <p>These details must be completed before public launch.</p>
      <p><Link href="/privacy">Read the ROAM Privacy Policy</Link></p>
      <p><Link href="/">Return to ROAM home</Link></p>
    </article>
  </div></main>;
}
