# ROAM Marketplace Legal Review and Launch Notes
**Internal working review — 21 November 2026**  
**Repository:** engrken/roam  
**Review scope:** Current Privacy Policy and Terms & Conditions, plus draft Host Agreement and Renter Booking Terms.  
**Jurisdictional assumption:** Philippine law; self-drive vehicle rentals.

> **Important limitation.** This is a structured legal-drafting and issue-spotting review, not a Philippine legal opinion and not a substitute for advice from a lawyer licensed in the Philippines who has reviewed the actual business, payment arrangements, insurance policies, data flows, listings, checkout screens and operational procedures. The drafts are not ready for signature or public use until every relevant issue below is resolved.

## 1. Executive assessment

The current Privacy Policy and general Terms & Conditions are useful pre-launch framework documents. They are materially better than a generic disclaimer because they identify the intended roles of ROAM, hosts and rental businesses; describe categories and purposes of personal information; recognize consumer and privacy rights; and avoid a blanket exclusion of all ROAM liability.

They are **not yet launch-complete**. They contain operator/contact placeholders and the privacy retention language is still broad. More importantly, the legal role of a marketplace is determined by its real functionality and conduct, not simply by describing itself as a technology provider. The Internet Transactions Act (ITA), Republic Act No. 11967, imposes e-marketplace/digital-platform obligations and recognizes potential subsidiary or solidary liability in specified circumstances. If ROAM connects online consumers with rental businesses and retains oversight over consummation of transactions, it may fall within the statutory e-marketplace definition, depending on the actual product design and operations.

Two additional marketplace agreements have therefore been prepared as internal Markdown drafts:

- **Host Agreement** — a bilateral ROAM–Host participation agreement. It requires Host merchant information, authority to rent, lawful registration, roadworthiness, appropriate insurance, transparent pricing, handover reports, refunds, deposit evidence, complaints and data safeguards.
- **Renter Booking Terms** — the vehicle rental contract terms between the identified Host and Renter for a specific confirmed booking. It requires a complete Booking Summary before confirmation and sets out renter eligibility, payment, cancellation, deposit, handover/return, use, accident, insurance, privacy and complaint processes.

The documents are intentionally not published as live routes. The marketplace remains pre-launch / interest-only, and no booking flow, payment model or final rental policy has been assumed.

## 2. Review of current Privacy Policy

### Strengths

The Policy explains the service and intended data roles; distinguishes account/platform processing from rental-business records; identifies relevant categories of data; explains purposes and possible lawful grounds; addresses marketplace waitlist data; describes recipients, security, cross-border processing, rights, cookies, children and changes; and correctly warns that a rental business may be a separate controller for its customer and staff records.

The waitlist disclosure is particularly important: it says an interest submission is not a listing, host approval, booking, reservation or payment, and it does not ask for driving licences, government IDs or payment details.

### Required changes before public launch

1. **Identify the legal operator.** Replace every operator-name and address placeholder. Provide the actual legal name, trade name (if used), geographic/business address, working general support contact and working privacy request channel. Make sure the details are consistent across the homepage, legal pages, platform footer, merchant disclosures and invoices.
2. **Complete a retention schedule.** The present phrases “reasonable period” and “while the waitlist remains relevant” are too open-ended as a final operational notice. Establish record-by-record periods or objective retention criteria for account records, booking records, payment/tax records, driver licences/IDs, customer support, incident/claim evidence, audit/security logs, waitlist data and backups. Confirm that deletion, archival and backup-expiry processes actually follow that schedule.
3. **Treat driving-licence and government-ID processing as a specific privacy issue.** Under RA 10173, government-issued information peculiar to an individual, including licences, is included in the statutory definition of sensitive personal information. Identify and document a valid Section 13 basis before collection. Where consent is the basis, obtain specific, informed consent separately from general Terms acceptance. State the precise purpose, recipients, storage period, access restrictions and deletion criteria. Collect the minimum data necessary; do not require a full ID image where a narrower check will work.
4. **Document host/platform data roles.** The general Policy describes possible controller/processor roles but does not replace operational contracts. Execute data-processing agreements where one party processes data solely on the other's instructions, and document data-sharing arrangements where parties independently determine purposes or disclose data. Address breach notices, data-subject requests, subcontractors, access control, retention/deletion and cross-border vendors.
5. **Match security statements to actual controls.** Confirm access control, tenant isolation, encryption in transit/at rest where used, backup protections, incident response, vendor access and breach escalation. Do not claim a control that is not implemented.
6. **Prepare feature-specific notices.** Give a concise collection notice at each upload or verification step, especially for sensitive ID/licence data, and a separate notice for any GPS/telematics, location tracking, facial match, background screening or automated eligibility decision if introduced.

## 3. Review of current general Terms & Conditions

### Strengths

The Terms correctly distinguish ROAM's SaaS service from the rental service provided by the Host; state that the actual legal allocation depends on real activity; assign Hosts responsibility for legal authority, accurate listings, roadworthiness, maintenance, insurance, pricing, handover and complaint support; require Renters to comply with lawful use and licence requirements; require clear checkout disclosures; avoid treating waitlist forms as bookings; and preserve mandatory consumer, privacy and platform duties.

The liability and indemnity clauses are more defensible than a blanket “no liability” disclaimer because they preserve liability that cannot legally be excluded and carve back ROAM's own misconduct or statutory responsibility.

### Required changes or operational controls

1. **Do not rely on the platform disclaimer to determine legal status.** The ITA definition of an e-marketplace turns on the platform's business model and oversight of the transaction. Listing moderation, booking acceptance, in-platform payment, refunds, dispute handling, ranking, post-booking support and control of cancellation may all matter to the factual analysis. Have Philippine counsel assess the live flow.
2. **Implement merchant onboarding before listings.** For online merchants, collect and maintain the identity/business registration documents, geographic address, contact details and other details required by the ITA and its IRR. Display the information required by law or provide the legally compliant means to communicate with merchants. Individual Hosts and registered rental companies may have different document requirements.
3. **Make internal redress real, not just textual.** The seven-calendar-day deemed-exhaustion period in ITA Section 24 requires an accessible, staffed process with a timestamped intake record, acknowledgement, case owner, evidence log, escalation, outcome and retention process. Set an internal service target shorter than seven days.
4. **Make booking disclosures mandatory fields.** The current general Terms say the provider's cancellation and rental terms govern, but those policies must be shown before payment and be specific for each Booking. The new Booking Summary checklist is designed to prevent confirmation while material fields are blank.
5. **Choose and document the payment model.** The checkout, Host Agreement and Renter Terms must consistently identify the merchant/payee, payment recipient, processor, payout, refunds, chargebacks and responsibility for tax invoices. Do not use “escrow”, “held in trust” or “merchant of record” terminology unless it describes the actual legally reviewed arrangement.
6. **Keep statutory rights visible.** Do not use a Host waiver, Renter acknowledgement, deposit clause, refund policy or liability cap to contract out of mandatory consumer rights, data rights or statutory platform duties. The Consumer Act includes implied warranties for services supplied to consumers in the course of business.
7. **Preserve acceptance evidence.** Store the exact version of the general Terms, Host Agreement, Renter Booking Terms, Booking Summary, cancellation/deposit/insurance disclosures, affirmative acceptance event, timestamp, relevant authentication details and later changes accepted by the parties.
8. **Separate the Host–Renter contract from ROAM's platform contract.** The prepared Host Agreement is between ROAM and Host; the Renter Booking Terms create the rental contract between the named Host and Renter. Checkout must identify those parties and must not leave the actual rental provider ambiguous.

## 4. Key assumptions and limitations in the new drafts

The new forms assume:
- self-drive motor vehicle rentals in the Philippines;
- Host is the disclosed provider/lessor and Renter is the person taking possession;
- the rental contract is between Host and Renter, while ROAM supplies platform services;
- no specific commission, platform fee, payout timing, deposit amount, insurance limit, cancellation table or payment custody arrangement has been invented;
- Host-specific eligibility, mileage, fuel, late return, cleaning, driver, cancellation and deposit rules will be displayed in the Booking Summary before confirmation;
- ROAM's role is assessed by reference to the actual product and statutory obligations are preserved; and
- all statutory consumer, privacy, insurance and platform duties override inconsistent contract text.

If ROAM supplies chauffeurs, controls the Vehicle, owns or leases the fleet, sets the rental price, becomes the named rental provider, guarantees performance, handles all funds or otherwise assumes more operational control than assumed here, the agreements must be revised. The documents should also be revised for motorcycles, commercial trucks, cross-border rentals, delivery/fleet use or other regulated service models.

## 5. Decisions required before signing or publication

| Issue | Required decision / evidence | Why it matters |
|---|---|---|
| ROAM operator identity | Full legal name, entity type, address, working telephone, support and privacy contacts | Contracting party, privacy controller, marketplace disclosures |
| Actual marketplace role | Map who sets prices, confirms bookings, collects payment, controls refunds, handles disputes and provides post-booking support | Determines ITA duties and allocation of responsibilities |
| Host eligibility | Individual vs business criteria; identity and registration evidence; ownership/authority documents | Merchant onboarding, fraud, safety and ITA compliance |
| Vehicle scope | Self-drive only? Include motorcycles, vans, SUVs, trucks, chauffeur services? | Different permits, insurance and risk |
| Registration / permits | Determine required vehicle classification, local permits and authority for paid rental use | Lawful vehicle use |
| Insurance | Approved cover requirements; written insurer confirmation that rental and renter-drivers are covered; excess and exclusions | CTPL alone should not be assumed to cover damage to the rented Vehicle or all renter/passenger losses |
| Payment mechanics | Merchant/payee, payment provider, collection authority, custody, settlement, reserves, chargebacks, refunds and tax invoices | Contract accuracy, operational and regulatory risk |
| Commercial fees | Commission, platform fee, tax treatment, payout schedule and lawful deductions | Host agreement and checkout accuracy |
| Cancellation rules | Host cancellation and renter cancellation tables, refund timeline and no-show definition | Must be clear and accepted before booking |
| Security deposit | Amount, pre-authorization or collection, holder, deduction evidence, dispute and refund deadline | Consumer disputes and chargeback risk |
| Driver eligibility | Minimum age/experience, accepted licence types, foreign licence rules, additional drivers | Safety and enforceability |
| Sensitive-data handling | Section 13 lawful basis, specific notice/consent where applicable, secure storage, access and deletion schedule for licences/IDs | Data Privacy Act compliance |
| Complaints | In-app/email/telephone intake, named owner, acknowledgement and resolution targets, seven-day tracking | ITA redress compliance |
| Tax and receipts | Who issues Host rental invoice/receipt and platform fee receipt; Host tax onboarding | BIR and consumer disclosure |

## 6. Recommended launch sequence

1. Complete the operator's actual legal identity and public contact details.
2. Decide the business and payment model and obtain Philippine counsel's written assessment of ROAM's ITA status and associated obligations.
3. Define Host onboarding, identity/registration checks, title/authority evidence, vehicle eligibility, insurance criteria and recurring document expiry checks.
4. Finalize Host fees/payout terms, cancellation policy templates, security-deposit handling, renter fees and consumer refunds.
5. Complete privacy mapping, lawful-basis analysis for driver licences/IDs, privacy notices/consents, retention schedule and data-processing/data-sharing agreements.
6. Implement mandatory Booking Summary fields, versioned terms, explicit acceptance controls, downloadable records, condition reports, refund tracking, complaint intake and safety takedown process.
7. Have Philippine counsel review the final documents together with the product screens, actual payment/insurance contracts and operational policies before the marketplace accepts its first booking.

## 7. Legal sources for Philippine counsel's review

- **Republic Act No. 11967 (Internet Transactions Act of 2023):** [Lawphil text](https://lawphil.net/statutes/repacts/ra2023/ra_11967_2023.html). Relevant provisions include definitions and scope, e-marketplace duties, merchant information, online consumer remedies, internal redress (including the seven-calendar-day rule), and platform liability.
- **DTI–NPC Joint Administrative Order No. 24-03 (ITA IRR):** [Official DTI eCommerce copy](https://ecommerce.dti.gov.ph/wp-content/uploads/2024/06/Joint-Administrative-Order-No.-24-03-1.pdf). Includes merchant onboarding and e-marketplace operational requirements.
- **Republic Act No. 10173 (Data Privacy Act of 2012):** [Lawphil text](https://lawphil.net/statutes/repacts/ra2012/ra_10173_2012.html). Relevant provisions include sensitive personal information, transparency/legitimate purpose/proportionality, lawful bases, rights, security and retention.
- **Republic Act No. 7394 (Consumer Act of the Philippines):** [Supreme Court E-Library text](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/3302). Article 69 contains implied warranties for services supplied to consumers in the course of business.
- **Republic Act No. 8792 (Electronic Commerce Act):** [Lawphil text](https://lawphil.net/statutes/repacts/ra2000/ra_8792_2000.html). Relevant provisions recognize electronic documents, signatures and electronic contracting subject to authentication, integrity and applicable formalities.
- **Insurance Commission FAQs:** [Official Insurance Commission page](https://site.insurance.gov.ph/faqs/). Explains compulsory third-party motor vehicle liability insurance. Do not assume that compulsory third-party cover is comprehensive cover for damage to the rental Vehicle or every renter loss.

## 8. Bottom line

The new agreements provide a practical starting framework, not a guarantee of low or eliminated liability. The most important risk-reduction measures are operational: onboard legitimate Hosts, verify their authority and required documents, ensure the Vehicle and rental use are properly insured, make all prices/refund/deposit terms visible before checkout, preserve acceptance and inspection evidence, securely handle sensitive identity data, and respond promptly to safety and consumer complaints.

Do not activate live rentals merely by publishing these documents. Complete the decisions in Section 5 and obtain a Philippine legal review of the actual operating model first.
