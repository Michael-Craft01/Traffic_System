"use client";
import React, { useEffect, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import type { CameraData, CongestionStatus } from "@/lib/api";

// ─── Camera nodes ─────────────────────────────────────────────────
export const CAMERA_NODES: {
  id: string;
  lat: number;
  lon: number;
  label: string;
  area: string;
  defaultStatus: CongestionStatus;
}[] = [
  { id: "cam_main_01", lat: -17.8292, lon: 31.0522, label: "CBD North",    area: "Central Business District", defaultStatus: "UNKNOWN"   },
  { id: "cam_02",      lat: -17.7801, lon: 31.0178, label: "Borrowdale",   area: "Borrowdale Rd",             defaultStatus: "CLEAR"     },
  { id: "cam_03",      lat: -17.8100, lon: 31.0650, label: "Avondale",     area: "Avondale Shopping",         defaultStatus: "MODERATE"  },
  { id: "cam_04",      lat: -17.8600, lon: 31.0080, label: "Kuwadzana Jct",area: "Kuwadzana Junction",        defaultStatus: "CONGESTED" },
  { id: "cam_05",      lat: -17.7600, lon: 31.0800, label: "Greendale",    area: "Greendale Ave",             defaultStatus: "CLEAR"     },
];

// ─── Route segments between cameras ──────────────────────────────
const ROUTES: {
  id: string;
  name: string;
  fromCam: string;
  toCam: string;
  path: [number, number][];
}[] = [
  {
    id: "r-cbd-borrowdale",
    name: "CBD → Borrowdale Rd",
    fromCam: "cam_main_01",
    toCam: "cam_02",
    path: [
      [-17.8292, 31.0522],
      [-17.8100, 31.0400],
      [-17.7950, 31.0300],
      [-17.7801, 31.0178],
    ],
  },
  {
    id: "r-cbd-avondale",
    name: "CBD → Avondale",
    fromCam: "cam_main_01",
    toCam: "cam_03",
    path: [
      [-17.8292, 31.0522],
      [-17.8200, 31.0580],
      [-17.8100, 31.0650],
    ],
  },
  {
    id: "r-cbd-kuwadzana",
    name: "CBD → Kuwadzana",
    fromCam: "cam_main_01",
    toCam: "cam_04",
    path: [
      [-17.8292, 31.0522],
      [-17.8420, 31.0380],
      [-17.8550, 31.0200],
      [-17.8600, 31.0080],
    ],
  },
  {
    id: "r-borrowdale-greendale",
    name: "Borrowdale → Greendale",
    fromCam: "cam_02",
    toCam: "cam_05",
    path: [
      [-17.7801, 31.0178],
      [-17.7700, 31.0490],
      [-17.7600, 31.0800],
    ],
  },
];

// ─── Status helpers ───────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  CLEAR:     "#16a34a",  // green-600
  MODERATE:  "#d97706",  // amber-600
  CONGESTED: "#dc2626",  // red-600
  UNKNOWN:   "#94a3b8",  // slate-400
};

const STATUS_WEIGHT: Record<string, number> = {
  CLEAR: 4, MODERATE: 5, CONGESTED: 6, UNKNOWN: 3,
};

function getRouteStatus(
  fromId: string,
  toId: string,
  cameras: Record<string, CameraData>
): CongestionStatus {
  const statuses = [cameras[fromId]?.status, cameras[toId]?.status].filter(Boolean);
  if (statuses.includes("CONGESTED")) return "CONGESTED";
  if (statuses.includes("MODERATE"))  return "MODERATE";
  if (statuses.includes("CLEAR"))     return "CLEAR";
  return "UNKNOWN";
}

// ─── Props ────────────────────────────────────────────────────────
interface TrafficMapProps {
  sensorData: {
    vehicle_count: number;
    congestion_status: CongestionStatus;
    cameras: Record<string, CameraData>;
    backend_online: boolean;
  };
  incidents?: { id: string; type: string; location: string; severity: string }[];
}

// ─── Component ───────────────────────────────────────────────────
export default function TrafficMap({ sensorData, incidents = [] }: TrafficMapProps) {
  const [leaflet, setLeaflet]     = useState<any>(null);
  const [RL, setRL]               = useState<any>(null);
  const [userPos, setUserPos]     = useState<[number, number] | null>(null);
  const [locError, setLocError]   = useState<string | null>(null);
  const [mapRef, setMapRef]       = useState<any>(null);

  // Load Leaflet + react-leaflet client-side only
  useEffect(() => {
    Promise.all([import("leaflet"), import("react-leaflet")]).then(([L, rl]) => {
      setLeaflet(L);
      setRL(rl);
    });
  }, []);

  // Geolocation
  const startLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError("Geolocation not supported in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(latlng);
        setLocError(null);
        if (mapRef) mapRef.setView(latlng, 14, { animate: true });
      },
      (err) => setLocError(err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [mapRef]);

  useEffect(() => { startLocation(); }, [startLocation]);

  // ── Loading state ─────────────────────────────────────────────
  if (!leaflet || !RL) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 gap-3">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Loading map…</p>
      </div>
    );
  }

  const { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, ZoomControl, Circle } = RL;
  const L = leaflet;

  // Fix Leaflet default icon (Next.js asset issue)
  L.Icon.Default.mergeOptions({
    iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });

  // ── Camera marker icon ────────────────────────────────────────
  const makeCameraIcon = (status: string, isLive = false) => {
    const color = STATUS_COLOR[status] ?? STATUS_COLOR.UNKNOWN;
    const s = isLive ? 16 : 12;
    return new L.DivIcon({
      className: "",
      html: `
        <div style="position:relative;width:${s}px;height:${s}px;">
          ${isLive ? `
            <div style="position:absolute;inset:-6px;border-radius:50%;background:${color};opacity:0.15;animation:ping 2s ease-out infinite;"></div>
          ` : ""}
          <div style="
            width:${s}px;height:${s}px;border-radius:50%;
            background:${color};
            border:2.5px solid white;
            box-shadow:0 2px 8px rgba(0,0,0,0.18),0 0 0 1px ${color}44;
          "></div>
        </div>
        <style>@keyframes ping{0%{transform:scale(1);opacity:0.6}80%,100%{transform:scale(2.4);opacity:0}}</style>
      `,
      iconSize:   [s, s],
      iconAnchor: [s / 2, s / 2],
    });
  };

  // ── User location icon ────────────────────────────────────────
  const userIcon = new L.DivIcon({
    className: "",
    html: `
      <div style="position:relative;width:16px;height:16px;">
        <div class="user-pulse" style="
          position:absolute;inset:-8px;border-radius:50%;
          background:rgba(59,130,246,0.25);
        "></div>
        <div style="
          width:16px;height:16px;border-radius:50%;
          background:#3b82f6;
          border:3px solid white;
          box-shadow:0 2px 12px rgba(59,130,246,0.5);
        "></div>
      </div>
    `,
    iconSize:   [16, 16],
    iconAnchor: [8, 8],
  });

  // ── Incident marker icon ──────────────────────────────────────
  const makeIncidentIcon = (severity: string) => {
    const color = severity === "high" ? "#dc2626" : severity === "medium" ? "#d97706" : "#64748b";
    return new L.DivIcon({
      className: "",
      html: `
        <div style="
          width:28px;height:28px;border-radius:50%;
          background:white;
          border:2px solid ${color};
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.15);
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
      `,
      iconSize:   [28, 28],
      iconAnchor: [14, 14],
    });
  };

  // ── Effective camera statuses (live > default) ─────────────────
  const effectiveCameras: Record<string, CameraData> = {};
  CAMERA_NODES.forEach((cam) => {
    effectiveCameras[cam.id] = sensorData.cameras[cam.id] ?? {
      camera_id:  cam.id,
      total_flow: 0,
      status:     cam.defaultStatus,
    };
  });

  const center: [number, number] = [-17.8292, 31.0522];

  // ── Route midpoint for label ───────────────────────────────────
  const midpoint = (path: [number, number][]): [number, number] => {
    const mid = Math.floor(path.length / 2);
    return path[mid];
  };

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={true}
        zoomControl={false}
        style={{ width: "100%", height: "100%" }}
        ref={(m: any) => { if (m && !mapRef) setMapRef(m); }}
      >
        {/* Light "Voyager" tile — best for light-theme apps */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
        />

        <ZoomControl position="topright" />

        {/* ── Route polylines ──────────────────────────── */}
        {ROUTES.map((route) => {
          const status = getRouteStatus(route.fromCam, route.toCam, effectiveCameras);
          const color  = STATUS_COLOR[status];
          const weight = STATUS_WEIGHT[status];
          const label  = status === "CLEAR"
            ? "Clear"
            : status === "MODERATE"
              ? "Moderate"
              : status === "CONGESTED"
                ? "Congested"
                : "No data";

          return (
            <React.Fragment key={route.id}>
              {/* Drop shadow / halo for readability */}
              <Polyline
                positions={route.path}
                pathOptions={{ color: "white", weight: weight + 4, opacity: 0.55 }}
              />
              {/* Main coloured route line */}
              <Polyline
                positions={route.path}
                pathOptions={{ color, weight, opacity: 0.9 }}
              >
                <Tooltip
                  permanent
                  direction="center"
                  className="route-label"
                  position={midpoint(route.path)}
                >
                  {route.name} · {label}
                </Tooltip>
                <Popup>
                  <div className="p-3 min-w-[180px]">
                    <p className="font-bold text-slate-800 text-sm mb-1">{route.name}</p>
                    <p className="text-xs font-semibold" style={{ color }}>
                      {label} traffic
                    </p>
                    {sensorData.backend_online && (
                      <p className="text-xs text-slate-500 mt-1">
                        Updated live from backend
                      </p>
                    )}
                  </div>
                </Popup>
              </Polyline>
            </React.Fragment>
          );
        })}

        {/* ── Camera markers ───────────────────────────── */}
        {CAMERA_NODES.map((cam) => {
          const camData = effectiveCameras[cam.id];
          const isLive  = !!sensorData.cameras[cam.id] && sensorData.backend_online;
          const status  = camData?.status ?? "UNKNOWN";
          const color   = STATUS_COLOR[status];

          return (
            <React.Fragment key={cam.id}>
              {/* Congestion radius circle */}
              <Circle
                center={[cam.lat, cam.lon]}
                radius={400}
                pathOptions={{
                  fillColor: color,
                  color:     color,
                  weight:    1,
                  fillOpacity: 0.10,
                  opacity:     0.30,
                }}
              />
              <Marker
                position={[cam.lat, cam.lon]}
                icon={makeCameraIcon(status, isLive)}
              >
                <Popup>
                  <div className="p-3 min-w-[200px]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-slate-800 text-sm">{cam.label}</p>
                      {isLive && (
                        <span className="text-[9px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                          Live
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{cam.area}</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      <span className="text-xs font-semibold" style={{ color }}>
                        {status}
                      </span>
                    </div>
                    {camData?.total_flow > 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        {camData.total_flow} vehicles detected
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* ── User location ─────────────────────────────── */}
        {userPos && (
          <React.Fragment>
            <Circle
              center={userPos}
              radius={80}
              pathOptions={{ fillColor: "#3b82f6", color: "#3b82f6", weight: 1, fillOpacity: 0.12, opacity: 0.4 }}
            />
            <Marker position={userPos} icon={userIcon}>
              <Popup>
                <div className="p-3">
                  <p className="font-bold text-slate-800 text-sm">Your Location</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {userPos[0].toFixed(5)}, {userPos[1].toFixed(5)}
                  </p>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        )}

        {/* ── Incident markers ──────────────────────────── */}
        {incidents.map((inc, i) => {
          // Place incidents near the camera cluster with slight offsets
          const angle  = (i * 137.5 * Math.PI) / 180;
          const radius = 0.003 + (i % 3) * 0.002;
          const pos: [number, number] = [
            center[0] + Math.sin(angle) * radius,
            center[1] + Math.cos(angle) * radius,
          ];
          return (
            <Marker key={inc.id} position={pos} icon={makeIncidentIcon(inc.severity)}>
              <Popup>
                <div className="p-3 min-w-[180px]">
                  <p className="font-bold text-slate-800 text-sm mb-1">{inc.type}</p>
                  <p className="text-xs text-slate-500">{inc.location}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* ── Find Me button ─────────────────────────────── */}
      <button
        onClick={startLocation}
        title="Centre on my location"
        className="absolute bottom-20 right-3 z-[1000] w-10 h-10 bg-white rounded-xl shadow-md border border-slate-200 flex items-center justify-center text-blue-600 hover:bg-blue-50 active:scale-95 transition-all"
        aria-label="Find my location"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
        </svg>
      </button>

      {/* ── Map Legend ─────────────────────────────────── */}
      <div className="absolute bottom-20 left-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-2xl shadow-md border border-slate-100 px-4 py-3">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Traffic Level</p>
        {[
          { color: STATUS_COLOR.CLEAR,     label: "Clear"     },
          { color: STATUS_COLOR.MODERATE,  label: "Moderate"  },
          { color: STATUS_COLOR.CONGESTED, label: "Congested" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-2 mb-1.5 last:mb-0">
            <div className="w-5 h-1.5 rounded-full" style={{ background: l.color }} />
            <span className="text-[11px] font-medium text-slate-600">{l.label}</span>
          </div>
        ))}
        {locError && (
          <p className="text-[10px] text-amber-600 mt-2 max-w-[120px] leading-tight">
            Location: {locError}
          </p>
        )}
      </div>

      {/* ── Backend offline banner ─────────────────────── */}
      {!sensorData.backend_online && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 flex items-center gap-2 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <p className="text-xs font-semibold text-amber-700">Demo mode — backend offline</p>
        </div>
      )}
    </div>
  );
}
