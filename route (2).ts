import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const denied = () => NextResponse.json({ error: "Administrator access required." }, { status: 403 });
const clean = (v: unknown) => String(v ?? "").trim();
const validAssignments = (value: unknown) => Array.isArray(value) ? value.filter((x) =>
  x && clean(x.learningArea) && clean(x.className) && clean(x.stream)
).map((x) => ({ learningArea: clean(x.learningArea), className: clean(x.className), stream: clean(x.stream) })) : [];
const validClasses = (value: unknown) => Array.isArray(value) ? value.filter((x) =>
  x && clean(x.className) && clean(x.stream)
).map((x) => ({ className: clean(x.className), stream: clean(x.stream) })) : [];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "Administrator") return denied();
  const teachers = await prisma.teacher.findMany({
    include: { assignments: { orderBy: [{ className: "asc" }, { stream: "asc" }, { learningArea: "asc" }] },
      classAssignments: { orderBy: [{ className: "asc" }, { stream: "asc" }] },
      user: { select: { id: true, username: true, role: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ teachers });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "Administrator") return denied();
  try {
    const body = await req.json();
    if (body.action === "reset-password") {
      const teacherId = Number(body.id);
      if (!Number.isInteger(teacherId) || teacherId < 1) return NextResponse.json({ error: "Invalid teacher." }, { status: 400 });
      const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, include: { user: true } });
      if (!teacher?.user) return NextResponse.json({ error: "This teacher has no linked login account." }, { status: 404 });
      const temporaryPassword = String(randomInt(100000, 1000000));
      const passwordHash = await bcrypt.hash(temporaryPassword, 12);
      await prisma.user.update({ where: { id: teacher.user.id }, data: { passwordHash } });
      return NextResponse.json({ temporaryPassword, message: "Password reset. Copy the temporary password and share it securely." });
    }
    const name = clean(body.name);
    if (!name) return NextResponse.json({ error: "Teacher name is required." }, { status: 400 });
    const school = await prisma.setting.findUnique({ where: { key: "school_name" } });
    const schoolPart = clean(school?.value).split(/\s+/)[0] || "school";
    const firstName = name.split(/\s+/)[0];
    const base = `${firstName}${schoolPart}`.toLowerCase().replace(/[^a-z0-9]/g, "");
    let username = base || `teacher${Date.now()}`;
    for (let n = 2; await prisma.user.findUnique({ where: { username } }); n++) username = `${base}${n}`;
    const temporaryPassword = String(randomInt(100000, 1000000));
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const assignments = validAssignments(body.assignments);
    const classAssignments = validClasses(body.classAssignments);
    const role = body.role === "Administrator" ? "Administrator" : "Teacher";
    const teacher = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { username, passwordHash, role } });
      return tx.teacher.create({ data: { name, teacherNo: clean(body.teacherNo) || null, username: user.username,
        assignments: { create: assignments }, classAssignments: { create: classAssignments } },
        include: { assignments: true, classAssignments: true, user: { select: { username: true, role: true } } } });
    });
    return NextResponse.json({ teacher, temporaryPassword }, { status: 201 });
  } catch (error) {
    console.error("Teacher creation failed", error);
    return NextResponse.json({ error: "Could not create teacher. Check that the details are valid." }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "Administrator") return denied();
  try {
    const body = await req.json();
    const id = Number(body.id);
    if (!Number.isInteger(id) || id < 1 || !clean(body.name)) return NextResponse.json({ error: "Valid teacher ID and name are required." }, { status: 400 });
    const assignments = validAssignments(body.assignments);
    const classAssignments = validClasses(body.classAssignments);
    const role = body.role === "Administrator" ? "Administrator" : "Teacher";
    const teacher = await prisma.$transaction(async (tx) => {
      const current = await tx.teacher.findUnique({ where: { id }, include: { user: true } });
      if (!current) throw new Error("Teacher not found.");
      if (current.user) await tx.user.update({ where: { id: current.user.id }, data: { role } });
      await tx.teacherAssignment.deleteMany({ where: { teacherId: id } });
      await tx.classTeacherAssignment.deleteMany({ where: { teacherId: id } });
      return tx.teacher.update({ where: { id }, data: { name: clean(body.name), teacherNo: clean(body.teacherNo) || null,
        assignments: { create: assignments }, classAssignments: { create: classAssignments } },
        include: { assignments: true, classAssignments: true, user: { select: { username: true, role: true } } } });
    });
    return NextResponse.json({ teacher });
  } catch (error) {
    console.error("Teacher update failed", error);
    return NextResponse.json({ error: "Could not update teacher or assignments." }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "Administrator") return denied();
  try {
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Invalid teacher." }, { status: 400 });
    await prisma.$transaction(async (tx) => {
      const teacher = await tx.teacher.findUnique({ where: { id }, include: { user: true } });
      if (!teacher) throw new Error("Teacher not found.");
      await tx.teacher.delete({ where: { id } });
      if (teacher.user) await tx.user.delete({ where: { id: teacher.user.id } });
    });
    return NextResponse.json({ message: "Teacher and login account deleted." });
  } catch {
    return NextResponse.json({ error: "Could not delete teacher." }, { status: 400 });
  }
}
