import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CarFront, MapPin, Users, Gauge } from "lucide-react";
import MarketplacePublicShell from "@/components/marketplace-public-shell";
import { prisma } from "@/lib/prisma";
import { isMarketplaceListingPublic } from "@/lib/marketplace-host";
import { MarketplaceInquiryForm } from "@/components/marketplace-inquiry-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vehicle details | ROAM Marketplace" };
const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);

export default async function MarketplaceListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const publicEnabled = process.env.ROAM_MARKETPLACE_PUBLIC_ENABLED === "true";
  const inquiriesEnabled = process.env.ROAM_MARKETPLACE_INQUIRIES_ENABLED === "true";
  if (!publicEnabled) notFound();

  const listing = await prisma.marketplaceListing.findFirst({
    where: {
      id, isPublished: true, status: "PREQUALIFIED",
      hostProfile: { is: { status: "PREQUALIFIED" } },
      vehicle: { is: { status: "AVAILABLE" } },
      tenant: { is: { status: { in: ["ACTIVE", "TRIAL"] } } },
    },
    select: {
      id: true, headline: true, description: true, isPublished: true, status: true,
      hostProfile: { select: { status: true, displayName: true, city: true, province: true } },
      vehicle: { select: { status: true, type: true, make: true, model: true, year: true, dailyRate: true, seats: true, transmission: true, color: true } },
      tenant: { select: { status: true } },
    },
  });
  if (!listing || !isMarketplaceListingPublic({
    publicEnabled, isPublished: listing.isPublished, listingStatus: listing.status,
    hostStatus: listing.hostProfile.status, vehicleStatus: listing.vehicle.status,
    tenantStatus: listing.tenant.status,
  })) notFound();

  return <MarketplacePublicShell>
    <section className="bg-slate-50 px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-800"><ArrowLeft size={15}/> Back to vehicles</Link>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_.85fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="flex min-h-72 items-center justify-center bg-gradient-to-br from-slate-950 to-slate-700 text-cyan-200"><CarFront size={92}/></div>
            <div className="p-7"><p className="text-xs font-bold uppercase tracking-widest text-cyan-700">{listing.vehicle.type.replaceAll("_"," ")}</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{listing.headline}</h1><p className="mt-2 text-base text-slate-600">{listing.vehicle.make} {listing.vehicle.model} {listing.vehicle.year || ""}</p>
              {listing.description && <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-700">{listing.description}</p>}
              <div className="mt-7 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 text-sm text-slate-600">
                <div className="flex items-center gap-2"><Users size={16}/>{listing.vehicle.seats ? `${listing.vehicle.seats} seats` : "Seats not specified"}</div>
                <div className="flex items-center gap-2"><Gauge size={16}/>{listing.vehicle.transmission || "Transmission not specified"}</div>
                {listing.vehicle.color && <div>Color: {listing.vehicle.color}</div>}
              </div>
            </div>
          </div>
          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-7">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Rental rate</p><p className="mt-2 text-3xl font-bold text-slate-950">{money(Number(listing.vehicle.dailyRate))}<span className="text-sm font-normal text-slate-500"> / day</span></p>
            <div className="mt-6 border-t border-slate-100 pt-5"><p className="text-xs text-slate-500">Vehicle host</p><p className="mt-1 font-semibold text-slate-900">{listing.hostProfile.displayName}</p><p className="mt-2 flex items-center gap-1 text-sm text-slate-600"><MapPin size={14}/>{[listing.hostProfile.city,listing.hostProfile.province].filter(Boolean).join(", ")}</p></div>
            <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"><b>Bookings are not open yet.</b><p className="mt-1">This listing is part of the ROAM discovery preview. Rental requests and payments will become available only after launch readiness is complete.</p></div>
            {inquiriesEnabled ? <MarketplaceInquiryForm listingId={listing.id}/> : <Link href="/early-access" className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">Get renter launch updates</Link>}
          </aside>
        </div>
      </div>
    </section>
  </MarketplacePublicShell>;
}
