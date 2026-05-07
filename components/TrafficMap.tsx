"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Map, Marker, useMap } from "@vis.gl/react-google-maps";
import type { CameraData, CongestionStatus, Incident } from "@/lib/api";
import { fetchIncidents } from "@/lib/api";
import { AlertTriangle } from "lucide-react";

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
  altPath?: google.maps.LatLngLiteral[];
  pathColor?: string;
  altPathColor?: string;
  onLocate?: (fn: () => void) => void;
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

function DynamicRouteComponent({ path, color, zIndex }: { path: google.maps.LatLngLiteral[], color: string, zIndex?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !window.google || !path || path.length === 0) return;
    
    const polyline = new window.google.maps.Polyline({
      path,
      strokeColor: color,
      strokeOpacity: 1.0,
      strokeWeight: 7,
      zIndex: zIndex || 1,
      map,
    });

    const bounds = new window.google.maps.LatLngBounds();
    path.forEach((pt) => bounds.extend(pt));
    map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });

    return () => polyline.setMap(null);
  }, [map, path]);
  return null;
}

export default function TrafficMap({ 
  sensorData, 
  dynamicPath, 
  altPath, 
  pathColor = "#2563eb", 
  altPathColor = "#94a3b8",
  onLocate
}: TrafficMapProps) {
  const map = useMap();
  const [userPos, setUserPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  // Function to pan map to user
  const recenter = useCallback(() => {
    if (map && userPos) {
      map.panTo(userPos);
      map.setZoom(15);
    }
  }, [map, userPos]);

  // Expose recenter function to parent
  useEffect(() => {
    if (onLocate) onLocate(recenter);
  }, [onLocate, recenter]);

  useEffect(() => {
    fetchIncidents().then(setIncidents);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported. Using demo fallback.");
      setUserPos({ lat: -17.8350, lng: 31.0450 }); // Demo fallback near CBD
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (pos) => { 
        console.log("GPS Location acquired:", pos.coords.latitude, pos.coords.longitude);
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); 
      },
      (err) => {
        console.warn("Geolocation blocked or failed:", err.message);
        // Fallback to a point near the CBD so the demo still looks good
        setUserPos({ lat: -17.8350, lng: 31.0450 });
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, []);

  const center: google.maps.LatLngLiteral = { lat: -17.8292, lng: 31.0522 };

  const effectiveCameras: Record<string, CameraData> = {};
  CAMERA_NODES.forEach((cam) => {
    effectiveCameras[cam.id] = sensorData?.cameras?.[cam.id] ?? {
      camera_id: cam.id,
      total_flow: 0,
      status: cam.defaultStatus,
    };
  });

  return (
    <div className="relative w-full h-full bg-slate-200">
      <Map
        defaultCenter={center}
        defaultZoom={12}
        disableDefaultUI={true}
        gestureHandling="greedy"
        style={{ width: "100%", height: "100%" }}
      >
        <TrafficLayerComponent />
        
        {altPath && altPath.length > 0 && (
          <DynamicRouteComponent path={altPath} color={altPathColor} zIndex={1} />
        )}

        {dynamicPath && dynamicPath.length > 0 && (
          <>
            <DynamicRouteComponent path={dynamicPath} color={pathColor} zIndex={2} />
            <Marker position={dynamicPath[0]} label="S" />
            <Marker position={dynamicPath[dynamicPath.length - 1]} label="E" />
          </>
        )}

        {/* Camera Nodes */}
        {CAMERA_NODES.map((cam) => {
          const camData = effectiveCameras[cam.id];
          return (
            <Marker 
              key={cam.id} 
              position={{ lat: cam.lat, lng: cam.lng }}
              title={`${cam.label}: ${camData.status}`}
            />
          );
        })}

        {/* User Location */}
        {/* User Location — Professional Blue Dot */}
        {userPos && (
          <Marker 
            position={userPos} 
            title="You are here"
            zIndex={999}
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute w-8 h-8 bg-blue-500/20 rounded-full animate-ping" />
              <div className="relative w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-lg" />
            </div>
          </Marker>
        )}

        {/* Legend Overlay */}
        <div className="absolute bottom-6 left-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-100 px-4 py-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Traffic Legend</p>
          {[
            { color: STATUS_COLOR.CLEAR,     label: "Clear"     },
            { color: STATUS_COLOR.MODERATE,  label: "Moderate"  },
            { color: STATUS_COLOR.CONGESTED, label: "Congested" },
          ].map((l) => (
             <div key={l.label} className="flex items-center gap-2 mb-1.5 last:mb-0">
               <div className="w-5 h-2 rounded-full" style={{ background: l.color }} />
               <span className="text-xs font-bold text-slate-600">{l.label}</span>
             </div>
          ))}
        </div>
      </Map>
    </div>
  );
}
