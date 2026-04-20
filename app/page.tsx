"use client";
import { useEffect, useState, useCallback } from "react";
import TrafficMap from "@/components/TrafficMap";
import { fetchTrafficState, TrafficState } from "@/lib/api";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Leaf, 
  Map as RouteIcon,
  Info
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const [liveState, setLiveState] = useState<TrafficState>({
    vehicle_count: 0,
    congestion_status: "UNKNOWN",
    cameras: {},
    backend_online: false,
    error: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchState = useCallback(async () => {
    const data = await fetchTrafficState();
    setLiveState(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const { vehicle_count, congestion_status, backend_online, error } = liveState;

  return (
    <div className="relative w-full h-full flex flex-col bg-zinc-100">
      
      {/* ── Header Overlay (Glass) ── */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none p-4">
        <div className="flex justify-between items-start">
          <div className="pointer-events-auto bg-white/70 backdrop-blur-xl border border-white/60 shadow-lg shadow-black/5 rounded-2xl p-3 inline-block">
            <h1 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">
              Local Monitoring
            </h1>
            <p className="text-sm font-bold text-black">
              Harare CBD North
            </p>
          </div>

          <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/50 shadow-lg shadow-black/5 bg-white/70 backdrop-blur-xl">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                backend_online ? "bg-black" : "bg-zinc-400"
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                backend_online ? "bg-black" : "bg-zinc-500"
              }`}></span>
            </span>
            <span className="text-[10px] font-bold tracking-wider uppercase text-black">
              {backend_online ? "Live DBS" : "Offline"}
            </span>
          </div>
        </div>
        
        {error && !backend_online && (
          <div className="mt-2 pointer-events-auto flex items-start gap-2 bg-white/80 backdrop-blur-xl border border-white/60 rounded-xl p-2.5 max-w-sm shadow-lg shadow-black/5 transition-all duration-300">
            <AlertCircle size={16} className="text-black mt-0.5 shrink-0" />
            <p className="text-[11px] font-semibold text-zinc-600 leading-tight">
              {error} - using fallback ML models for estimation.
            </p>
          </div>
        )}
      </div>

      {/* ── Map Layer ── */}
      <div className="flex-1 w-full relative z-0">
         <TrafficMap sensorData={liveState} />
      </div>

      {/* ── Bottom Info Panel (Glass) ── */}
      <div className="relative z-10 bg-white/80 backdrop-blur-2xl border-t border-white/60 shadow-[0_-12px_40px_rgba(0,0,0,0.06)] rounded-t-3xl pt-2 pb-6 px-4 shrink-0 pointer-events-auto">
        {/* Grab Handle */}
        <div className="w-12 h-1.5 bg-black/10 rounded-full mx-auto mb-5" />

        {loading ? (
           <div className="animate-pulse space-y-4">
             <div className="h-4 bg-black/5 rounded w-1/4"></div>
             <div className="h-8 bg-black/5 rounded w-1/2"></div>
             <div className="h-12 bg-black/5 rounded w-full"></div>
           </div>
        ) : (
          <>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 pl-1">
              Live Status
            </p>
            <div className="flex items-end justify-between mb-6 px-1">
              <div>
                <h2 className="text-3xl font-black text-black tracking-tight leading-none mb-2">
                  {congestion_status}
                </h2>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-black/10 bg-black/5">
                  {congestion_status === "CLEAR" ? (
                    <TrendingDown size={14} className="text-black" strokeWidth={2.5}/>
                  ) : (
                    <TrendingUp size={14} className="text-black" strokeWidth={2.5} />
                  )}
                  <span className="text-xs font-bold text-black">{vehicle_count} vehicles</span>
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-zinc-500 mb-1">
                  <Leaf size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Eco Stats</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                   <div className="flex items-baseline gap-1">
                     <span className="text-sm font-black text-black">
                       {(vehicle_count > 0 ? (vehicle_count * 0.04) : 0).toFixed(1)}
                     </span>
                     <span className="text-[10px] font-bold text-zinc-500 uppercase">kg CO₂</span>
                   </div>
                   <div className="flex items-baseline gap-1">
                     <span className="text-sm font-black text-zinc-700">
                       {(vehicle_count > 0 ? (vehicle_count * 0.02) : 0).toFixed(1)}
                     </span>
                     <span className="text-[10px] font-bold text-zinc-500 uppercase">L Fuel</span>
                   </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/commute"
                className="btn bg-black text-white rounded-xl py-3.5 font-bold text-sm shadow-lg hover:bg-zinc-800 active:scale-95 transition-all text-center flex items-center justify-center gap-2"
              >
                <RouteIcon size={18} />
                Plan Route
              </Link>
              <Link 
                href="/incidents"
                className="btn bg-white/50 backdrop-blur-md text-black border border-black/10 rounded-xl py-3.5 font-bold text-sm shadow-sm hover:bg-white/80 active:scale-95 transition-all text-center flex items-center justify-center gap-2"
              >
                <AlertCircle size={18} />
                Report Jam
              </Link>
            </div>
            
            <p className="text-[10px] font-semibold text-zinc-400 text-center mt-4">
              Local analysis updated at {new Date().toLocaleTimeString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
