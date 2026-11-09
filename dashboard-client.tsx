"use client";
import {useState} from "react";
import LearnersModule from "./learners-module";
import TeachersModule from "./teachers-module";
import AssessmentsModule from "./assessments-module";
import ReportsModule from "./reports-module";
import TranscriptsModule from "./transcripts-module";
import SettingsModule from "./settings-module";
import GraduatingClassesModule from "./graduating-classes-module";
type User={id:number;username:string;role:"Administrator"|"Teacher"};
export default function DashboardClient({user,stats,schoolName}:{user:User;stats:{learners:number;teachers:number;assessments:number;scores:number};schoolName:string}){
 const [section,setSection]=useState("Overview");
 const links=user.role==="Administrator"?["Overview","Manage Learners","Teacher Accounts","Assessments","Score Entry","Reports","Learner Transcripts","School Settings","Graduating Classes"]:["Overview","Score Entry","My Assignments","Reports","Learner Transcripts"];
 async function logout(){await fetch("/api/auth/logout",{method:"POST"});location.href="/login";}
 return <div className="shell"><aside className="sidebar"><div className="brand">CBE PMS<small>PERFORMANCE MANAGEMENT</small></div>
 <nav className="nav">{links.map(x=><a key={x} href="#" className={section===x?"active":""} onClick={e=>{e.preventDefault();setSection(x)}}>{x}</a>)}</nav>
 <div style={{marginTop:"auto",fontSize:12,color:"#9eb3d0"}}>{user.username}<br/>{user.role}</div></aside>
 <main className="main"><header className="topbar"><div><b>{schoolName}</b><div className="muted" style={{fontSize:12}}>School performance workspace</div></div><button className="btn secondary" onClick={logout}>Sign out</button></header>
 <div className="content"><div className="eyebrow">{user.role.toUpperCase()} WORKSPACE</div><h1>{section==="Overview"?"Dashboard":section}</h1><p className="muted">Welcome, {user.username}. Manage school assessment information from one shared workspace.</p>
 {section==="Overview"?<><div className="grid">{(user.role==="Administrator"?[["Active learners",stats.learners],["Teachers",stats.teachers],["Assessments",stats.assessments],["Recorded scores",stats.scores]]:[["Assessments",stats.assessments],["Your role","Teacher"]]).map(([label,value])=><div className="card" key={String(label)}><div className="statlabel">{label}</div><div className="stat">{value}</div></div>)}</div>
 <div className="panel"><div className="panelhead"><h2>System workspace</h2><span className="eyebrow">ONLINE</span></div><p className="muted">The online foundation is configured for shared learner, teacher, assessment and score records. Additional V67 workflows and report generation are being ported in stages and must be verified against the original desktop application before production use.</p></div></>
 :section==="Manage Learners"&&user.role==="Administrator"?<LearnersModule/>:section==="Teacher Accounts"&&user.role==="Administrator"?<TeachersModule/>:section==="Assessments"||section==="Score Entry"?<AssessmentsModule role={user.role}/>:section==="Reports"?<ReportsModule role={user.role}/>:section==="Learner Transcripts"?<TranscriptsModule/>:section==="School Settings"&&user.role==="Administrator"?<SettingsModule/>:section==="Graduating Classes"&&user.role==="Administrator"?<GraduatingClassesModule/>:<div className="panel"><h2>{section}</h2><p className="muted">This module is part of the conversion plan. Its full V67 workflow will be enabled after the database migration and feature-by-feature validation.</p><p className="notice">Do not use this module for live school records until the conversion is completed and tested.</p></div>}
 </div></main></div>
}
