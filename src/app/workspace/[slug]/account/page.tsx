"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Building2, CalendarDays, Check,
  ChevronRight, CircleHelp, Clock3, CreditCard, LockKeyhole, Mail,
  ReceiptText, ShieldCheck, Sparkles, UserRound,
} from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

type AccountData = {
  user: { id: string; name: string | null; email: string };
  tenant: {
    name: string; email: string; phone: string | null; status: string; createdAt: string; referralCode: string;
    referralsSent: { id: string; referredBusiness: string; status: string; registeredAt: string; expiresAt: string; qualifiedAt: string | null; rewardedAt: string | null }[];
    referralReceived: null | { status: string; registeredAt: string; expiresAt: string; qualifiedAt: string | null; rewardedAt: string | null; referrerBusiness: string };
  };
  subscription: null | { tier: string; status: string; currentPeriodStart: string | null; currentPeriodEnd: string | null; trialEndsAt: string | null; referralCreditMonths: number; plan: { name: string; monthlyPrice: number; maxVehicles: number | null; maxBranches: number | null; maxStaff: number | null } };
  plans: { tier: string; name: string; monthlyPrice: number; maxVehicles: number | null; maxBranches: number | null; maxStaff: number | null }[];
  billingRecords: { id: string; description: string; refe¶»§q«^