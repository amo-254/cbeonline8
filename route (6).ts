import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { cbeLevel, cbePoints } from "@/lib/grading";
import { publicSchoolSettings } from "@/lib/school-settings";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "Administrator") {
    return NextResponse.json({ error: "Only administrators can generate complete all-learner reports." }, { status: 403 });
  }

  const params = new URL(req.url).searchParams;
  const assessmentId = Number(params.get("assessmentId") || 0);
  const gradeFilter = params.get("grade") || "All";
  const streamFilter = params.get("stream") || "All";
  if (!Number.isInteger(assessmentId) || assessmentId < 1) {
    return NextResponse.json({ error: "Select an assessment." }, { status: 400 });
  }

  const assessment = await prisma.assessment.findFirst({ where: { id: assessmentId, deleted: false } });
  if (!assessment) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });

  const [scoreRows, settings] = await Promise.all([
    prisma.score.findMany({
      where: { assessmentId },
      include: { learner: { select: { id: true, admissionNo: true, assessmentNo: true, name: true, className: true, stream: true, gender: true } } },
      orderBy: [{ learner: { name: "asc" } }, { learningArea: "asc" }],
      take: 30000,
    }),
    prisma.setting.findMany({
      where: { key: { in: ["school_name", "school_logo", "school_motto", "school_address", "school_phone", "school_email"] } },
    }),
  ]);

  type LearnerRow = typeof scoreRows[number]["learner"];
  type ReportRow = {
    learner: LearnerRow;
    grade: string;
    stream: string;
    areas: Array<{ learningArea: string; score: number; maxScore: number; percentage: number; points: number; level: string }>;
    totalMarks: number;
    recordedMax: number;
    totalPoints: number;
    percentage: number;
    level: string;
    gradePosition: number;
    gradeTotal: number;
    streamPosition: number;
    streamTotal: number;
    classTeacher: string;
  };

  const grouped = new Map<number, typeof scoreRows>();
  for (const row of scoreRows) {
    const list = grouped.get(row.learnerId) ?? [];
    list.push(row);
    grouped.set(row.learnerId, list);
  }

  const provisional = [...grouped.entries()].map(([learnerId, rows]) => {
    const first = rows[0];
    const grade = first.gradeAtAssessment ?? first.learner.className ?? "";
    const stream = first.streamAtAssessment ?? first.learner.stream ?? "";
    const areas = rows.map(row => {
      const percentage = row.maxScore > 0 ? row.score * 100 / row.maxScore : 0;
      return { learningArea: row.learningArea, score: row.score, maxScore: row.maxScore, percentage, points: cbePoints(percentage), level: cbeLevel(percentage).level };
    }).sort((a, b) => a.learningArea.localeCompare(b.learningArea));
    const totalMarks = rows.reduce((sum, row) => sum + row.score, 0);
    const recordedMax = rows.reduce((sum, row) => sum + row.maxScore, 0);
    // Match V67: the full report denominator is nine learning areas × 100 marks.
    const percentage = totalMarks / 900 * 100;
    const totalPoints = areas.reduce((sum, area) => sum + area.points, 0);
    return { learnerId, learner: first.learner, grade, stream, areas, totalMarks, recordedMax, totalPoints, percentage, level: cbeLevel(percentage).level };
  });

  const gradeRanks = new Map<string, Array<{ learnerId: number; totalMarks: number }>>();
  const streamRanks = new Map<string, Array<{ learnerId: number; totalMarks: number }>>();
  for (const row of provisional) {
    const g = gradeRanks.get(row.grade) ?? [];
    g.push({ learnerId: row.learnerId, totalMarks: row.totalMarks });
    gradeRanks.set(row.grade, g);
    const key = `${row.grade}::${row.stream}`;
    const s = streamRanks.get(key) ?? [];
    s.push({ learnerId: row.learnerId, totalMarks: row.totalMarks });
    streamRanks.set(key, s);
  }
  const rank = (items: Array<{ learnerId: number; totalMarks: number }>) => items.sort((a, b) => b.totalMarks - a.totalMarks || a.learnerId - b.learnerId);
  for (const list of gradeRanks.values()) rank(list);
  for (const list of streamRanks.values()) rank(list);

  const teacherAssignments = await prisma.classTeacherAssignment.findMany({ include: { teacher: { select: { name: true } } } });
  const reports: ReportRow[] = provisional.filter(row =>
    (gradeFilter === "All" || row.grade === gradeFilter) &&
    (streamFilter === "All" || row.stream === streamFilter)
  ).map(row => {
    const gradeList = gradeRanks.get(row.grade) ?? [];
    const streamList = streamRanks.get(`${row.grade}::${row.stream}`) ?? [];
    const classTeacher = teacherAssignments.find(x => x.className === row.grade && x.stream === row.stream)?.teacher.name ?? "";
    return {
      learner: row.learner, grade: row.grade, stream: row.stream, areas: row.areas,
      totalMarks: row.totalMarks, recordedMax: row.recordedMax, totalPoints: row.totalPoints,
      percentage: row.percentage, level: row.level,
      gradePosition: gradeList.findIndex(x => x.learnerId === row.learnerId) + 1,
      gradeTotal: gradeList.length,
      streamPosition: streamList.findIndex(x => x.learnerId === row.learnerId) + 1,
      streamTotal: streamList.length,
      classTeacher,
    };
  }).sort((a, b) => {
    const gradeNumber = (value: string) => Number(String(value).match(/\d+/)?.[0] || 999);
    return a.gradePosition - b.gradePosition || gradeNumber(a.grade) - gradeNumber(b.grade) || a.grade.localeCompare(b.grade) || a.learner.name.localeCompare(b.learner.name);
  });

  return NextResponse.json({ assessment, school: publicSchoolSettings(settings), reports });
}
