import { cbeLevel, cbePoints, LEARNING_AREAS } from './grading';

export type RawScore = {
  learnerId: number;
  admissionNo: string;
  learnerName: string;
  grade: string | null;
  stream: string | null;
  learningArea: string;
  score: number | null;
  maxScore: number | null;
};

export type MeritRow = {
  learnerId: number;
  admissionNo: string;
  learnerName: string;
  grade: string;
  stream: string;
  scores: Array<number | null>;
  maxScores: Array<number | null>;
  totalMarks: number;
  totalMaximum: number;
  totalPoints: number;
  percentage: number;
  level: string;
  rank: number;
};

/** Mirrors V67 merit_rows: missing learning-area records stay blank, not zero. */
export function buildMeritRows(raw: RawScore[], ranking: 'marks' | 'points' = 'marks'): MeritRow[] {
  const byLearner = new Map<number, Omit<MeritRow, 'totalMarks' | 'totalMaximum' | 'totalPoints' | 'percentage' | 'level' | 'rank'>>();
  const areaIndex = new Map<string, number>(LEARNING_AREAS.map((area, index) => [area, index]));

  for (const item of raw) {
    let row = byLearner.get(item.learnerId);
    if (!row) {
      row = {
        learnerId: item.learnerId,
        admissionNo: item.admissionNo,
        learnerName: item.learnerName,
        grade: item.grade ?? '',
        stream: item.stream ?? '',
        scores: Array(LEARNING_AREAS.length).fill(null),
        maxScores: Array(LEARNING_AREAS.length).fill(null),
      };
      byLearner.set(item.learnerId, row);
    }
    const index = areaIndex.get(item.learningArea);
    if (index !== undefined && item.score !== null) {
      row.scores[index] = Number(item.score);
      row.maxScores[index] = Number(item.maxScore ?? 0);
    }
  }

  const rows: MeritRow[] = [];
  for (const row of byLearner.values()) {
    const present = row.scores.map((score, index) => ({ score, max: row.maxScores[index] }))
      .filter((x): x is { score: number; max: number | null } => x.score !== null);
    // V67 excludes learners without any actual learning-area score.
    if (!present.length) continue;
    const totalMarks = present.reduce((sum, x) => sum + x.score, 0);
    const totalMaximum = present.reduce((sum, x) => sum + (x.max ?? 0), 0);
    const totalPoints = present.reduce((sum, x) => sum + cbePoints(x.max ? x.score * 100 / x.max : 0), 0);
    const percentage = totalMaximum ? totalMarks * 100 / totalMaximum : 0;
    rows.push({ ...row, totalMarks, totalMaximum, totalPoints, percentage, level: cbeLevel(percentage).level, rank: 0 });
  }

  rows.sort((a, b) => ranking === 'marks'
    ? b.totalMarks - a.totalMarks || a.learnerName.localeCompare(b.learnerName)
    : b.totalPoints - a.totalPoints || a.learnerName.localeCompare(b.learnerName));

  // Competition ranking: tied results share a position, next rank skips accordingly.
  let previous: number | undefined;
  let currentRank = 0;
  rows.forEach((row, index) => {
    const value = ranking === 'marks' ? row.totalMarks : row.totalPoints;
    if (previous === undefined || value !== previous) currentRank = index + 1;
    row.rank = currentRank;
    previous = value;
  });
  return rows;
}
