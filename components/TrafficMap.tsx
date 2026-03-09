"use client";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

// Import Leaflet components dynamically to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(mod => mod.Circle), { ssr: false });

interface TrafficMapProps {
    sensorData: {
        vehicle_count: number;
        congestion_status: string;
    };
}

export default function TrafficMap({ sensorData }: TrafficMapProps) {
    const [L, setL] = useState<any>(null);

    useEffect(() => {
        // Import Leaflet directly for Icon fixes
        import('leaflet').then((leaflet) => {
            setL(leaflet);
        });
    }, []);

    // Custom SVG Marker Icon
    const createIcon = (color: string) => {
        if (!L) return null;
        return new L.DivIcon({
            className: 'custom-div-icon',
            html: `
        <div style="
          background-color: ${color};
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 10px ${color};
        "></div>
      `,
            iconSize: [12, 12],
            iconAnchor: [6, 6],
        });
    };

    // Coordinate for cam_main_01 (Harare CBD North)
    // Matching the DB schema coordinates: 40.7128, -74.0060
    const position: [number, number] = [40.7128, -74.0060];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'CONGESTED': return '#ef4444'; // Red-500
            case 'MODERATE': return '#f97316';  // Orange-500
            case 'CLEAR': return '#10b981';     // Emerald-500
            default: return '#3b82f6';          // Blue-500
        }
    };

    const statusColor = getStatusColor(sensorData.congestion_status);

    if (!L) return (
        <div className="w-full h-full flex items-center justify-center bg-slate-900/50 rounded-2xl animate-pulse">
            <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Initialising Geo-Engine...</span>
        </div>
    );

    return (
        <div className="w-full h-full rounded-2xl overflow-hidden border border-white/5 relative">
            <MapContainer
                center={position}
                zoom={13}
                scrollWheelZoom={false}
                className="h-full w-full z-0"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                {/* Pulsing circle to represent congestion hotspot */}
                <Circle
                    center={position}
                    radius={500}
                    pathOptions={{
                        fillColor: statusColor,
                        color: statusColor,
                        weight: 2,
                        fillOpacity: 0.3
                    }}
                />

                <Marker position={position} icon={createIcon(statusColor)}>
                    <Popup className="custom-popup">
                        <div className="font-sans">
                            <p className="font-bold text-slate-900 m-0 text-sm">CAM_01: Harare North</p>
                            <p className="text-xs text-slate-600 m-0 mt-1">Status: <span style={{ color: statusColor, fontWeight: 'bold' }}>{sensorData.congestion_status}</span></p>
                            <p className="text-xs text-slate-600 m-0">Count: {sensorData.vehicle_count}</p>
                        </div>
                    </Popup>
                </Marker>
            </MapContainer>

            {/* Map Overlay Label */}
            <div className="absolute top-4 left-4 z-[1000] glass-card px-3 py-1.5 rounded-lg border border-white/10 shadow-2xl">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: statusColor }}></div>
                    <span className="text-[10px] font-mono text-white uppercase tracking-wider">Live Congestion Map</span>
                </div>
            </div>
        </div>
    );
}
