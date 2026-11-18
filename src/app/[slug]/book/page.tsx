"use client";
import {useEffect,useState,FormEvent} from "react";
import {useParams} from "next/navigation";
import Link from "next/link";
type Vehicle={id:string;type:string;make:string;model:string;year:number|null;dailyRate:number;securityDeposit:number;branch:{name:string;address:string|null}|null};
export default function PublicBookPage(){
 const {slug}=useParams<{slug:string}>();const [business,setBusiness]=useState<{name:string;phone:string|null;timezone:string}|null>(null);const [vehicles,setVehicles]=useState<Vehicle[]>([]);
 const [vehicleId,setVehicleId]=useState("");const [name,setName]=useState("");const [email,setEmail]=useState("");const [phone,setPhone]=useState("");const [startAt,setStartAt]=useState("");const [endAt,setEndAt]=useState("");
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [booking,setBooking]=useState<{reference:string;accessToken:string}|null>(null);
 useEffect(()=>{fetch("/api/public/"+encodeURIComponent(slug)+"/bookings").then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setBusiness(d.business);setVehicles(d.vehicles||[]);}).catch(e=>setError(e.message||"Unable to load vehicles."));},[slug]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{const r=await fetch("/api/public/"+encodeURIComponent(slug)+"/bookings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,phone,vehicleId,startAt,endAt})});const d=await r.j¶»§q«^