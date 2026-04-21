"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Map, AdvancedMarker, useMap, InfoWindow } from "@vis.gl/react-google-maps";
import type { CameraData, CongestionStatus, Incident } from "@/lib/api";
import { fetchIncidents } from "@/lib/api";
import { AlertTriangle, Info, MapPin } from "lucide-react";

// ─── Camera nodes ─────────────────────────────────────────────────
export const CAMERA_NODES: {
  id: string;
  lat: number;
  lng: number;
  label: string;
  area: string;
  defaultStatus: CongestionStatus;
}[] = [
  { id: "cam_main_01", lat: -17.8292, lng: 31.0522, label: "CBD North",    area: "Central Business District", defaultStatus: "UNKNOWN"   },
  { id: "cam_02",      lat: -17.7801, lng: 31.0178, label: "Borrowdale",   area: "Borrowdale Rd",             defaultStatus: "CLEAR"     },
  { id: "cam_03",      lat: -17.8100, lng: 31.0650, label: "Avondale",     area: "Avondale Shopping",         defaultStatus: "MODERATE"  },
  { id: "cam_04",      lat: -17.8600, lng: 31.0080, label: "Kuwadzana Jct",area: "Kuwadzana Junction",        defaultStatus: "CONGESTED" },
  { id: "cam_05",      lat: -17.7600, lng: 31.0800, label: "Greendale",    area: "Greendale Ave",             defaultStatus: "CLEAR"     },
];

// Mock coords for incidents since backend only returns address strings (demo purposes)
const INCIDENT_COORDS: Record<string, {lat: number, lng: number}> = {
  "demo-1": { lat: -17.8248, lng: 31.0530 },
  "demo-2": { lat: -17.8920, lng: 31.0250 },
};

const STATUS_COLOR: Record<string, string> = {
  CLEAR:     "#16a34a",
  MODERATE:  "#d97706",
  CONGESTED: "#dc2626",
  UNKNOWN:   "#94a3b8",
};

interface TrafficMapProps {
  sensorData: {
    vehicle_count: number;
    congestion_status: CongestionStatus;
    cameras: Record<string, CameraData>;
    backend_online: boolean;
  };
  dynamicPath?: google.maps.LatLngLiteral[];
}

function TrafficLayerComponent() {
  const map = useMap();
  useEffect(() => {
    if (!map || !window.google) return;
    const layer = new window.google.maps.TrafficLayer();
    layer.setMap(map);
    return () => layer.setMap(null);
  }, [map]);
  return null;
}

function DynamicRouteComponent({ path }: { path: google.maps.LatLngLiteral[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !window.google || !path || path.length === 0) return;
    const polyline = new window.google.maps.Polyline({
      path,
      strokeColor: "#3b82f6",
      strokeOpacity: 0.9,
      strokeWeight: 6,
      map,
    });
    const bounds = new window.google.maps.LatLngBounds();
    path.forEach((pt) => bounds.extend(pt));
    map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
    return () => polyline.setMap(null);
  }, [map, path]);
  return null;
}

export default function TrafficMap({ sensorData, dynamicPath }: TrafficMapProps) {
  const [userPos, setUserPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedCam, setSelectedCam] = useState<string | null>(null);

  useEffect(() => {
    fetchIncidents().then(setIncidents);
  }, []);

  const startLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocError(null); },
      (err) => setLocError(err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => { startLocation(); }, [startLocation]);

  const center: google.maps.LatLngLiteral = { lat: -17.8292, lng: 31.0522 };

  const effectiveCameras: Record<string, CameraData> = {};
  CAMERA_NODES.forEach((cam) => {
    effectiveCameras[cam.id] = sensorData.cameras[cam.id] ?? {
      camera_id: cam.id,
      total_flow: 0,
      status: cam.defaultStatus,
    };
  });

  return (
    <div className="relative w-full h-full">
      <Map
        defaultCenter={center}
        defaultZoom={12}
        disableDefaultUI={true}
        mapId="DEMO_MAP_ID"
        gestureHandling="greedy"
        style={{ width: "100%", height: "100%" }}
        onClick={() => setSelectedCam(null)}
      >
        <TrafficLayerComponent />
        {dynamicPath && dynamicPath.length > 0 && <DynamicRouteComponent path={dynamicPath} />}

        {/* Camera Nodes */}
        {CAMERA_NODES.map((cam) => {
          const camData = effectiveCameras[cam.id];
          const isLive = !!sensorData.cameras[cam.id] && sensorData.backend_online;
          const color = STATUS_COLOR[camData.status];

          return (
            <AdvancedMarker 
              key={cam.id} 
              position={{ lat: cam.lat, lng: cam.lng }} 
              onClick={(e) => {
                e.domEvent.stopPropagation(); // Fix: proper event name for Google Maps AdvancedMarker
                setSelectedCam(cam.id);
              }}
            >
              <div style={{ position: "relative", cursor: "pointer" }}>
                {isLive && (
                  <div style={{
                    position: "absolute", inset: -8, borderRadius: "50%", background: color, 
                    opacity: 0.15, animation: "ping 2s ease-out infinite"
                  }} />
                )}
                <div style={{
                  width: isLive ? 20 : 16, height: isLive ? 20 : 16, borderRadius: "50%",
                  backgroundColor: color, border: "3px solid white",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
                  transform: "translate(-50%, -50%)"
                }} />
              </div>
            </AdvancedMarker>
          );
        })}

        {/* Selected Camera InfoWindow */}
        {selectedCam && (
          <InfoWindow 
            position={{ lat: CAMERA_NODES.find(c => c.id === selectedCam)?.lat || 0, lng: CAMERA_NODES.find(c => c.id === selectedCam)?.lng || 0 }}
            onCloseClick={() => setSelectedCam(null)}
          >
            <div className="p-1 min-w-[140px]">
               <h3 className="text-xs font-black text-black mb-1">{CAMERA_NODES.find(c => c.id === selectedCam)?.label}</h3>
               <p className="text-[10px] text-zinc-500 font-bold uppercase mb-2">{CAMERA_NODES.find(c => c.id === selectedCam)?.area}</p>
               <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                     <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Flow</span>
                     <span className="text-sm font-black text-black">{effectiveCameras[selectedCam].total_flow} <span className="text-[10px]">veh/hr</span></span>
                  </div>
                  <div className={`px-2 py-1 rounded-md text-[9px] font-black text-white ${
                    effectiveCameras[selectedCam].status === "CONGESTED" ? "bg-red-600" :
                    effectiveCameras[selectedCam].status === "MODERATE" ? "bg-amber-600" : "bg-green-600"
                  }`}>
                    {effectiveCameras[selectedCam].status}
                  </div>
               </div>
            </div>
          </InfoWindow>
        )}

        {/* Incident Markers */}
        {incidents.map((inc) => {
          const coords = INCIDENT_COORDS[inc.id] || { lat: -17.82, lng: 31.05 + (Math.random() * 0.1) };
          return (
            <AdvancedMarker key={inc.id} position={coords}>
               <div className="bg-red-600 p-1.5 rounded-lg border-2 border-white shadow-lg shadow-red-600/30 -translate-x-1/2 -translate-y-full hover:scale-110 transition-transform cursor-help">
                  <AlertTriangle size={14} className="text-white" />
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-red-600 shadow-xl" />
               </div>
            </AdvancedMarker>
          );
        })}

        {/* User Location */}
        {userPos && (
          <AdvancedMarker position={userPos}>
            <div className="relative user-pulse">
              <div className="absolute inset-[-10px] rounded-full bg-blue-500/20" />
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg -translate-x-1/2 -translate-y-1/2" />
            </div>
          </AdvancedMarker>
        )}

        {/* Legend */}
        <div className="absolute bottom-20 left-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-2xl shadow-md border border-slate-100 px-4 py-3 pointer-events-auto">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Live Maps Traffic Layer</p>
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
          <div className="mt-3 flex items-center gap-2">
             <div className="w-3 h-3 bg-red-600 rounded-sm flex items-center justify-center"><AlertTriangle size={8} className="text-white"/></div>
             <span className="text-[11px] font-bold text-red-600">Active Incident</span>
          </div>
        </div>

        {!sensorData.backend_online && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 flex items-center gap-2 shadow-sm pointer-events-auto">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <p className="text-xs font-semibold text-amber-700">Demo mode — backend offline</p>
          </div>
        )}
      </Map>

       <button onClick={startLocation}
        className="absolute bottom-20 right-3 z-[1000] w-10 h-10 bg-white rounded-xl shadow-md border border-slate-200 flex items-center justify-center text-blue-600 hover:bg-blue-50 active:scale-95 transition-all pointer-events-auto">
        <MapPin size={18} />
      </button>
    </div>
  );
}

