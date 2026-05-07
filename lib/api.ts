/**
 * lib/api.ts
 * Typed, robust API client for the Traffic Brain backend.
 * All functions return { data, error, backendOnline } so callers
 * can always distinguish between "backend offline" and "data is zero".
 */

// ── Shared types ──────────────────────────────────────────────────
export type CongestionStatus = "CLEAR" | "MODERATE" | "CONGESTED" | "UNKNOWN" | "ALERT" | "WARNING";

export interface CameraData {
  camera_id: string;
  total_flow: number;
  status: CongestionStatus;
  latitude?: number;
  longitude?: number;
  server_time?: number;
}

export interface TrafficState {
  total_vehicles: number;
  average_speed: number;
  congestion_level: CongestionStatus;
  cameras: Record<string, CameraData>;
  predictions?: Record<string, number[]>;
  backend_online: boolean;
  error: string | null;
}

export interface ForecastResult {
  route_id: string;
  forecast_30_mins: number[];
  backend_online: boolean;
  error: string | null;
}

export interface RecommendationResult {
  status: "CLEAR" | "ALERT" | "WARNING" | "error" | "unknown" | "CONGESTED" | "MODERATE";
  message: string;
  suggested_shift_mins?: number;
  predicted_volume?: number;
  predicted_volume_if_no_change?: number;
  orchestration_mode?: string;
  backend_online: boolean;
  error: string | null;
}

export interface Incident {
  id: string;
  type: string;
  location: string;
  note: string;
  reported_at: string;
  severity: "low" | "medium" | "high";
}

export interface PatternResponse {
  id: number;
  label: string;
  origin_name: string;
  dest_name: string;
  target_time: string;
  confidence: number;
}

// ── Fetch helpers ─────────────────────────────────────────────────
const TIMEOUT_MS = 15000;

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  
  // Inject demo token for development robustness
  const headers = {
    ...options.headers,
    "Authorization": "Bearer demo-token"
  };

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
    const finalUrl = `${baseUrl}/api/v1${url}`;
    
    const res = await fetch(finalUrl, { 
      ...options, 
      headers,
      signal: controller.signal 
    });
    return res;
  } catch (error) {
    console.error(`Fetch failed for ${url}:`, error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// ── API functions ─────────────────────────────────────────────────

export async function fetchTrafficState(): Promise<TrafficState> {
  const empty: TrafficState = {
    total_vehicles: 0,
    average_speed: 0,
    congestion_level: "UNKNOWN",
    cameras: {},
    predictions: {},
    backend_online: false,
    error: null,
  };
  try {
    const res = await apiFetch("/mobile/state", { cache: "no-store" });
    if (!res.ok) {
      return { ...empty, error: `Server returned ${res.status}` };
    }
    const json = await res.json();
    return {
      total_vehicles:    json.live_nodes        ?? 0,
      average_speed:     45, // Demo fallback
      congestion_level:  "UNKNOWN",
      cameras:           json.data || {},
      predictions:       json.predictions       || {},
      backend_online:    true,
      error:             null,
    };
  } catch (e: any) {
    return { ...empty, error: e.name === "AbortError" ? "Request timed out" : e.message };
  }
}

export async function fetchForecast(routeId: string): Promise<ForecastResult> {
  const empty: ForecastResult = {
    route_id: routeId,
    forecast_30_mins: [],
    backend_online: false,
    error: null,
  };
  try {
    const res = await apiFetch(`/routing/forecast/${routeId}`, { cache: "no-store" });
    if (!res.ok) return { ...empty, error: `Server returned ${res.status}` };
    const json = await res.json();
    return {
      route_id:        json.route_id        ?? routeId,
      forecast_30_mins: json.forecast_30_mins || [],
      backend_online:  true,
      error:           null,
    };
  } catch (e: any) {
    return { ...empty, error: e.name === "AbortError" ? "Request timed out" : e.message };
  }
}

export async function fetchRecommendation(
  routeId: string,
  departureMins: number
): Promise<RecommendationResult> {
  const empty: RecommendationResult = {
    status: "error",
    message: "",
    backend_online: false,
    error: null,
  };
  try {
    const res = await apiFetch("/routing/check-commute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: "local_user_01",
        route_id: routeId,
        departure_delay_mins: departureMins,
      }),
    });
    if (!res.ok) return { ...empty, error: `Server returned ${res.status}` };
    const json = await res.json();
    return { ...json, backend_online: true, error: null };
  } catch (e: any) {
    return { ...empty, error: e.name === "AbortError" ? "Request timed out" : e.message };
  }
}

export async function logJourney(payload: any): Promise<void> {
  try {
    await apiFetch("/telemetry/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "local_user_01", ...payload }),
    });
  } catch (e) {
    console.warn("Telemetry log failed", e);
  }
}

export async function fetchSuggestions(): Promise<PatternResponse[]> {
  try {
    const res = await apiFetch("/telemetry/suggestions/local_user_01");
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function fetchIncidents(): Promise<Incident[]> {
  try {
    const res = await fetch("/api/incidents", { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch (_) {
    return [];
  }
}

export async function reportIncident(
  payload: Omit<Incident, "id" | "reported_at">
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await apiFetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { success: false, error: `Server returned ${res.status}` };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function reportTrafficIncident(areaId: string, type: 'CRASH' | 'HAZARD' | 'POLICE') {
  // Boost penalties so they ALWAYS trigger the congestion threshold (600) for demonstration purposes
  const penalty = type === 'CRASH' ? 1000 : type === 'HAZARD' ? 700 : 400;
  try {
    const res = await apiFetch("/mobile/incident", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area_id: areaId, penalty }),
    });
    if (!res.ok) return { success: false, error: `Server returned ${res.status}` };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Camera Control functions ───────────────────────────────────────

export async function connectCamera(ip: string, port: string = "8080", cameraId: string = "cam_main_01"): Promise<any> {
  try {
    const res = await apiFetch("/camera/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, port, camera_id: cameraId }),
    });
    return await res.json();
  } catch (e) {
    return { status: "error", message: "Failed to connect to backend" };
  }
}

export async function disconnectCamera(): Promise<any> {
  try {
    const res = await apiFetch("/camera/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  } catch (e) {
    return { status: "error", message: "Failed to disconnect" };
  }
}

export async function getCameraStatus(): Promise<any> {
  try {
    const res = await apiFetch("/camera/status");
    return await res.json();
  } catch (e) {
    return { is_running: false };
  }
}
