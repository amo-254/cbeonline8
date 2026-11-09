"use client";
import {useState} from "react";
export default function LoginForm(){
 const [username,setUsername]=useState("");const [password,setPassword]=useState("");
 const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");
  const r=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});
  const d=await r.json();if(r.ok)location.href="/dashboard";else setError(d.error||"Unable to sign in.");setBusy(false);
 }
 return <form onSubmit={submit} style={{display:"grid",gap:15,marginTop:25}}>
  <div className="field"><label>USERNAME</label><input required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter username"/></div>
  <div className="field"><label>PASSWORD</label><input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password"/></div>
  {error&&<div className="notice">{error}</div>}<button className="btn" disabled={busy}>{busy?"Signing in…":"SIGN IN"}</button>
 </form>
}
