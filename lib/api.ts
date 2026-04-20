/**
 * lib/api.ts
 * Typed, robust API client for the Traffic Brain backend.
 * All functions return { data, error, backendOnline } so callers
 * can always distinguish between "backend offline" and "data is zero".
 */

// ── Shared types ──────────────────────────────────────────────────
export type CongestionStatus = "CLEAR" | "MODERATE" | "CONGESTED" | "UNKNOWN";

export interface CameraData {
  camera_id: string;
  total_flow: number;
  status: CongestionStatus;
  latitude?: number;
  longitude?: number;
  server_time?: number;
}

export interface TrafficState {
  vehicle_count: number;
  congestion_status: CongestionStatus;
  cameras: Record<string, CameraData>;
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
  status: "CLEAR" | "ALERT" | "WARNING" | "error" | "unknown";
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

// ── Fetch helpers ─────────────────────────────────────────────────
const TIMEOUT_MS = 6000;

async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ── API functions ─────────────────────────────────────────────────

export async function fetchTrafficState(): Promise<TrafficState> {
  const empty: TrafficState = {
    vehicle_count: 0,
    congestion_status: "UNKNOWN",
    cameras: {},
    backend_online: false,
    error: null,
  };
  try {
    const res = await apiFetch("/api/traffic", { cache: "no-store" });
    if (!res.ok) {
      return { ...empty, error: `Server returned ${res.status}` };
    }
    const json = await res.json();
    // If the API itself reported backend offline
    if (json.backend_online === false) {
      return { ...empty, error: json.error ?? "Backend offline", backend_online: false };
    }
    return {
      vehicle_count:     json.vehicle_count     ?? 0,
      congestion_status: json.congestion_status ?? "UNKNOWN",
      cameras:           json.cameras           ?? {},
      backend_online:    json.backend_online    ?? true,
      error:             json.error             ?? null,
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
    const res = await apiFetch(`/api/forecast/${routeId}`, { cache: "no-store" });
    if (!res.ok) return { ...empty, error: `Server returned ${res.status}` };
    const json = await res.json();
    if (!json.forecast_30_mins || json.error) {
      return { ...empty, error: json.error ?? "No forecast data", backend_online: false };
    }
    return {
      route_id:        json.route_id        ?? routeId,
      forecast_30_mins: json.forecast_30_mins,
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
    const res = await apiFetch("/api/recommendation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: "web_user_01",
        route_id: routeId,
        departure_delay_mins: departureMins,
      }),
    });
    if (!res.ok) return { ...empty, error: `Server returned ${res.status}` };
    const json = await res.json();
    if (json.error) return { ...empty, error: json.error };
    return { ...json, backend_online: true, error: null };
  } catch (e: any) {
    return { ...empty, error: e.name === "AbortError" ? "Request timed out" : e.message };
  }
}

export async function fetchIncidents(): Promise<Incident[]> {
  try {
    const res = await apiFetch("/api/incidents", { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
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
