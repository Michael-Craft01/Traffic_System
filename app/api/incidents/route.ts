import { NextRequest, NextResponse } from "next/server";

/**
 * In-memory incident store.
 * Seeds two realistic demo incidents on startup.
 * In production this would persist to the FastAPI SQLite backend.
 */
type Severity = "low" | "medium" | "high";

interface _Incident {
  id: string;
  type: string;
  location: string;
  note: string;
  severity: Severity;
  reported_at: string;
}

let incidents: _Incident[] = [
  {
    id: "demo-1",
    type: "Accident",
    location: "Samora Machel Ave & 3rd St",
    note: "Minor collision, right lane partially blocked",
    severity: "medium",
    reported_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
  {
    id: "demo-2",
    type: "Road Closure",
    location: "Simon Mazorodze Rd southbound",
    note: "Utility works, expect 30-min delays",
    severity: "high",
    reported_at: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
  },
];

export const dynamic = "force-dynamic";

export async function GET() {
  const sorted = [...incidents].sort(
    (a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()
  );
  return NextResponse.json(sorted);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, location, note, severity } = body;

    if (!type || typeof type !== "string" || !location || typeof location !== "string") {
      return NextResponse.json(
        { error: "Required: type (string) and location (string)" },
        { status: 400 }
      );
    }

    const incident: _Incident = {
      id:          `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type:        type.trim(),
      location:    location.trim(),
      note:        typeof note === "string" ? note.trim() : "",
      severity:    (["low", "medium", "high"].includes(severity) ? severity : "medium") as Severity,
      reported_at: new Date().toISOString(),
    };

    incidents = [incident, ...incidents].slice(0, 100);

    // Best-effort forward to FastAPI backend
    try {
      const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
      await fetch(`${backendUrl}/api/v1/incidents/report`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(incident),
        signal:  AbortSignal.timeout(2000),
      });
    } catch (_) {
      /* Backend offline — stored locally */
    }

    return NextResponse.json({ success: true, incident }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
