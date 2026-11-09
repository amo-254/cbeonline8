/**
 * Values imported from the V67 desktop settings table are not necessarily web
 * assets. In particular, Windows paths such as C:\\... must never be emitted
 * as <img src> values by report APIs. The current settings UI stores uploaded
 * logos as image data URLs, so only those are safe to expose as logo content.
 */
export function publicSchoolSettings(rows: Array<{ key: string; value: string | null }>) {
  const settings = Object.fromEntries(rows.map(({ key, value }) => [key, value ?? ""])) as Record<string, string>;
  if (settings.school_logo && !/^data:image\/(png|jpeg|webp);base64,/i.test(settings.school_logo)) {
    settings.school_logo = "";
  }
  return settings;
}
