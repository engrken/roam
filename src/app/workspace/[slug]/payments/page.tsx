"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, CreditCard, Upload } from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

type Method = { id: string; key: string; label: string; accountName: string | null; instructions: string | null; qrImageData: string | null; qrContentType: string | null };
type Submission = { id: string; methodLabel: string; reference: string; amount: number; paidAt: string; status: string; provisionalUntil: string; rejectionReason: string | null; createdAt: string };
type PageData = { methods: Method[]; submissions: Submission[]; subscription: { tier: string; status: string; planName: string; monthlyPrice: number; currentPeriodEnd: string | null } | null };

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read receipt image."));
    reader.readAsDataURL(file);
  });
}

export default function SubscriptionPaymentsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PageData | null>(null);
  const [methodId, setMethodId] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
 ¶»§q«^