import { redirect } from "next/navigation";
import DashboardClient from "../../dashboard-client";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const [learners, teachers, assessments, scores, school] = await Promise.all([
    prisma.learner.count({ where: { status: "Active" } }),
    prisma.teacher.count(),
    prisma.assessment.count({ where: { deleted: false } }),
    prisma.score.count(),
    prisma.setting.findUnique({ where: { key: "school_name" } }),
  ]);

  return (
    <DashboardClient
      user={user}
      stats={{ learners, teachers, assessments, scores }}
      schoolName={school?.value || "CBE Performance Management System"}
    />
  );
}
