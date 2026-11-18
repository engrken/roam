"use client";
import { useCallback, useEffect, useMemo, useState, FormEvent } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, Check, FileText, MessageCircle, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { WorkspaceNav } from "@/components/workspace-nav";
type Booking = { id:string; reference:string; status:string; startAt:string; endAt:string; totalAmount:number; createdAt:string; customer:{name:string;email:string|null;phone:string}; vehicles:string[]; documentsCount:number; messagesCount:number };
type Detail = { id:string; reference:string; status:string; startAt:string; endAt:string; totalAmount:number; customer:{name:string;email:string|null;phone:string}; vehicles:{make:string;model:string;plateNumber:string}[]; messages:{id:string;sender:string;body:string;createdAt:string}[]; documents:{id:string;kind:string;fileName:string;contentType:string;size:number;reviewStatus:string;createdAt:string}[] };
const money=(n:number)=>new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",maximumFractionDigits:0}).format(n);
const date=(s:string)=>new Date(s).toLocaleString("en-PH",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
export default function BookingsPage(){
 const {slug}=useParams<{slug:string}>();
 const [rows,setRows]=useState<Booking[]>([]);const [detail,setDetail]=useState<Detail|null>(null);const [loading,setLoading]=useState(true);cons¶»§q«^