/** Parse V67 deadlines (DD/MM/YYYY [HH:MM]) as Kenya local time (UTC+3),
 * while accepting ISO timestamps used by the online assessment form. */
export function parseAssessmentDeadline(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const legacy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (legacy) {
    const [, day, month, year, hour = "00", minute = "00"] = legacy;
    const d = Number(day), m = Number(month), y = Number(year), h = Number(hour), min = Number(minute);
    if (h > 23 || min > 59) return null;
    const local = new Date(Date.UTC(y, m - 1, d));
    if (local.getUTCFullYear() !== y || local.getUTCMonth() !== m - 1 || local.getUTCDate() !== d) return null;
    return Date.UTC(y, m - 1, d, h - 3, min);
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function teacherScoreEntryLocked(assessment: { analyzed: boolean; deadline?: string | null }, now = Date.now()): boolean {
  const deadline = parseAssessmentDeadline(assessment.deadline);
  return Boolean(assessment.analyzed && deadline !== null && now > deadline);
}

export function formatAssessmentDeadline(value: string | null | undefined): string {
  if (!value) return "No deadline";
  const timestamp = parseAssessmentDeadline(value);
  if (timestamp === null) return value;
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi",
  }).format(new Date(timestamp));
}

/** Convert a stored deadline to the wall-clock value expected by datetime-local. */
export function deadlineToInput(value: string | null | undefined): string {
  const timestamp = parseAssessmentDeadline(value);
  if (timestamp === null) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Convert a datetime-local field (treated as Kenya wall time) to an ISO UTC timestamp. */
export function kenyaLocalInputToIso(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, ys, ms, ds, hs, mins] = match;
  const y = Number(ys), m = Number(ms), d = Number(ds), h = Number(hs), min = Number(mins);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d || h > 23 || min > 59) return null;
  return new Date(Date.UTC(y, m - 1, d, h - 3, min)).toISOString();
}
