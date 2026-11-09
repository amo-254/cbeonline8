"use client";
import { useEffect, useState } from "react";
type Settings = { school_name:string; school_motto:string; school_address:string; school_phone:string; school_email:string; school_logo:string; assessment_mode:string };
const blank:Settings={school_name:"",school_motto:"",school_address:"",school_phone:"",school_email:"",school_logo:"",assessment_mode:"Mid-Term"};
export default function SettingsModule(){
 const [data,setData]=useState<Settings>(blank),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{fetch("/api/settings").then(r=>r.json()).then(d=>{if(d.settings)setData({...blank,...d.settings});}).catch(()=>setMessage("Could not load school settings."));},[]);
 function set<K extends keyof Settings>(key:K,value:Settings[K]){setData(old=>({...old,[key]:value}));}
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage("");try{const r=await fetch("/api/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const d=await r.json();if(!r.ok)throw new Error(d.error||"Save failed");setMessage("School settings saved. Refresh the page to update the school name in the header.");}catch(e){setMessage(e instanceof Error?e.message:"Save failed.");}finally{setBusy(false);}}
 function logo(e:React.ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith("image/")){setMessage("Choose an image file.");return;}if(file.size>1_500_000){setMessage("Choose a logo smaller than 1.5 MB.");return;}const reader=new FileReader();reader.onload=()=>set("school_logo",String(reader.result||""));reader.readAsDataURL(file);}
 return <div className="panel"><div className="panelhead"><h2>School profile and report settings</h2><span className="muted">Administrator only</span></div>
 <form onSubmit={save} className="formgrid">
  <div className="field"><label>Official school name *</label><input required value={data.school_name} onChange={e=>set("school_name",e.target.value)}/></div>
  <div className="field"><label>School motto</label><input value={data.school_motto} onChange={e=>set("school_motto",e.target.value)}/></div>
  <div className="field"><label>Postal / physical address</label><input value={data.school_address} onChange={e=>set("school_address",e.target.value)}/></div>
  <div className="field"><label>School phone</label><input value={data.school_phone} onChange={e=>set("school_phone",e.target.value)}/></div>
  <div className="field"><label>School email</label><input type="email" value={data.school_email} onChange={e=>set("school_email",e.target.value)}/></div>
  <div className="field"><label>Assessment mode</label><select value={data.assessment_mode||"Mid-Term"} onChange={e=>set("assessment_mode",e.target.value)}><option>Mid-Term</option><option>Closing</option></select></div>
  <div className="field"><label>School logo (PNG/JPG, max 1.5 MB)</label><input type="file" accept="image/png,image/jpeg,image/webp" onChange={logo}/></div>
  <div style={{display:"flex",alignItems:"center",gap:12}}>{data.school_logo?<><img src={data.school_logo} alt="School logo preview" style={{width:76,height:76,objectFit:"contain",border:"1px solid #dbe3ed",borderRadius:8,padding:4}}/><button type="button" className="btn secondary" onClick={()=>set("school_logo","")}>Remove logo</button></>:<span className="muted">No logo uploaded.</span>}</div>
  <div style={{gridColumn:"1 / -1",display:"flex",gap:10,alignItems:"center"}}><button className="btn" disabled={busy}>{busy?"Saving…":"Save school settings"}</button><span className="muted" style={{fontSize:12}}>These details are used on printable reports.</span></div>
 </form>{message&&<p className="notice" role="status">{message}</p>}</div>;
}
