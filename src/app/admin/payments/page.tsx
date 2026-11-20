"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Check, RefreshCw, Save, ShieldCheck, X } from "lucide-react";

type Method = { clearQr?: boolean; id: string; key: string; label: string; accountName: string | null; instructions: string | null; qrImageData: string | null; qrContentType: string | null; enabled: boolean; sortOrder: number };
type Submission = { id: string; tenantId: string; tenantName: string; tenantSlug: string; tenantEmail: string; methodLabel: string; accountName: string | null; reference: string; amount: number; paidAt: string; receiptData: string | null; receiptContentType: string | null; status: string; provisionalUntil: string; rejectionReason: string | null; createdAt: string; reviewedAt: string | null };

const initialMethods = [
  { key: "GCASH", label: "GCash" },
  { key: "MAYA", label: "Maya" },
  { key: "BANK", label: "Bank transfer / QR" },
];

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read this image."));
    reader.readAsDataURL(file);
  });
}

export default function AdminPaymentsPage() {
  const [methods, setMethods] = useState<Method[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(¶»§q«^