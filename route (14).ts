import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { runAcademicYearTransition } from "@/lib/academic-year";

export const runtime = "nodejs";

async function adminOnly(): Promise<{ session?: SessionUser; error?: NextResponse }> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  if (session.role !== "Administrator") return { error: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const auth = await adminOnly();
  if (auth.error) return auth.error;

  const currentYear = new Date().getFullYear();
  const [lastSetting, activeByGrade, graduatingCount, activeTotal] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "last_grade_transition_year" } }),
    prisma.learner.groupBy({ by: ["className"], where: { status: "Active" }, _count: { _all: true } }),
    prisma.graduatingClassMember.count(),
    prisma.learner.count({ where: { status: "Active" } }),
  ]);
  const lastYear = lastSetting?.value && /^\d{4}$/.test(lastSetting.value) ? Number(lastSetting.value) : null;
  const firstRun = lastYear === null;
  const pendingYears = firstRun || lastYear! >= currentYear ? [] : Array.from({ length: currentYear - lastYear! }, (_, i) => lastYear! + i + 1);

  return NextResponse.json({
    currentYear, lastTransitionYear: lastYear, firstRun, pendingYears,
    activeTotal, graduatingCount,
    grades: Object.fromEntries(activeByGrade.map(x => [x.className ?? "Unassigned", x._count._all])),
    preview: firstRun
      ? "First initialization only records the current academic year; it does not move learners."
      : pendingYears.length
        ? `The system will process ${pendingYears.length} academic-year transition(s). Grade 9 learners will be archived under the preceding year's graduating cohort; Grades 8 and 7 will advance one level per year.`
        : "No transition is due. The academic-year transition has already been recorded for this year.",
  });
}

export async function POST() {
  const auth = await adminOnly();
  if (auth.error) return auth.error;
  const currentYear = new Date().getFullYear();

  try {
    const result = await runAcademicYearTransition(currentYear);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Academic-year transition failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
