export const LEARNING_AREAS = [
  "Mathematics", "English", "Kiswahili", "Integrated Science",
  "Pre-technical Studies", "Agriculture", "Social Studies", "C.R.E",
  "Creative Arts and Sports"
] as const;

export function cbeLevel(percent: number) {
  if (percent >= 90) return { level: "EE1", points: 8, band: "Exceeding Expectations" };
  if (percent >= 75) return { level: "EE2", points: 7, band: "Exceeding Expectations" };
  if (percent >= 58) return { level: "ME1", points: 6, band: "Meeting Expectations" };
  if (percent >= 41) return { level: "ME2", points: 5, band: "Meeting Expectations" };
  if (percent >= 31) return { level: "AE1", points: 4, band: "Approaching Expectations" };
  if (percent >= 21) return { level: "AE2", points: 3, band: "Approaching Expectations" };
  if (percent >= 11) return { level: "BE1", points: 2, band: "Below Expectations" };
  if (percent >= 1) return { level: "BE2", points: 1, band: "Below Expectations" };
  return { level: "BE2", points: 0, band: "Below Expectations" };
}

/** V67 points mapping for one learning area (0–8). */
export function cbePoints(percent: number): number {
  if (percent >= 90) return 8;
  if (percent >= 75) return 7;
  if (percent >= 58) return 6;
  if (percent >= 41) return 5;
  if (percent >= 31) return 4;
  if (percent >= 21) return 3;
  if (percent >= 11) return 2;
  if (percent >= 1) return 1;
  return 0;
}
