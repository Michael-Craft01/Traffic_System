/**
 * lib/storage.ts
 * Robust, coordinate-first storage for user routes and history.
 */

export interface RoutePoint {
  name: string;
  lat: number;
  lng: number;
}

export interface RouteDetails {
  origin: RoutePoint;
  destination: RoutePoint;
}

export interface SavedRoute extends RouteDetails {
  id: string;
  label: string;
  scheduledTime?: string; // HH:mm
}

export interface RecentRoute extends RouteDetails {
  id: string;
  timestamp: number;
}

const STORAGE_KEYS = {
  SAVED_ROUTES: "traffic_saved_routes",
  RECENT_ROUTES: "traffic_recent_routes",
  NOTIF_LAST_SENT: "traffic_notif_last_sent", // Map of routeId -> timestamp
};

// --- Saved Routes ---

export function getSavedRoutes(): SavedRoute[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEYS.SAVED_ROUTES);
  return raw ? JSON.parse(raw) : [];
}

export function saveRoute(route: SavedRoute) {
  const current = getSavedRoutes();
  const updated = [route, ...current.filter((r) => r.id !== route.id)];
  localStorage.setItem(STORAGE_KEYS.SAVED_ROUTES, JSON.stringify(updated));
}

export function deleteSavedRoute(id: string) {
  const current = getSavedRoutes();
  const updated = current.filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEYS.SAVED_ROUTES, JSON.stringify(updated));
}

// --- Recent Routes ---

export function getRecentRoutes(): RecentRoute[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEYS.RECENT_ROUTES);
  return raw ? JSON.parse(raw) : [];
}

export function addRecentRoute(details: RouteDetails) {
  const current = getRecentRoutes();
  
  // Check if this route (same origin/dest name) already exists in recent to avoid clutter
  const isDuplicate = current.some(
    (r) => 
      r.origin.name === details.origin.name && 
      r.destination.name === details.destination.name
  );

  if (isDuplicate) return;

  const newRecent: RecentRoute = {
    ...details,
    id: `recent_${Date.now()}`,
    timestamp: Date.now(),
  };

  // Keep top 12 recent entries
  const updated = [newRecent, ...current.slice(0, 11)];
  localStorage.setItem(STORAGE_KEYS.RECENT_ROUTES, JSON.stringify(updated));
}

export function deleteRecentRoute(id: string) {
  const current = getRecentRoutes();
  const updated = current.filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEYS.RECENT_ROUTES, JSON.stringify(updated));
}

export function clearAllHistory() {
  localStorage.removeItem(STORAGE_KEYS.RECENT_ROUTES);
  localStorage.removeItem(STORAGE_KEYS.NOTIF_LAST_SENT);
}

// --- Notification Tracking ---

export function setLastNotified(routeId: string) {
  const raw = localStorage.getItem(STORAGE_KEYS.NOTIF_LAST_SENT);
  const data = raw ? JSON.parse(raw) : {};
  data[routeId] = Date.now();
  localStorage.setItem(STORAGE_KEYS.NOTIF_LAST_SENT, JSON.stringify(data));
}

export function getLastNotified(routeId: string): number {
  const raw = localStorage.getItem(STORAGE_KEYS.NOTIF_LAST_SENT);
  if (!raw) return 0;
  const data = JSON.parse(raw);
  return data[routeId] || 0;
}
