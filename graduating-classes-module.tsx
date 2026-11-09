"use client";
import { useCallback, useEffect, useState } from "react";

type Preview = {
  currentYear: number; lastTransitionYear: number | null; firstRun: boolean;
  pendingYears: number[]; activeTotal: number; graduatingCount: number;
  grades: Record<string, number>; preview: string;
};
type Result = { ok?: boolean; initialized?: boolean; transitions?: Array<{academicYear:number;graduated:number;advancedTo9:number;advancedTo8:number}>; message?: string; error?: string };

export default function GraduatingClassesModule() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [cohorts, setCohorts] = useState<Array<{label:string;graduationYear:number;members:Array<{learner:{admissionNo:string;name:string};originalGrade:string|null;originalStream:string|null}>}>>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const [p, c] = await Promise.all([
      fetch("/api/academic-year-transition", { cache: "no-store" }),
      fetch("/api/graduating-classes", { cache: "no-store" }),
    ]);
    const pd = await p.json(); const cd = await c.json();
    if (!p.ok) throw new Error(pd.error || "Could not load transition preview.");
    if (!c.ok) throw new Error(cd.error || "Could not load graduating classes.");
    setPreview(pd); setCohorts(cd.cohorts || []);
  }, []);

  useEffect(() => { load().catch(e => setError(e.message)); }, [load]);

  async function runTransition() {
    if (!window.confirm("Run the academic-year transition now? Grade 9 learners will be archived and Grades 7–8 will advance. This operation is transactional and cannot be undone from this screen.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/academic-year-transition", { method: "POST" });
      const data: Result = await response.json();
      if (!response.ok) throw new Error(data.error || "Transition failed.");
      setMessage(data.message || "Transition completed.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Transition failed."); }
    finally { setBusy(false); }
  }

  return <div className="panel">
    <div className="panelhead"><div><h2>Academic-year transition</h2><p className="muted">Grade 7 → 8, Grade 8 → 9, and combine Grade 9 East/West into the previous year's graduating cohort.</p></div><button className="btn secondary" onClick={() => load().catch(e => setError(e.message))}>Refresh</button></div>
    {error && <p className="notice" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    {preview ? <>
      <div className="grid">
        <div className="card"><div className="statlabel">Current academic year</div><div className="stat">{preview.currentYear}</div></div>
        <div className="card"><div className="statlabel">Last recorded transition</div><div className="stat">{preview.lastTransitionYear ?? "Not initialized"}</div></div>
        <div className="card"><div className="statlabel">Active learners</div><div className="stat">{preview.activeTotal}</div></div>
        <div className="card"><div className="statlabel">Graduating members</div><div className="stat">{preview.graduatingCount}</div></div>
      </div>
      <div className="panel" style={{marginTop:16}}><h3>Transition preview</h3><p>{preview.preview}</p><div className="grid">{["7","8","9"].map(g=><div className="card" key={g}><div className="statlabel">Active Grade {g}</div><div className="stat">{preview.grades[g] || 0}</div></div>)}</div>
      <p className="muted" style={{marginTop:12}}>The first run only records the academic year. When catching up from a previous year, the system processes each missed year once, preserving historical score grade/stream snapshots and learner records.</p>
      <button className="btn" disabled={busy || (!preview.firstRun && preview.pendingYears.length===0)} onClick={runTransition}>{busy ? "Processing…" : preview.firstRun ? "Initialize academic year" : preview.pendingYears.length ? "Run pending transition(s)" : "No transition due"}</button>
    </div></> : <p className="muted">Loading transition information…</p>}
    <div style={{marginTop:24}}><h3>Graduating classes</h3>{cohorts.length===0 ? <p className="muted">No graduating cohorts have been recorded yet.</p> : cohorts.map(cohort=><div className="panel" key={cohort.label} style={{marginTop:12}}><div className="panelhead"><h3>{cohort.label}</h3><span className="eyebrow">{cohort.members.length} LEARNERS</span></div><div className="tablewrap"><table><thead><tr><th>S/NO.</th><th>ADM NO.</th><th>LEARNER NAME</th><th>PREVIOUS GRADE</th><th>PREVIOUS STREAM</th></tr></thead><tbody>{cohort.members.map((m,i)=><tr key={m.learner.admissionNo}><td>{i+1}</td><td>{m.learner.admissionNo}</td><td>{m.learner.name}</td><td>{m.originalGrade || "9"}</td><td>{m.originalStream || "—"}</td></tr>)}</tbody></table></div></div>)}</div>
  </div>;
}
