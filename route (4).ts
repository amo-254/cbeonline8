import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { teacherScoreEntryLocked } from "@/lib/assessment-deadline";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const assessmentId = Number(searchParams.get("assessmentId"));
  if (!Number.isInteger(assessmentId) || assessmentId < 1) return NextResponse.json({ error: "Select an assessment." }, { status: 400 });
  const learningArea = searchParams.get("learningArea") || undefined;
  const baseWhere = {
    ...(Number.isInteger(assessmentId) && assessmentId > 0 ? { assessmentId } : {}),
    ...(learningArea ? { learningArea } : {}),
  };
  let where: any = baseWhere;
  if (s.role === "Teacher") {
    const teacher = await prisma.teacher.findUnique({ where: { username: s.username }, include: { assignments: true } });
    if (!teacher) return NextResponse.json({ error: "Teacher account is not linked." }, { status: 403 });
    if (!teacher.assignments.length) return NextResponse.json({ scores: [] });
    // A teacher may only read scores for the exact learning-area, grade and
    // stream combinations assigned to their account.
    where = {
      ...baseWhere,
      OR: teacher.assignments.map((a) => ({
        learningArea: a.learningArea,
        // Use the grade/stream recorded when the score was entered. Learners
        // move grades each January, but teachers still need historical results
        // for the classes they are assigned to teach.
        gradeAtAssessment: a.className,
        streamAtAssessment: a.stream,
      })),
    };
  }
  const scores = await prisma.score.findMany({
    where,
    // Teachers need learner identity and class details for the score sheet,
    // not parent contact details or other administrative learner fields.
    include: { learner: { select: {
      id: true, admissionNo: true, name: true, className: true, stream: true,
      assessmentNo: true, gender: true, status: true,
    } } },
    orderBy: [{ learner: { name: "asc" } }], take: 5000,
  });
  return NextResponse.json({ scores });
}
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const b = await req.json();
    const assessmentId = Number(b.assessmentId), learnerId = Number(b.learnerId);
    if (!Number.isInteger(assessmentId) || assessmentId < 1) return NextResponse.json({ error: "Select a valid assessment." }, { status: 400 });
    const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment || assessment.deleted) return NextResponse.json({ error: "Select a valid assessment." }, { status: 400 });
    // Match V67: a teacher is locked only after BOTH the deadline has passed
    // and the assessment has been analysed. Either condition alone is insufficient.
    if (s.role !== "Administrator" && teacherScoreEntryLocked(assessment))
      return NextResponse.json({ error: "This assessment has passed its deadline and has been analysed. Only the Administrator can edit these scores." }, { status: 403 });
    const area = String(b.learningArea ?? "").trim(), scoreValue = Number(b.score), maxScore = Number(b.maxScore);
    if (!Number.isInteger(learnerId) || !area || !Number.isFinite(scoreValue) || !Number.isFinite(maxScore) || maxScore <= 0 || scoreValue < 0 || scoreValue > maxScore)
      return NextResponse.json({ error: "Enter a valid learner, learning area and score. Score cannot exceed maximum marks." }, { status: 400 });
    const learner = await prisma.learner.findUnique({ where: { id: learnerId } });
    if (!learner || learner.status !== "Active") return NextResponse.json({ error: "Active learner not found." }, { status: 404 });
    if (assessment.grade !== "All" && assessment.grade !== learner.className && !(assessment.grade === "Junior School" && ["7","8","9"].includes(learner.className || "")) && !(assessment.grade === "Primary School" && ["1","2","3","4","5","6"].includes(learner.className || ""))) return NextResponse.json({ error: "This learner is not in the grade selected for the assessment." }, { status: 400 });
    if (s.role === "Teacher") {
      const teacher = await prisma.teacher.findUnique({ where: { username: s.username }, include: { assignments: true } });
      if (!teacher || !teacher.assignments.some(a => a.learningArea === area && a.className === learner.className && a.stream === learner.stream))
        return NextResponse.json({ error: "You are not assigned to this learning area and class." }, { status: 403 });
    }
    const existing = await prisma.score.findUnique({ where: { learnerId_learningArea_assessmentId: { learnerId, learningArea: area, assessmentId } }, select: { id: true } });
    const values = { score: scoreValue, maxScore, term: assessment.term, year: assessment.year, assessmentType: assessment.assessmentType,
      assessmentId: assessment.id, gradeAtAssessment: learner.className, streamAtAssessment: learner.stream };
    const saved = await prisma.score.upsert({
      where: { learnerId_learningArea_assessmentId: { learnerId, learningArea: area, assessmentId } },
      update: values,
      create: { learnerId, learningArea: area, ...values },
    });
    return NextResponse.json({ score: saved, updated: Boolean(existing), message: existing ? "Existing score updated." : "Score saved." }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("Score save failed", error);
    return NextResponse.json({ error: "Unable to save score." }, { status: 400 });
  }
}
