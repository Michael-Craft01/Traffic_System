import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

export async function GET() {
  try {
    console.log(`Fetching from backend: ${BACKEND_URL}/api/v1/mobile/state`);
    const res = await fetch(`${BACKEND_URL}/api/v1/mobile/state`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({
        vehicle_count: 0,
        congestion_status: "UNKNOWN",
        cameras: {},
        backend_online: false,
        error: `Backend returned HTTP ${res.status}`,
      });
    }

    const json = await res.json();

    // Extract all cameras from the response
    const rawCameras: Record<string, any> = json.data ?? {};
    const cameras: Record<string, any> = {};

    Object.entries(rawCameras).forEach(([id, cam]: [string, any]) => {
      cameras[id] = {
        camera_id:  id,
        total_flow: cam.total_flow ?? 0,
        status:     cam.status     ?? "UNKNOWN",
        latitude:   cam.latitude   ?? null,
        longitude:  cam.longitude  ?? null,
        server_time: cam.server_time ?? null,
      };
    });

    // Primary camera for the main status display
    const primary = cameras["cam_main_01"] ?? Object.values(cameras)[0] ?? null;

    return NextResponse.json({
      vehicle_count:     primary?.total_flow       ?? 0,
      congestion_status: primary?.status           ?? "UNKNOWN",
      cameras,
      live_nodes:        json.live_nodes ?? 0,
      backend_online:    true,
      error:             null,
    });
  } catch (error: any) {
    const isTimeout = error.name === "TimeoutError" || error.name === "AbortError";
    return NextResponse.json({
      vehicle_count:     0,
      congestion_status: "UNKNOWN",
      cameras:           {},
      backend_online:    false,
      error: isTimeout ? "Backend timed out" : `Cannot reach backend: ${error.message}`,
    });
  }
}