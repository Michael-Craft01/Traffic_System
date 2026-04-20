import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ route_id: string }> }
) {
  const { route_id } = await params;

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/routing/forecast/${route_id}`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) }
    );

    if (!res.ok) {
      return NextResponse.json({
        route_id,
        forecast_30_mins: [],
        backend_online: false,
        error: `Backend returned HTTP ${res.status}`,
      });
    }

    const json = await res.json();

    if (json.error || !Array.isArray(json.forecast_30_mins)) {
      return NextResponse.json({
        route_id,
        forecast_30_mins: [],
        backend_online: false,
        error: json.error ?? "ML model not loaded or no data available",
      });
    }

    return NextResponse.json({
      route_id:         json.route_id ?? route_id,
      forecast_30_mins: json.forecast_30_mins,
      backend_online:   true,
      error:            null,
    });
  } catch (error: any) {
    const isTimeout = error.name === "TimeoutError" || error.name === "AbortError";
    return NextResponse.json({
      route_id,
      forecast_30_mins: [],
      backend_online:   false,
      error: isTimeout ? "Backend timed out" : `Cannot reach backend: ${error.message}`,
    });
  }
}
