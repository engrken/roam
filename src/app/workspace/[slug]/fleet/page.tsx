"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Search, CarFront, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { WorkspaceNav } from "@/components/workspace-nav";

type Vehicle={id:string;type:string;make:string;model:string;year:number|null;plateNumber:string;color:string|null;dailyRate:number;securityDeposit:number;status:string;branchId:string|null;branchName:string};
type Branch={id:string;name:string;code:string|null};
const types=["MOTORCYCLE","SCOOTER","SEDAN","HATCHBACK","SUV","MPV","VAN","PICKUP","BUS","TRUCK","OTHER"];
const statuses=["AVAILABLE","RESERVED","RENTED","MAINTENANCE","INACTIVE"];
const money=(v:number)=>new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",maximumFractionDigits:0}).format(v);

export default function FleetPage(){
 const {slug}=useParams<{slug:string}>();
 const [vehicles,setVehicles]=useState<Vehicle[]>([]);const [branches,setBranches]=useState<Branch[]>([]);
 const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [search,setSearch]=useState("");const [filter,setFilter]=useState("ALL");const [showForm,setShowForm]=useState(false);const [busy,setBusy]=useState(false);const [editingId,setEditingId]=useState<string|null>(null);
 const [form,setForm]=useState({type:"MOTORCYCLE",make:"",model:"",year:"",plateNumber:"",color:"",dailyRate:"",securityDeposit:"",branchId:""});
 ¶»§q«^