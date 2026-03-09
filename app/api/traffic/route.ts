import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/mobile/state`, { cache: 'no-store' });
    const json = await res.json();

    // Extract default camera 'cam_main_01' data or return fallback
    const liveData = json.data?.cam_main_01 || {};

    return NextResponse.json({
      vehicle_count: liveData.total_flow || 0,
      congestion_status: liveData.status || "UNKNOWN",
      predictions: json.predictions || []
    });

  } catch (error: any) {
    console.error("Fetch error:", error.message);
    return NextResponse.json({
      vehicle_count: 0,
      congestion_status: "OFFLINE",
      error: error.message
    }, { status: 500 });
  }
}