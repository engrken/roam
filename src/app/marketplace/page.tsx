import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ArrowRight, CarFront, MapPin, Search, SlidersHorizontal, Store } from "lucide-react";
import MarketplacePublicShell from "@/components/marketplace-public-shell";
import { prisma } from "@/lib/prisma";
import { isMarketplaceListingPublic } from "@/lib/marketplace-host";

export const metadata: Metadata = {
  title: "Browse vehicles | ROAM Marketplace",
  description: "Discover available vehicles from participating ROAM Marketplace hosts.",
};
export const dynamic = "force-dynamic";

const categories = [
  ["MOTORCYCLE", "Motorcycles"], ["SCOOTER", "Scooters"], ["SEDAN", "Sedans"],
  ["HATCHBACK", "Hatchbacks"], ["SUV", "SUVs"], ["MPV", "MPVs"],
  ["VAN", "Vans"], ["PICKUP", "Pickups"], ["BUS", "Buses"], ["TRUCK", "Trucks"], ["OTHER", "Other"],
] as const;

type SearchParams = { q?: string; city?: string; category?: string };
const money = (value: number) => new Intl.NumberFormat("en-PH", {
  style: "currency", currency: "PHP", maximumFractionDigits: 0,
}).format(value);

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = (params.q || "").trim().slice(0, 80);
  const city = (params.city || "").trim().slice(0, 80);
  const category = categories.some(([value]) => value === params.category) ? params.category : "";
  const publicEnabled = process.env.ROAM_MARKETPLACE_PUBLIC_ENABLED === "true";

  const filters: Prisma.MarketplaceListingWhereInput[] = [
    { hostProfile: { is: { status: "PREQUALIFIED" } } },
    { vehicle: { is: { status: "AVAILABLE" } } },
    { tenant: { is: { status: { in: ["ACTIVE", "TRIAL"] } } } },
  ];
  if (category) filters.push({ vehicle: { is: { type: category as never } } });
  if (city) filters.push({ hostProfile: { is: { city: { contains: city, mode: "insensitive" } } } });
  if (q) filters.push({ OR: [
    { headline: { contains: q, mode: "insensitive" } },
    { description: { contains: q, mode: "insensitive" } },
    { vehicle: { is: { make: { contains: q, mode: "insensitive" } } } },
    { vehicle: { is: { model: { contains: q, mode: "insensitive" } } } },
    { hostProfile: { is: { city: { contains: q, mode: "insensitive" } } } },
    { hostProfile: { is: { province: { contains: q, mode: "insensitive" } } } },
  ] });

  const candidates = publicEnabled ? await prisma.marketplaceListing.findMany({
    where: { isPublished: true, status: "PREQUALIFIED", AND: filters },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true, headline: true, description: true, isPublished: true, status: true,
      hostProfile: { select: { status: true, displayName: true, city: true, province: true } },
      vehicle: { select: { status: true, type: true, make: true, model: true, year: true, dailyRate: true, seats: true, transmission: true } },
      tenant: { select: { status: true } },
    },
  }) : [];

  const listings = candidates.filter((listing) => isMarketplaceListingPublic({
    publicEnabled, isPublished: listing.isPublished, listingStatus: listing.status,
    hostStatus: listing.hostProfile.status, vehicleStatus: listing.vehicle.status,
    tenantStatus: listing.tenant.status,
  }));

  return <MarketplacePublicShell>
    <section className="bg-slate-950 px-5 py-14 text-white sm:px-8 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-bold tracking-[.22em] text-cyan-300">ROAM MARKETPLACE</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Find your next ride.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">Explore vehicles offered by participating local hosts. Listings appear only when ROAM enables public discovery and the listing remains eligible.</p>
        <form action="/marketplace" className="mt-8 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[1.4fr_1fr_1fr_auto]">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950 px-3 py-3"><Search size={16} className="text-slate-400"/><input name="q" defaultValue={q} placeholder="Search make, model or listing" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"/></label>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950 px-3 py-3"><MapPin size={16} className="text-slate-400"/><input name="city" defaultValue={city} placeholder="City" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"/></label>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950 px-3 py-3"><SlidersHorizontal size={16} className="text-slate-400"/><select name="category" defaultValue={category} className="w-full bg-slate-950 text-sm outline-none"><option value="">All vehicle types</option>{categories.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <button className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200">Search</button>
        </form>
      </div>
    </section>
    <section className="bg-slate-50 px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[.18em] text-cyan-700">AVAILABLE VEHICLES</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Marketplace listings</h2></div><p className="text-sm text-slate-500">{publicEnabled ? `${listings.length} vehicle(s) found` : "Public catalog is not enabled"}</p></div>
        {!publicEnabled ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-sm leading-7 text-amber-950"><b>Vehicle discovery is being prepared.</b><p className="mt-1">The public catalog is intentionally disabled while ROAM completes its launch-readiness work. Host drafts and preliminary approvals remain private.</p><Link href="/early-access" className="mt-4 inline-flex items-center gap-2 font-semibold text-amber-900 underline">Join renter early access <ArrowRight size={15}/></Link></div>
        : listings.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{listings.map((listing) => <article key={listing.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex h-36 items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 text-cyan-200"><CarFront size={54}/></div>
          <div className="p-5"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-cyan-700">{listing.vehicle.type.replaceAll("_"," ")}</span><span className="text-xs text-slate-500">{listing.vehicle.year || "Year not specified"}</span></div>
            <h3 className="mt-2 text-lg font-bold text-slate-950">{listing.headline}</h3><p className="mt-1 text-sm text-slate-600">{listing.vehicle.make} {listing.vehicle.model}</p>
            <p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><MapPin size={13}/>{[listing.hostProfile.city,listing.hostProfile.province].filter(Boolean).join(", ")}</p>
            <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-4"><div><p className="text-[10px] text-slate-500">Starting from</p><p className="text-lg font-bold text-slate-950">{money(Number(listing.vehicle.dailyRate))}<span className="text-xs font-normal text-slate-500"> / day</span></p></div><Link href={`/marketplace/${listing.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-cyan-800 hover:text-cyan-600">View details <ArrowRight size={14}/></Link></div>
            <p className="mt-3 flex items-center gap-1 text-[11px] text-slate-500"><Store size={12}/> Hosted by {listing.hostProfile.displayName}</p>
          </div>
        </article>)}</div>
        : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><CarFront size={32} className="mx-auto text-slate-400"/><h3 className="mt-3 font-semibold text-slate-900">No published vehicles match your search</h3><p className="mt-1 text-sm text-slate-500">Try another vehicle type or city, or check back as more hosts join.</p><Link href="/early-access" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800">Get launch updates <ArrowRight size={15}/></Link></div>}
      </div>
    </section>
  </MarketplacePublicShell>;
}
