"use client";
import { useEffect, useMemo, useState } from "react";
import { performanceComments } from "@/lib/performance-comments";

type Assessment = { id: number; grade: string; term: string; year: number; assessmentType: string };
type Area = { learningArea: string; score: number; maxScore: number; percentage: number; points: number; level: string };
type Report = {
  learner: { id: number; admissionNo: string; assessmentNo: string | null; name: string; gender: string | null };
  grade: string; stream: string; areas: Area[]; totalMarks: number; recordedMax: number; totalPoints: number;
  percentage: number; level: string; gradePosition: number; gradeTotal: number; streamPosition: number; streamTotal: number; classTeacher: string;
};
type Payload = { assessment: Assessment; school: Record<string, string | null>; reports: Report[] };

export default function AllLearnerReportsModule() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentId, setAssessmentId] = useState("");
  const [grade, setGrade] = useState("All");
  const [stream, setStream] = useState("All");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/assessments").then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load assessments.");
      if (!active) return;
      const list: Assessment[] = data.assessments || [];
      setAssessments(list);
      if (list.length) setAssessmentId(String(list[0].id));
    }).catch(error => { if (active) setMessage(error instanceof Error ? error.message : "Unable to load assessments."); });
    return () => { active = false; };
  }, []);

  async function loadReports() {
    if (!assessmentId) return;
    setBusy(true); setMessage("");
    try {
      const query = new URLSearchParams({ assessmentId, grade, stream });
      const response = await fetch(`/api/reports/all?${query.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to generate learner reports.");
      setPayload(data);
    } catch (error) {
      setPayload(null); setMessage(error instanceof Error ? error.message : "Unable to generate reports.");
    } finally { setBusy(false); }
  }

  const grades = useMemo(() => ["All", ...Array.from(new Set(assessments.map(a => a.grade))).sort()], [assessments]);
  const streams = useMemo(() => ["All", ...Array.from(new Set((payload?.reports || []).map(r => r.stream).filter(Boolean))).sort()], [payload]);
  const school = payload?.school || {};

  return <div className="panel" style={{ marginTop: 18 }}>
    <div className="panelhead"><div><h2>All learner assessment reports</h2><p className="muted">One report per learner, ordered from Grade Position 1 to the last position.</p></div><button className="btn secondary no-print" onClick={() => window.print()} disabled={!payload?.reports.length}>Print / Save combined PDF</button></div>
    <div className="formgrid no-print">
      <div className="field"><label>Assessment</label><select value={assessmentId} onChange={e => setAssessmentId(e.target.value)}><option value="">Select assessment</option>{assessments.map(a => <option key={a.id} value={a.id}>#{a.id} · {a.assessmentType} · {a.grade} · {a.term} {a.year}</option>)}</select></div>
      <div className="field"><label>Grade</label><select value={grade} onChange={e => { setGrade(e.target.value); setStream("All"); }}>{grades.map(x => <option key={x}>{x}</option>)}</select></div>
      <div className="field"><label>Stream</label><select value={stream} onChange={e => setStream(e.target.value)}>{streams.map(x => <option key={x}>{x}</option>)}</select></div>
      <div className="field" style={{ alignContent: "end" }}><button className="btn" onClick={() => void loadReports()} disabled={busy || !assessmentId}>{busy ? "Generating…" : "Generate all reports"}</button></div>
    </div>
    {message && <p className="notice no-print">{message}</p>}
    {payload && !payload.reports.length && <p className="notice">No learners have recorded scores for this assessment and filter.</p>}
    {payload && payload.reports.length > 0 && <>
      <div className="no-print muted" style={{ margin: "14px 0" }}>Generated {payload.reports.length} learner reports. The combined document starts with position 1 and follows the exact displayed rank order.</div>
      <div className="all-reports-print">
        {payload.reports.map((report, index) => {
          const comments = performanceComments(report.percentage, report.learner.id);
          return <article className="one-learner-report" key={report.learner.id}>
            <header className="school-report-header">
              {school.school_logo && <img src={school.school_logo} alt="School logo" />}
              <h2>{(school.school_name || "SCHOOL NAME").toUpperCase()}</h2>
              {school.school_motto && <p className="school-motto">{school.school_motto}</p>}
              <p>{[school.school_address, school.school_phone, school.school_email].filter(Boolean).join(" · ")}</p>
              <div className="report-title">LEARNER ASSESSMENT REPORT</div>
              <strong>{payload.assessment.assessmentType} · Grade {report.grade} · {payload.assessment.term} {payload.assessment.year}</strong>
            </header>
            <h3 className="report-section-title">LEARNER DETAILS</h3>
            <div className="learner-report-details">
              <div><b>ADMISSION NO.</b><span>{report.learner.admissionNo}</span></div>
              <div><b>ASSESSMENT NO.</b><span>{report.learner.assessmentNo || "—"}</span></div>
              <div><b>LEARNER NAME</b><span>{report.learner.name}</span></div>
              <div><b>GENDER</b><span>{report.learner.gender || "—"}</span></div>
              <div><b>GRADE / STREAM</b><span>{report.grade} / {report.stream || "—"}</span></div>
              <div><b>GRADE POSITION</b><span>{report.gradePosition} / {report.gradeTotal}</span></div>
              <div><b>STREAM POSITION</b><span>{report.streamPosition} / {report.streamTotal}</span></div>
              <div><b>OVERALL LEVEL</b><span>{report.level}</span></div>
              <div><b>TOTAL MARKS</b><span>{Math.round(report.totalMarks)} / 900</span></div>
              <div><b>TOTAL POINTS</b><span>{report.totalPoints} / 72</span></div>
              <div><b>OVERALL %</b><span>{report.percentage.toFixed(1)}%</span></div>
            </div>
            <h3 className="report-section-title">LEARNING AREA PERFORMANCE</h3>
            <table className="data-table learner-report-table"><thead><tr><th>LEARNING AREA</th><th>SCORE</th><th>MAX</th><th>%</th><th>POINTS</th><th>LEVEL</th></tr></thead>
              <tbody>{report.areas.map(area => <tr key={area.learningArea}><td>{area.learningArea}</td><td>{Number(area.score.toFixed(1))}</td><td>{Number(area.maxScore.toFixed(1))}</td><td>{area.percentage.toFixed(1)}%</td><td>{area.points}</td><td>{area.level}</td></tr>)}
                <tr className="learner-report-total"><td>TOTAL</td><td>{Math.round(report.totalMarks)}</td><td>{Math.round(report.recordedMax)}</td><td>{report.percentage.toFixed(1)}%</td><td>{report.totalPoints}</td><td>{report.level}</td></tr>
              </tbody></table>
            <div className="learner-report-comments">
              <div><b>CLASS TEACHER COMMENT</b><p>{comments.classComment}</p><strong>CLASS TEACHER: {report.classTeacher || "________________________"}</strong></div>
              <div><b>HOI'S COMMENT</b><p>{comments.hoiComment}</p><strong>HEAD OF INSTITUTION: ____________________</strong></div>
            </div>
            <footer className="report-footer"><span>Generated from recorded assessment scores. Missing learning areas remain blank.</span><span>Page {index + 1} of {payload.reports.length}</span></footer>
          </article>;
        })}
      </div>
    </>}
    <style jsx global>{`@media print {
      @page { size: A4 portrait; margin: 10mm; }
      body { background: #fff !important; }
      .sidebar,.topbar,.no-print { display:none !important; }
      .shell,.main,.content { display:block !important; padding:0 !important; margin:0 !important; max-width:none !important; }
      .panel { border:0 !important; box-shadow:none !important; padding:0 !important; margin:0 !important; }
      .one-learner-report { break-after:page; page-break-after:always; break-inside:avoid; page-break-inside:avoid; }
      .one-learner-report:last-child { break-after:auto; page-break-after:auto; }
    }
    .one-learner-report { color:#172638; background:#fff; padding:16px 12px 12px; margin-top:18px; border:1px solid #d5dde6; break-inside:avoid; }
    .school-report-header { text-align:center; border-bottom:2px solid #24466e; padding-bottom:9px; }
    .school-report-header img { width:72px; height:72px; object-fit:contain; display:block; margin:0 auto 5px; }
    .school-report-header h2 { margin:0 0 3px; font-size:19px; }
    .school-report-header p { margin:2px 0; font-size:10px; }
    .school-report-header .school-motto { font-style:italic; }
    .report-title { background:#dceeff; border:1px solid #2f5597; padding:5px; margin:7px 0; font-weight:800; letter-spacing:.3px; }
    .school-report-header strong { font-size:11px; }
    .report-section-title { font-size:11px; margin:10px 0 5px; color:#24466e; }
    .learner-report-details { display:grid; grid-template-columns:1fr 1fr; border-top:1px solid #aab5c1; border-left:1px solid #aab5c1; }
    .learner-report-details div { display:flex; gap:7px; padding:4px 6px; border-right:1px solid #aab5c1; border-bottom:1px solid #aab5c1; font-size:9px; }
    .learner-report-details b { min-width:112px; color:#40546a; }
    .learner-report-table { width:100%; min-width:0; font-size:9px; border-collapse:collapse; }
    .learner-report-table th { background:#2f5597; color:white; }
    .learner-report-table th,.learner-report-table td { padding:5px 6px; border:1px solid #aab5c1; }
    .learner-report-table td:first-child { width:38%; }
    .learner-report-total { font-weight:800; background:#fff2cc; }
    .learner-report-comments { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:16px; font-size:9px; }
    .learner-report-comments > div { border:1px solid #aab5c1; padding:7px; min-height:68px; }
    .learner-report-comments p { min-height:26px; margin:7px 0; }
    .report-footer { display:flex; justify-content:space-between; gap:10px; margin-top:9px; font-size:8px; color:#526477; }
    @media print { .one-learner-report { margin:0; padding:0; border:0; } .learner-report-table th,.learner-report-table td { padding:4px; } }
    `}</style>
  </div>;
}
