"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { WorkspaceNav } from "@/components/workspace-nav";

type Branch = { id: string; name: string; code: string | null; address: string | null; isActive: boolean; createdAt: string };
const emptyForm = { name: "", code: "", address: "" };

export default function BranchesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/branches?includeInactive=1", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load branches.");
      setBranches(data.branches || []);
      setCanManage(Boolean(data.canManage));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load branches.");
    } finally {
      se¶»§q«^