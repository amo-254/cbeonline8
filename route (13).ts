import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const denied = () => NextResponse.json({ error: "Administrator access required." }, { status: 403 });
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const assessments = await prisma.assessment.findMany({ where: { deleted: false }, orderBy: [{ year: "desc" }, { id: "desc" }] });
  return NextResponse.json({ assessments });
}
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.role !== "Administrator") return denied();
  try {
    const b = await req.json();
    const grade = String(b.grade ?? "").trim(), term = String(b.term ?? "").trim();
    const assessmentType = String(b.assessmentType ?? "").trim(), year = Number(b.year);
    if (!grade || !term || !assessmentType || !Number.isInteger(year) || year < 2000 || year > 2200)
      return NextResponse.json({ error: "Enter grade, term, assessment type and a valid year." }, { status: 400 });
    const deadline = b.deadline ? new Date(b.deadline) : null;
    if (deadline && Number.isNaN(deadline.getTime())) return NextResponse.json({ error: "Invalid deadline." }, { status: 400 });
    const assessment = await prisma.assessment.create({ data: { grade, term, year, assessmentType, deadline: deadline?.toISOString() ?? null, createdAt: new Date().toISOString() } });
    return NextResponse.json({ assessment }, { status: 201 });
  } catch { return NextResponse.json({ error: "This assessment already exists or its details are invalid." }, { status: 400 }); }
}
export async function PATCH(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.role !== "Administrator") return denied();
  try {
    const b = await req.json(), id = Number(b.id);
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Invalid assessment." }, { status: 400 });
    const current = await prisma.assessment.findUnique({ where: { id } });
    if (!current || current.deleted) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
    if (b.action === "analyze") {
      const result = await prisma.assessment.update({ where: { id }, data: { analyzed: true, analyzedAt: new Date().toISOString(), analysisCount: { increment: 1 } } });
      return NextResponse.json({ assessment: result, message: "Assessment marked as analysed. Teacher editing will be locked once its deadline has also passed." });
    }
    const data: Record<string, unknown> = {};
    if (typeof b.assessmentType === "string" && b.assessmentType.trim()) data.assessmentType = b.assessmentType.trim();
    if (b.deadline !== undefined) {
      const d = b.deadline ? new Date(b.deadline) : null;
      if (d && Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid deadline." }, { status: 400 });
      data.deadline = d?.toISOString() ?? null;
    }
    if (!Object.keys(data).length) return NextResponse.json({ error: "No editable assessment fields supplied." }, { status: 400 });
    const assessment = await prisma.assessment.update({ where: { id }, data });
    return NextResponse.json({ assessment });
  } catch { return NextResponse.json({ error: "Unable to update assessment. Check for a duplicate assessment type." }, { status: 400 }); }
}
export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.role !== "Administrator") return denied();
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Invalid assessment." }, { status: 400 });
  try {
    const assessment = await prisma.assessment.update({ where: { id }, data: { deleted: true, deletedAt: new Date().toISOString() } });
    return NextResponse.json({ assessment, message: "Assessment archived. Existing scores have been retained." });
  } catch { return NextResponse.json({ error: "Unable to archive assessment." }, { status: 400 }); }
}
