"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, RefreshCw, Layers3 } from "lucide-react";

type Plan = { id: string; tier: string; name: string; monthlyPrice: number; maxVehicles: number | null; maxBranches: number | null; maxStaff: number | null; active: boolean };
type SubscriptionRequest = { id: string; tenantId: string; tenantName: string; tenantSlug: string; currentTier: string; requestedTier: string; status: string; createdAt: string };
type Tenant = { id: string; name: string; slug: string; subscription: { tier: string; status: string; currentPeriodEnd: string | null; trialEndsAt: string | null; monthlyPrice: number } | null };

export default function PlatformPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [subscriptionRequests, setSubscriptionRequests] = useState<SubscriptionRequest[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const [paymentReferences, setPaymentReferences] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/a¶»§q«^