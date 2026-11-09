import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (session.role !== "Administrator") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const cohorts = await prisma.graduatingClass.findMany({
    orderBy: { graduationYear: "desc" },
    include: { members: { orderBy: { learner: { admissionNo: "asc" } }, include: { learner: { select: { admissionNo: true, name: true } } } } },
  });
  return NextResponse.json({ cohorts });
}
