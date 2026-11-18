import Link from "next/link";
import { ArrowRight, CalendarDays, FileUp, MessageCircle, ShieldCheck } from "lucide-react";

export default function CustomerHelpPage() {
 return <main className="roam-legal-page"><article className="roam-legal-document roam-public-help">
  <Link href="/" className="roam-auth-brand"><span className="roam-brand-mark">R</span> ROAM</Link>
  <p className="roam-auth-eyebrow">CUSTOMER HELP CENTER</p><h1>How your rental booking works</h1>
  <p>Use the rental business's ROAM booking page to request a vehicle, then follow your request through a private booking portal.</p>
  <section><h2><CalendarDays size={19}/> 1. Send a booking request</h2><p>Choose an available vehicle, select your pickup and return date and time, and enter your contact details. Review the estimate before submitting. Your request starts as Pending; it is not a confirmed reservation until the rental business approves it.</p></section>
  <section><h2><ShieldCheck size={19}/> 2. Keep your private portal link safe</h2><p>After submitting, you'll receive a booking reference and a private access link. Save the link somewhere secure and do not share it with anyone. Anyone with that link may be able to view and interact with your booking.</p></section>
  <section><h2><FileUp size={19}/> 3. Upload requested documents</h2><p>Open your private portal to upload requested identity or driver's license documents. Use clear images or PDF files and make sure the information is readable. The rental business reviews the documents and may contact you if anything else is needed.</p></section>
  <section><h2><MessageCircle size={19}/> 4. Message the rental team</h2><p>Use the message area in your portal to ask questions or reply to the rental team. Check the portal for status changes before pickup.</p></section>
  <section><h2>5. Pickup and return</h2><p>Follow the rental business's pickup instructions. Review the vehicle condition together before handover and again at return, and raise any concerns with the rental team.</p></section>
  <p className="roam-legal-note">ROAM provides the booking and communication tools. Rental approval, pricing, deposits, payment, insurance and rental conditions are handled by the rental business.</p>
  <Link href="/" className="roam-public-help-back">Back to ROAM <ArrowRight size={15}/></Link>
 </article></main>;
}
