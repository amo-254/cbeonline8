import { prisma } from "@/lib/prisma";

export async function runAcademicYearTransition(currentYear = new Date().getFullYear()) {
  return prisma.$transaction(async tx => {
    const setting = await tx.setting.findUnique({ where: { key: "last_grade_transition_year" } });
    if (!setting) {
      await tx.setting.create({ data: { key: "last_grade_transition_year", value: String(currentYear) } });
      return { initialized: true, transitions: [], message: `Initialized academic year ${currentYear}. No learners were moved on first initialization.` };
    }
    if (!setting.value || !/^\d{4}$/.test(setting.value)) {
      throw new Error("The saved last-transition year is invalid. Correct the setting before running transitions.");
    }
    const lastYear = Number(setting.value);
    if (lastYear >= currentYear) {
      return { initialized: false, transitions: [], message: `No transition is due. The database is already recorded through ${lastYear}.` };
    }

    const transitions: Array<{ academicYear: number; graduated: number; advancedTo9: number; advancedTo8: number }> = [];
    for (let academicYear = lastYear + 1; academicYear <= currentYear; academicYear++) {
      const learners = await tx.learner.findMany({
        where: { status: "Active", className: { in: ["7", "8", "9"] } },
        select: { id: true, className: true, stream: true },
      });
      // Snapshot existing unsnapshotted scores before changing the current grade.
      for (const learner of learners) {
        await tx.score.updateMany({
          where: { learnerId: learner.id, OR: [{ gradeAtAssessment: null }, { gradeAtAssessment: "" }] },
          data: { gradeAtAssessment: learner.className },
        });
        await tx.score.updateMany({
          where: { learnerId: learner.id, OR: [{ streamAtAssessment: null }, { streamAtAssessment: "" }] },
          data: { streamAtAssessment: learner.stream ?? "" },
        });
      }
      const graduatingLabel = `Graduating Class of ${academicYear - 1}`;
      const cohort = await tx.graduatingClass.upsert({
        where: { label: graduatingLabel },
        create: { label: graduatingLabel, graduationYear: academicYear - 1, createdAt: new Date().toISOString() },
        update: {},
      });
      const grade9 = learners.filter(x => x.className === "9");
      if (grade9.length) {
        await tx.graduatingClassMember.createMany({
          data: grade9.map(x => ({ graduatingClassId: cohort.id, learnerId: x.id, originalGrade: "9", originalStream: x.stream ?? "" })),
          skipDuplicates: true,
        });
        await tx.learner.updateMany({
          where: { id: { in: grade9.map(x => x.id) }, status: "Active" },
          data: { status: "Graduated", graduatingClass: graduatingLabel, graduationYear: academicYear - 1 },
        });
      }
      const grade8 = learners.filter(x => x.className === "8").map(x => x.id);
      const grade7 = learners.filter(x => x.className === "7").map(x => x.id);
      if (grade8.length) await tx.learner.updateMany({ where: { id: { in: grade8 }, status: "Active" }, data: { className: "9" } });
      if (grade7.length) await tx.learner.updateMany({ where: { id: { in: grade7 }, status: "Active" }, data: { className: "8" } });
      await tx.setting.update({ where: { key: "last_grade_transition_year" }, data: { value: String(academicYear) } });
      transitions.push({ academicYear, graduated: grade9.length, advancedTo9: grade8.length, advancedTo8: grade7.length });
    }
    return { initialized: false, transitions, message: `Academic-year transition completed through ${currentYear}.` };
  }, { maxWait: 10000, timeout: 120000 });
}
