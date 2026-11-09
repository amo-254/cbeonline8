import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
const allowed = new Set(["school_name", "school_motto", "school_address", "school_phone", "school_email", "school_logo", "assessment_mode"]);
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.setting.findMany({ where: { key: { in: [...allowed, "school_period"] } } });
  const settings = Object.fromEntries(rows.map(x => [x.key, x.value || ""]));
  if (!settings.assessment_mode) settings.assessment_mode = settings.school_period || "Mid-Term";
  // A Windows file path from the desktop app cannot be used by the website; ask for a browser upload.
  if (settings.school_logo && !settings.school_logo.startsWith("data:image/")) settings.school_logo = "";
  return NextResponse.json({ settings });
}
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "Administrator") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  try {
    const body = await req.json(); const entries = Object.entries(body as Record<string, unknown>);
    if (!entries.length || entries.some(([key, value]) => !allowed.has(key) || typeof value !== "string")) return NextResponse.json({ error: "Invalid school settings." }, { status: 400 });
    for (const [key, raw] of entries) {
      const value = String(raw).trim();
      if (key === "school_logo" && value && (!/^data:image\/(png|jpeg|webp);base64,/i.test(value) || value.length > 2_000_000)) return NextResponse.json({ error: "Logo must be a PNG, JPG or WebP image smaller than approximately 1.5 MB." }, { status: 400 });
      if (key === "assessment_mode" && !["Mid-Term", "Closing"].includes(value)) return NextResponse.json({ error: "Assessment mode must be Mid-Term or Closing." }, { status: 400 });
      await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
      if (key === "assessment_mode") await prisma.setting.upsert({ where: { key: "school_period" }, create: { key: "school_period", value }, update: { value } });
    }
    return NextResponse.json({ message: "School settings saved." });
  } catch { return NextResponse.json({ error: "Could not save school settings." }, { status: 400 }); }
}
