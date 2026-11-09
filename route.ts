import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { cbeLevel, cbePoints } from "@/lib/grading";
import { publicSchoolSettings } from "@/lib/school-settings";

function allowedForTeacher(grade: string | null, stream: string | null, area: string, assignments: Array<{className:string;stream:string;learningArea:string}>) {
  return assignments.some(a => a.className === (grade || "") && a.stream === (stream || "") && a.learningArea === area);
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const learnerId = Number(params.get("learnerId") || 0);
  const search = (params.get("search") || "").trim();
  const teacher = session.role === "Teacher"
    ? await prisma.teacher.findUnique({ where: { username: session.username }, include: { assignments: true } })
    : null;
  if (session.role === "Teacher" && !teacher) return NextResponse.json({ error: "Teacher account is not linked." }, { status: 403 });

  if (!learnerId) {
    const assignmentVisibility = session.role === "Teacher" ? teacher!.assignments.flatMap(a => [
      { className: a.className, stream: a.stream },
      { scores: { some: { learningArea: a.learningArea, gradeAtAssessment: a.className, streamAtAssessment: a.stream } } },
    ]) : [];
    const learnerFilters = [];
    if (search) learnerFilters.push({ OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { admissionNo: { contains: search, mode: "insensitive" as const } },
      { assessmentNo: { contains: search, mode: "insensitive" as const } },
    ] });
    if (session.role === "Teacher") learnerFilters.push({ OR: assignmentVisibility });
    const learners = await prisma.learner.findMany({
      where: learnerFilters.length ? { AND: learnerFilters } : {},
      orderBy: { name: "asc" }, take: 100,
      select: { id: true, admissionNo: true, assessmentNo: true, name: true, className: true, stream: true, status: true, graduatingClass: true },
    });
    return NextResponse.json({ learners });
  }

  const learner = await prisma.learner.findUnique({ where: { id: learnerId }, select: {
    id: true, admissionNo: true, assessmentNo: true, name: true, className: true, stream: true,
    status: true, graduatingClass: true, graduationYear: true,
  } });
  if (!learner) return NextResponse.json({ error: "Learner not found." }, { status: 404 });
  const scores = await prisma.score.findMany({
    where: { learnerId }, include: { assessment: true },
    orderBy: [{ year: "desc" }, { term: "desc" }, { learningArea: "asc" }], take: 5000,
  });
  const visibleScores = session.role === "Administrator" ? scores : scores.filter(s =>
    allowedForTeacher(s.gradeAtAssessment ?? learner.className, s.streamAtAssessment ?? learner.stream, s.learningArea, teacher!.assignments)
  );
  // Do not disclose learner identity or existence to a teacher who has no
  // current or historical assignment covering any of this learner's scores.
  if (session.role === "Teacher" && visibleScores.length === 0) {
    return NextResponse.json({ error: "You are not assigned to view this learner's assessment history." }, { status: 403 });
  }

  const groups = new Map<string, typeof visibleScores>();
  for (const s of visibleScores) {
    const key = s.assessmentId ? `assessment:${s.assessmentId}` : `legacy:${s.year ?? ""}:${s.term ?? ""}:${s.assessmentType ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  // Fetch peer scores for every assessment in one query rather than issuing
  // one database request per transcript period.
  const assessmentIds = [...new Set(visibleScores.map(s => s.assessmentId).filter((id): id is number => id !== null))];
  const peerRows = assessmentIds.length ? await prisma.score.findMany({
    where: { assessmentId: { in: assessmentIds } },
    select: {
      assessmentId: true, learnerId: true, score: true,
      learner: { select: { className: true, stream: true } },
      gradeAtAssessment: true, streamAtAssessment: true,
    },
  }) : [];
  const peersByAssessment = new Map<number, typeof peerRows>();
  for (const peer of peerRows) {
    if (peer.assessmentId === null) continue;
    const list = peersByAssessment.get(peer.assessmentId) ?? [];
    list.push(peer);
    peersByAssessment.set(peer.assessmentId, list);
  }

  const history = [];
  for (const [key, rows] of groups) {
    const first = rows[0];
    const grade = first.gradeAtAssessment ?? learner.className ?? "";
    const stream = first.streamAtAssessment ?? learner.stream ?? "";
    const totalMarks = rows.reduce((n, s) => n + s.score, 0);
    const recordedMax = rows.reduce((n, s) => n + s.maxScore, 0);
    // V67 learner reports use a fixed 9-learning-area / 900-mark denominator.
    const percentage = totalMarks / 900 * 100;
    const totalPoints = rows.reduce((n, s) => n + cbePoints(s.maxScore > 0 ? s.score * 100 / s.maxScore : 0), 0);
    let gradePosition: number | null = null, gradeTotal = 0, streamPosition: number | null = null, streamTotal = 0;
    if (first.assessmentId) {
      const peers = peersByAssessment.get(first.assessmentId) ?? [];
      const sums = new Map<number, { total:number; grade:string; stream:string }>();
      for (const p of peers) {
        const g = p.gradeAtAssessment ?? p.learner.className ?? "";
        const st = p.streamAtAssessment ?? p.learner.stream ?? "";
        const old = sums.get(p.learnerId) || { total:0, grade:g, stream:st };
        old.total += p.score; sums.set(p.learnerId, old);
      }
      const all = [...sums.entries()];
      const gradeRank = all.filter(([,v]) => v.grade === grade).sort((a,b) => b[1].total-a[1].total);
      const streamRank = all.filter(([,v]) => v.grade === grade && v.stream === stream).sort((a,b) => b[1].total-a[1].total);
      gradeTotal = gradeRank.length; streamTotal = streamRank.length;
      gradePosition = gradeRank.findIndex(([id]) => id === learnerId) + 1 || null;
      streamPosition = streamRank.findIndex(([id]) => id === learnerId) + 1 || null;
    }
    history.push({
      key, assessmentId: first.assessmentId, assessmentType: first.assessment?.assessmentType ?? first.assessmentType ?? "Assessment",
      term: first.assessment?.term ?? first.term ?? "", year: first.assessment?.year ?? first.year ?? null,
      grade, stream, totalMarks, recordedMax, percentage, totalPoints, level: cbeLevel(percentage).level,
      gradePosition, gradeTotal, streamPosition, streamTotal,
      areas: rows.map(s => ({ learningArea:s.learningArea, score:s.score, maxScore:s.maxScore,
        percentage:s.maxScore > 0 ? s.score*100/s.maxScore : 0,
        points:cbePoints(s.maxScore > 0 ? s.score*100/s.maxScore : 0), level:cbeLevel(s.maxScore > 0 ? s.score*100/s.maxScore : 0).level,
      })).sort((a,b) => a.learningArea.localeCompare(b.learningArea)),
    });
  }
  history.sort((a,b) => (b.year ?? 0)-(a.year ?? 0) || String(b.term).localeCompare(String(a.term)) || String(a.assessmentType).localeCompare(String(b.assessmentType)));
  const [school, classTeacher] = await Promise.all([
    prisma.setting.findMany({ where: { key: { in: ["school_name", "school_logo", "school_motto", "school_address", "school_phone", "school_email"] } } }),
    prisma.classTeacherAssignment.findFirst({ where: { className: history[0]?.grade || learner.className || "", stream: history[0]?.stream || learner.stream || "" }, include: { teacher: { select: { name: true } } } }),
  ]);
  return NextResponse.json({
    learner: {
      id: learner.id, admissionNo: learner.admissionNo, assessmentNo: learner.assessmentNo,
      name: learner.name, className: learner.className, stream: learner.stream,
      status: learner.status, graduatingClass: learner.graduatingClass, graduationYear: learner.graduationYear,
    },
    history, classTeacher: classTeacher?.teacher.name || null,
    school: publicSchoolSettings(school), partial: session.role === "Teacher",
  });
}
