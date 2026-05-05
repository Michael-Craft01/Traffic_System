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

export default function TrafficMap({ sensorData, dynamicPath, altPath, pathColor = "#2563eb", altPathColor = "#94a3b8" }: TrafficMapProps) {
  const [userPos, setUserPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    fetchIncidents().then(setIncidents);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => {}
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
        {userPos && <Marker position={userPos} title="You are here" />}

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
