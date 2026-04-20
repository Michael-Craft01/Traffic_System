import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

/**
 * Proxies traffic history from the FastAPI backend's SQL store.
 * Falls back to synthesised data when the backend is offline so the
 * Analytics page always has something meaningful to display.
 */
export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/mobile/history`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (_) {
    // Backend offline — fall through to synthetic data
  }

  // Synthetic fallback: 24 hours of plausible traffic data
  const now   = Date.now();
  const hours = 24;
  const records = Array.from({ length: hours }, (_, i) => {
    const ts = new Date(now - (hours - i) * 3_600_000);
    const h  = ts.getHours();
    const isMorningPeak  = h >= 7  && h <= 9;
    const isEveningPeak  = h >= 16 && h <= 18;
    const isNight        = h < 5 || h > 22;

    const base = isNight ? 8 : isMorningPeak || isEveningPeak ? 55 : 28;
    const count = Math.round(base + (Math.random() - 0.5) * 14);

    return {
      timestamp: ts.toISOString(),
      sensor_id: "cam_main_01",
      vehicle_count: Math.max(0, count),
      congestion_status: count > 50 ? "CONGESTED" : count > 30 ? "MODERATE" : "CLEAR",
    };
  });

  return NextResponse.json({
    source:  "synthetic",
    records,
    message: "Backend offline — showing synthesised data",
  });
}
