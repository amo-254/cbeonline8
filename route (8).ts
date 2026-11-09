import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const rawQuery = (searchParams.get("q") || "").trim();
  const searchBy = searchParams.get("searchBy") || "all";
  // Admission-number searches are numeric-only and never inspect assessmentNo.
  const q = searchBy === "admissionNo" ? rawQuery.replace(/\D/g, "") : rawQuery;
  const grade = searchParams.get("grade") || "";
  const status = searchParams.get("status") || "Active";
  if (!["all", "admissionNo", "assessmentNo", "name"].includes(searchBy)) {
    return NextResponse.json({ error: "Invalid learner search field." }, { status: 400 });
  }
  const accessWhere: Record<string, unknown> = {};
  if (session.role === "Teacher") {
    const teacher = await prisma.teacher.findUnique({
      where: { username: session.username },
      include: { assignments: true },
    });
    if (!teacher) return NextResponse.json({ error: "Teacher account is not linked." }, { status: 403 });
    if (!teacher.assignments.length) return NextResponse.json({ learners: [] });
    // A teacher's roster is restricted to the exact assigned grade/stream pairs.
    accessWhere.AND = [{ OR: teacher.assignments.map((a) => ({ className: a.className, stream: a.stream })) }];
  }
  const teacherRosterSelect = session.role === "Teacher" ? {
    id: true, admissionNo: true, name: true, className: true, stream: true,
    assessmentNo: true, gender: true, status: true,
  } : undefined;
  const learners = await prisma.learner.findMany({
    where: {
      ...accessWhere,
      ...(status === "All" ? {} : { status }),
      ...(grade && grade !== "All" && grade !== "-" ? { className: grade } : {}),
      ...(q ? { OR: searchBy === "admissionNo"
        ? [{ admissionNo: { contains: q } }]
        : searchBy === "assessmentNo"
          ? [{ assessmentNo: { contains: q } }]
          : searchBy === "name"
            ? [{ name: { contains: q, mode: "insensitive" } }]
            : [
                { name: { contains: q, mode: "insensitive" } },
                { admissionNo: { contains: q } },
                { assessmentNo: { contains: q } },
              ] } : {}),
    },
    select: teacherRosterSelect,
    orderBy: [{ className: "asc" }, { stream: "asc" }, { name: "asc" }],
    take: 1000,
  });
  return NextResponse.json({ learners });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "Administrator") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  try {
    const b = await req.json();
    if (!b.admissionNo?.toString().trim() || !b.name?.toString().trim() || !b.className || !b.stream)
      return NextResponse.json({ error: "Admission number, learner name, grade and stream are required." }, { status: 400 });
    const learner = await prisma.learner.create({ data: {
      admissionNo: String(b.admissionNo).trim(), name: String(b.name).trim(),
      className: String(b.className), stream: String(b.stream),
      assessmentNo: b.assessmentNo ? String(b.assessmentNo).trim() : null,
      gender: b.gender || null, parentPhone: b.parentPhone || null, status: "Active",
    } });
    return NextResponse.json({ learner }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not save learner. Check for a duplicate admission number." }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "Administrator") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  try {
    const b = await req.json();
    const id = Number(b.id);
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Invalid learner record." }, { status: 400 });
    const learner = await prisma.learner.update({ where: { id }, data: {
      admissionNo: String(b.admissionNo).trim(), name: String(b.name).trim(),
      className: b.className || null, stream: b.stream || null,
      assessmentNo: b.assessmentNo || null, gender: b.gender || null,
      parentPhone: b.parentPhone || null,
    } });
    return NextResponse.json({ learner });
  } catch {
    return NextResponse.json({ error: "Could not update learner. Check for duplicate admission numbers." }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "Administrator") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Invalid learner record." }, { status: 400 });
    // Retain historical scores and reports by default: archive rather than hard-delete.
    const learner = await prisma.learner.update({ where: { id }, data: { status: "Inactive" } });
    return NextResponse.json({ learner, message: "Learner archived. Historical scores have been retained." });
  } catch {
    return NextResponse.json({ error: "Could not archive learner." }, { status: 400 });
  }
}
