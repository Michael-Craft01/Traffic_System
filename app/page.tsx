"use client";
import { useEffect, useState, useCallback } from "react";
import TrafficMap, { CAMERA_NODES } from "@/components/TrafficMap";
import MapProvider from "@/components/MapProvider";
import { fetchTrafficState, TrafficState, fetchIncidents, Incident } from "@/lib/api";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Leaf, 
  Map as RouteIcon,
  Activity,
  Video,
  Brain,
  CloudRain,
  Sun,
  ShieldAlert,
  CarFront,
  Clock,
  Radio,
  ChevronRight,
  CheckCircle2
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
  
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchState = useCallback(async () => {
    const data = await fetchTrafficState();
    setLiveState(data);
    setLoading(false);
  }, []);

  const fetchLiveIncidents = useCallback(async () => {
    const data = await fetchIncidents();
    setIncidents(data);
  }, []);

  useEffect(() => {
    fetchState();
    fetchLiveIncidents();
    const interval = setInterval(() => {
      fetchState();
      fetchLiveIncidents();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchState, fetchLiveIncidents]);

  const { vehicle_count, congestion_status, backend_online, error, cameras } = liveState;

  // ── Feature 1: Computed City Score ──
  const activeCameras = Object.values(cameras);
  const totalVehicles = activeCameras.reduce((acc, c) => acc + c.total_flow, 0) || vehicle_count;
  // Let's assume a city capacity of roughly 1200 actively tracked in our small demo grid
  const cityScore = Math.min(100, Math.round((totalVehicles / 1200) * 100));
  const cityHealthStr = cityScore > 75 ? "Severe Delays" : cityScore > 40 ? "Moderate Flow" : "Flowing Smoothly";

  return (
    <div className="relative w-full h-full flex flex-col bg-zinc-100 overflow-hidden">
      
      {/* ── Header Overlay (Glass) ── */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none p-4">
        <div className="flex justify-between items-start">
          <div className="pointer-events-auto bg-white/70 backdrop-blur-xl border border-white/60 shadow-lg shadow-black/5 rounded-2xl p-3 inline-block">
            <h1 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5 flex items-center gap-1">
              <Radio size={12} className="text-black" /> Local Monitoring
            </h1>
            <p className="text-sm font-black text-black">
              Traffic Brain System
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
          <div className="mt-3 pointer-events-auto flex items-start gap-2 bg-white/80 backdrop-blur-xl border border-white/60 rounded-xl p-3 max-w-[250px] shadow-lg shadow-black/5 transition-all duration-300">
            <AlertCircle size={16} className="text-black mt-0.5 shrink-0" />
            <p className="text-[10px] font-bold text-zinc-600 leading-tight">
              {error} - using fallback ML models.
            </p>
          </div>
        )}
      </div>

      {/* ── Map Layer (40% height on most screens) ── */}
      <div className="flex-none h-[40vh] w-full relative z-0">
         <MapProvider sensorData={liveState} />
         {/* Gradient fade to seamlessly blend map with bottom sheet */}
         <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/80 to-transparent z-[1000] pointer-events-none" />
      </div>

      {/* ── Bottom Command Center (Scrollable) ── */}
      <div className="flex-1 overflow-y-auto relative z-10 bg-white/80 backdrop-blur-2xl border-t border-white/60 shadow-[0_-12px_40px_rgba(0,0,0,0.06)] rounded-t-3xl pb-24 shrink-0 pointer-events-auto">
        <div className="sticky top-0 bg-white/40 backdrop-blur-md pt-3 pb-2 z-20">
           <div className="w-12 h-1.5 bg-black/10 rounded-full mx-auto" />
        </div>

        {loading ? (
           <div className="p-4 animate-pulse space-y-4">
             <div className="h-20 bg-black/5 rounded-2xl"></div>
             <div className="h-24 bg-black/5 rounded-2xl"></div>
             <div className="h-32 bg-black/5 rounded-2xl"></div>
           </div>
        ) : (
          <div className="p-4 space-y-5">

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Link href="/commute" className="bg-black text-white rounded-2xl py-3.5 font-bold text-sm shadow-xl shadow-black/10 active:scale-[0.98] transition-all text-center flex items-center justify-center gap-2">
                <RouteIcon size={16} /> Plan Route
              </Link>
              <Link href="/incidents" className="bg-white/60 backdrop-blur-md text-black border border-black/10 rounded-2xl py-3.5 font-bold text-sm shadow-sm active:scale-[0.98] transition-all text-center flex items-center justify-center gap-2">
                <AlertCircle size={16} /> Report Jam
              </Link>
            </div>

            {/* Feature 1: City Health Index */}
            <section className="bg-white/70 backdrop-blur-xl border border-white/60 p-5 rounded-3xl shadow-lg shadow-black/5 flex items-center justify-between">
               <div>
                  <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                    <Activity size={12} className="text-black" /> City Congestion
                  </h3>
                  <p className="text-xl font-black text-black">{cityHealthStr}</p>
                  <p className="text-xs font-bold text-zinc-400 mt-0.5">Index Score: {cityScore}/100</p>
               </div>
               <div className="relative w-14 h-14 flex items-center justify-center">
                 <svg className="w-full h-full transform -rotate-90">
                    <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-zinc-100" />
                    <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={`${(cityScore / 100) * 150} 150`} className={cityScore > 75 ? "text-black" : cityScore > 40 ? "text-zinc-500" : "text-zinc-300"} strokeLinecap="round" />
                 </svg>
                 <span className="absolute text-sm font-black text-black">{cityScore}%</span>
               </div>
            </section>

            {/* Feature 3: AI Predictive Insights */}
            <section className="bg-zinc-100/80 border border-black/5 p-4 rounded-3xl shadow-inner">
               <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-2 pl-1">
                 <Brain size={12} className="text-black" /> Traffic Brain AI Insight
               </h3>
               <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5 flex items-start gap-3">
                 <div className="p-2 bg-black text-white rounded-xl shrink-0"><Brain size={16} /></div>
                 <div>
                    <p className="text-sm font-bold text-black leading-tight">
                      {cityScore > 70 
                        ? "Congestion is rapidly rising across the CBD. Delay non-essential travel by 30 mins." 
                        : cityScore > 40
                        ? "Volumes are stable. Minor delays predicted near major junctions over the next 15m."
                        : "Current flow is ideal. AI predicts smooth routes for the next 45 minutes."}
                    </p>
                 </div>
               </div>
            </section>

            {/* Feature 5: Weather & Road Traction */}
            <section className="flex gap-3">
               <div className="flex-1 bg-white/70 backdrop-blur-xl border border-white/60 p-4 rounded-3xl shadow-lg shadow-black/5 flex items-center gap-3">
                 <div className="p-3 bg-zinc-100 text-black rounded-full border border-black/5"><Sun size={20} /></div>
                 <div>
                   <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Road State</p>
                   <p className="text-sm font-black text-black">Dry / Clear</p>
                 </div>
               </div>
               <div className="flex-1 bg-white/70 backdrop-blur-xl border border-white/60 p-4 rounded-3xl shadow-lg shadow-black/5 flex items-center gap-3">
                 <div className="p-3 bg-zinc-100 text-black rounded-full border border-black/5 text-center leading-none">
                    <span className="text-[11px] font-black">26°</span>
                 </div>
                 <div>
                   <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">AI Delay Factor</p>
                   <p className="text-sm font-black text-black">+0%</p>
                 </div>
               </div>
            </section>

            {/* Feature 2: CCTV Preview Carousel */}
            <section className="pt-2">
               <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-3 pl-1">
                 <Video size={12} className="text-black" /> Live Node Cameras
               </h3>
               <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 snap-x">
                 {CAMERA_NODES.map(cam => {
                   const cData = cameras[cam.id];
                   const isLive = !!cData && backend_online;
                   const status = cData?.status || cam.defaultStatus;
                   return (
                     <div key={cam.id} className="snap-start shrink-0 w-36 bg-black text-white rounded-3xl overflow-hidden shadow-xl shadow-black/20 p-1 relative border border-zinc-800">
                        {/* Fake CCTV feed look */}
                        <div className="h-20 w-full bg-zinc-900 rounded-2xl overflow-hidden relative border border-white/10">
                           <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                             <div className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-red-500 animate-pulse" : "bg-zinc-600"}`} />
                             <span className="text-[8px] font-mono font-bold text-white/70 tracking-widest">
                               {isLive ? "REC" : "MEM"}
                             </span>
                           </div>
                           {/* Decorative static interference lines */}
                           <div className="absolute inset-0 bg-[repeating-linear-gradient(transparent,transparent_2px,rgba(255,255,255,0.03)_3px)] pointer-events-none" />
                           <div className="absolute bottom-1 right-1 text-[7px] font-mono text-white/50">{new Date().toISOString().slice(11,19)}</div>
                        </div>
                        <div className="p-3">
                           <p className="text-xs font-bold truncate">{cam.label}</p>
                           <p className={`text-[10px] font-bold uppercase mt-1 flex items-center gap-1 ${
                              status === 'CLEAR' ? 'text-zinc-400' :
                              status === 'MODERATE' ? 'text-zinc-300' : 'text-white'
                           }`}>
                             {status === "CONGESTED" && <AlertCircle size={10} />}
                             {status}
                           </p>
                        </div>
                     </div>
                   );
                 })}
               </div>
            </section>

            {/* Feature 4: Recent Incident Feed */}
            <section className="pt-2 mb-4">
               <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-3 pl-1">
                 <ShieldAlert size={12} className="text-black" /> Crowd Reports
               </h3>
               {incidents.length === 0 ? (
                 <div className="bg-white/50 backdrop-blur-md border border-white/60 p-6 rounded-3xl text-center shadow-sm">
                   <CheckCircle2 size={24} className="mx-auto mb-2 text-zinc-400" strokeWidth={2}/>
                   <p className="text-sm font-bold text-zinc-600">No active reports</p>
                 </div>
               ) : (
                 <div className="space-y-3">
                   {incidents.slice(0, 3).map(inc => (
                     <div key={inc.id} className="bg-white/80 backdrop-blur-xl border border-white/60 p-4 rounded-3xl shadow-lg shadow-black/5 flex items-start gap-4">
                        <div className={`p-3 rounded-2xl shrink-0 ${inc.severity === 'high' ? 'bg-black text-white' : 'bg-zinc-100 text-black border border-black/5'}`}>
                          <CarFront size={18} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-sm text-black flex items-center justify-between">
                            {inc.type} <span className="text-[9px] font-bold text-zinc-400 flex items-center gap-1 bg-black/5 px-2 rounded-md"><Clock size={8}/> LIVE</span>
                          </p>
                          <p className="text-xs font-bold text-zinc-500 mt-0.5 truncate">{inc.location}</p>
                        </div>
                     </div>
                   ))}
                 </div>
               )}
               <Link href="/incidents" className="block text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-4 pb-2">
                 View All Reports <ChevronRight size={10} className="inline mb-0.5" />
               </Link>
            </section>

          </div>
        )}
      </div>
    </div>
  );
}
