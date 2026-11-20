"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("ROAM global application error", { message: error.message, digest: error.digest }); }, [error]);
  return <html lang="en"><body style={{margin:0,fontFamily:"system-ui,sans-serif",background:"#f8fafc",color:"#0f172a"}}>
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24}}>
      <section style={{maxWidth:520,width:"100%",padding:32,border:"1px solid #e2e8f0",borderRadius:18,background:"#fff"}}>
        <p style={{fontSize:12,fontWeight:700,letterSpacing:2,color:"#64748b"}}>ROAM · SYSTEM RECOVERY</p>
        <h1 style={{fontSize:28,margin:"12px 0"}}>ROAM could not load this page</h1>
        <p style={{lineHeight:1.6,color:"#475569"}}>An unexpected error interrupted the page. Please try again.</p>
        <button onClick={reset} style={{marginTop:20,padding:"11px 18px",border:0,borderRadius:9,background:"#0f172a",color:"#fff",fontWeight:700,cursor:"pointer"}}>Try again</button>
      </section>
    </main>
  </body></html>;
}
