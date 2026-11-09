export type AssessmentPeriod = { term: string; year: number; assessmentType: string };

const TYPE_ORDER: Record<string, number> = {
  'Opener Assessment': 1,
  'Continuous Assessment': 2,
  'Mid-Term Assessment': 3,
  'End Term Assessment': 4,
  'End Year Assessment': 5,
};

const PREFERRED_PREVIOUS: Record<string, string[]> = {
  'Mid-Term Assessment': ['Opener Assessment'],
  'End Term Assessment': ['Mid-Term Assessment', 'Opener Assessment'],
  'End Year Assessment': ['Mid-Term Assessment', 'End Term Assessment', 'Opener Assessment'],
  'Continuous Assessment': ['Mid-Term Assessment', 'Opener Assessment'],
};

function termOrder(term: string): number {
  const match = String(term ?? '').trim().match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

/** Port of V67 _previous_assessment, including same-term End Year -> Mid-Term preference. */
export function findPreviousAssessment(
  current: AssessmentPeriod,
  candidates: AssessmentPeriod[],
): AssessmentPeriod | null {
  const currentType = current.assessmentType.trim();
  const samePeriod = candidates.filter(x => x.year === current.year && x.term === current.term && x.assessmentType !== currentType);
  for (const wanted of PREFERRED_PREVIOUS[currentType] ?? []) {
    const match = samePeriod.find(x => x.assessmentType.trim() === wanted);
    if (match) return match;
  }

  const currentTermNo = termOrder(current.term);
  const currentStage = TYPE_ORDER[currentType] ?? 99;
  const earlier = candidates.filter(x => {
    if (x.year < current.year) return true;
    if (x.year > current.year) return false;
    const candidateTermNo = termOrder(x.term);
    if (candidateTermNo < currentTermNo) return true;
    return candidateTermNo === currentTermNo
      && (TYPE_ORDER[x.assessmentType.trim()] ?? 0) < currentStage
      && x.assessmentType.trim() !== currentType;
  });
  earlier.sort((a, b) => b.year - a.year
    || termOrder(b.term) - termOrder(a.term)
    || (TYPE_ORDER[b.assessmentType.trim()] ?? 0) - (TYPE_ORDER[a.assessmentType.trim()] ?? 0));
  return earlier[0] ?? null;
}

export function percentage(score: number | null | undefined, maximum: number | null | undefined): number {
  const max = Number(maximum ?? 0);
  return max > 0 ? Number(score ?? 0) * 100 / max : 0;
}
