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
  CheckCircle2,
  TrendingUp as TrendIcon,
  Wind,
  Droplets,
  Settings,
  Zap
} from "lucide-react";
import Link from "next/link";
import ForecastChart from "@/components/ForecastChart";

export default function DashboardPage() {
  const [liveState, setLiveState] = useState<TrafficState>({
    total_vehicles: 0,
    average_speed: 0,
    congestion_level: "LOW",
    backend_online: false,
    cameras: {},
    predictions: {}
  });

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(async () => {
    try {
      const [state, incs] = await Promise.all([
        fetchTrafficState(),
        fetchIncidents()
      ]);
      setLiveState(state);
      setIncidents(incs);
    } catch (error) {
      console.error("Dashboard refresh failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const { total_vehicles: totalVehicles, average_speed: avgSpeed, congestion_level: congestion, cameras, backend_online } = liveState;
  
  // Dynamic Score Calculation
  const cityScore = Math.min(100, Math.round((totalVehicles / 1200) * 100));
  const cityHealthStr = cityScore > 75 ? "Severe Delays" : cityScore > 40 ? "Moderate Flow" : "Flowing Smoothly";

  // Eco Impact Stats
  const ecoStats = {
    co2Saved: (totalVehicles * 0.12).toFixed(1),
    fuelEfficiency: "+18%",
    noiseLevel: cityScore > 60 ? "Elevated" : "Ambient"
  };

  const primaryCamId = "cam_main_01";
  const predictionData = liveState.predictions?.[primaryCamId] || [120, 150, 300, 450, 400, 320];

  return (
    <div className="relative w-full h-full flex flex-col bg-zinc-50 overflow-hidden selection:bg-black/10">
      
      {/* ── Top Navigation / HUD ── */}
      <header className="px-8 py-6 flex items-center justify-between bg-white border-b border-black/5 z-10 shrink-0">
         <div className="flex items-center gap-4">
            <div className="bg-black p-3 rounded-2xl text-white shadow-lg">
               <Activity size={24} />
            </div>
            <div>
               <h1 className="text-xl font-black text-black tracking-tighter leading-none">Traffic Intelligence</h1>
               <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mt-1.5 flex items-center gap-1.5">
                 <div className={`w-1.5 h-1.5 rounded-full ${backend_online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                 Node: {backend_online ? 'HRE_CENTER_01' : 'OFFLINE'}
               </p>
            </div>
         </div>
         <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
               <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Active Sensors</span>
               <span className="text-sm font-bold text-black">{Object.keys(cameras).length} Nodes</span>
            </div>
            <Link href="/admin" className="p-3 bg-zinc-100 text-zinc-400 hover:text-black hover:bg-zinc-200 rounded-2xl transition-all border border-black/5">
               <Settings size={20} />
            </Link>
         </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Main Map View ── */}
        <main className="flex-1 relative border-r border-black/5 bg-zinc-100">
           <MapProvider sensorData={liveState} />
           
           {/* Floating Map HUD */}
           <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end pointer-events-none">
              <div className="bg-white/90 backdrop-blur-3xl p-6 rounded-[2.5rem] shadow-2xl border border-black/5 pointer-events-auto flex gap-10">
                 <div>
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Live Count</p>
                    <p className="text-2xl font-black text-black tabular-nums">{totalVehicles}</p>
                 </div>
                 <div className="w-px bg-black/5" />
                 <div>
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Avg Speed</p>
                    <p className="text-2xl font-black text-black tabular-nums">{avgSpeed} <span className="text-sm font-bold text-zinc-300">km/h</span></p>
                 </div>
              </div>
              
              <div className="flex flex-col gap-3 pointer-events-auto">
                 <button className="w-14 h-14 bg-white rounded-2xl shadow-xl flex items-center justify-center text-zinc-400 hover:text-black transition-all border border-black/5">
                    <Layers size={20} />
                 </button>
                 <button className="w-14 h-14 bg-black text-white rounded-2xl shadow-xl flex items-center justify-center hover:bg-zinc-900 transition-all">
                    <LocateFixed size={20} />
                 </button>
              </div>
           </div>
        </main>

        {/* ── Sidebar: Data & Insights ── */}
        <aside className="w-[420px] bg-white overflow-y-auto shrink-0 p-8 space-y-10 scrollbar-hide">
           
           {loading ? (
             <div className="space-y-6 animate-pulse">
                <div className="h-40 bg-zinc-50 rounded-[3rem]"></div>
                <div className="h-64 bg-zinc-50 rounded-[3rem]"></div>
             </div>
           ) : (
             <>
               {/* Quick Action */}
               <Link href="/commute" className="w-full bg-black text-white py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 hover:bg-zinc-900 transition-all active:scale-[0.98]">
                  <RouteIcon size={18} /> Plan Optimized Route
               </Link>

               {/* City Health Index */}
               <section className="bg-zinc-50 border border-black/5 p-8 rounded-[3rem] flex items-center justify-between">
                  <div>
                     <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                       <Activity size={12} className="text-black" /> Network Health
                     </h3>
                     <p className="text-2xl font-black text-black leading-tight">{cityHealthStr}</p>
                     <p className="text-xs font-bold text-zinc-400 mt-1">Load Factor: {cityScore}%</p>
                  </div>
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                       <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-black/5" />
                       <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={`${(cityScore / 100) * 176} 176`} className="text-black" strokeLinecap="round" />
                    </svg>
                    <span className="absolute text-[10px] font-black text-black">{cityScore}%</span>
                  </div>
               </section>

               {/* AI Traffic Forecast */}
               <section className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <Brain size={12} className="text-black" /> AI 6H Forecast
                    </h3>
                    <span className="text-[8px] font-black bg-zinc-100 px-2 py-1 rounded-full text-zinc-500">PREDICTIVE</span>
                  </div>
                  <div className="h-28">
                    <ForecastChart data={predictionData} />
                  </div>
                  <div className="bg-zinc-50 rounded-[2rem] p-6 border border-black/5 flex items-start gap-4">
                    <div className="p-3 bg-white text-black rounded-xl shadow-sm"><Zap size={20} /></div>
                    <p className="text-sm font-bold text-black leading-relaxed">
                       {cityScore > 70 
                         ? "Peak load detected. Rerouting algorithms active to balance arterial flow." 
                         : "Flow stable. Minimal variation predicted across the secondary network."}
                    </p>
                  </div>
               </section>

               {/* Eco-Impact */}
               <section className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'CO2 Saved', val: `${ecoStats.co2Saved}kg`, icon: Wind },
                    { label: 'Fuel Gain', val: ecoStats.fuelEfficiency, icon: Droplets },
                    { label: 'Ambient', val: ecoStats.noiseLevel, icon: Radio }
                  ].map((stat, i) => (
                    <div key={i} className="bg-zinc-50 p-5 rounded-[2rem] border border-black/5 flex flex-col items-center text-center">
                       <stat.icon size={18} className="text-zinc-300 mb-3" />
                       <p className="text-[8px] font-black text-zinc-400 uppercase tracking-tighter mb-1">{stat.label}</p>
                       <p className="text-xs font-black text-black">{stat.val}</p>
                    </div>
                  ))}
               </section>

               {/* Recent Incident Feed */}
               <section className="pt-2">
                  <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2 mb-6 px-2">
                    <ShieldAlert size={12} className="text-black" /> Neural Broadcasts
                  </h3>
                  {incidents.length === 0 ? (
                    <div className="bg-zinc-50 border border-black/5 p-8 rounded-[2.5rem] text-center">
                       <p className="text-sm font-bold text-zinc-400 italic">Clear transmission</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {incidents.slice(0, 2).map(inc => (
                        <div key={inc.id} className="bg-zinc-50 p-5 rounded-[2.5rem] border border-black/5 flex items-start gap-4 hover:bg-zinc-100 transition-all group">
                           <div className="p-3 bg-white rounded-2xl shadow-sm text-zinc-300 group-hover:text-black transition-colors">
                             <CarFront size={20} />
                           </div>
                           <div className="flex-1 min-w-0">
                             <p className="font-black text-sm text-black truncate">{inc.type}</p>
                             <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-widest truncate">{inc.location}</p>
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
               </section>
             </>
           )}
        </aside>
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
