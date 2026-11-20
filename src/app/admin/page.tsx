"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Building2, CarFront, ClipboardList, Download, RefreshCw, ShieldCheck, Users, Wallet, TrendingUp, Layers3 } from "lucide-react";

type Tenant = {
  id: string; name: string; slug: string; email: string; phone: string | null; owner: { name: string | null; email: string } | null;
  status: string; createdAt: string;
  counts: { memberships: number; vehicles: number; branches: number; bookings: number };
  subscription: { tier: string; status: string; plan: string; currentPeriodEnd?: string | null } | null;
};
type StatusFilter = "ALL" | "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";

const statusStyle: Record<string, string> = {
  ACTIVE: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  TRIAL: "bg-sky-400/10 text-sky-300 ring-sky-400/20",
  SUSPENDED: "bg-amber-400/10 text-amber-200 ring-amber-400/20",
  CANCELLED: "bg-rose-400/10 text-rose-200 ring-rose-400/20",
};

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  const text = /^[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
  return '"' + text.replace(/"/g, '""') + '"';
}

export default function AdminPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState(¶»§q«^