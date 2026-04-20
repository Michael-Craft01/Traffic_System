"use client";
import { useEffect, useState } from "react";
import { BarChart3, Clock, AlertCircle } from "lucide-react";

interface Record {
  timestamp: string;
  vehicle_count: number;
  congestion_status: string;
}

const TABS = ["Today", "7 Days", "30 Days"];

export default function HistoryPage() {
  const [data, setData] = useState<{ source?: string; records: Record[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Today");

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  const records = data?.records ?? [];
  const synthetic = data?.source === "synthetic";
  
  const totalPoints = records.length;
  const avgVol = totalPoints ? Math.round(records.reduce((sum, r) => sum + r.vehicle_count, 0) / totalPoints) : 0;
  const maxVol = totalPoints ? Math.max(...records.map(r => r.vehicle_count)) : 0;
  const maxRecord = records.find(r => r.vehicle_count === maxVol);
  const maxTime = maxRecord ? new Date(maxRecord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--";
  const congestedPoints = records.filter(r => r.congestion_status === "CONGESTED").length;
  const congestionPct = totalPoints ? Math.round((congestedPoints / totalPoints) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto bg-zinc-100 pb-20 relative">
      
      {/* Abstract Background Mesh for Glass Effect */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-300 via-zinc-100 to-zinc-50" />
      
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/70 backdrop-blur-xl px-5 pt-8 pb-5 border-b border-white/60 shadow-sm shadow-black/5">
        <h1 className="text-2xl font-black text-black tracking-tight flex items-center gap-2">
          <BarChart3 className="text-black" size={24} strokeWidth={3} />
          Traffic Analytics
        </h1>
        {synthetic && (
           <div className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/5 rounded-lg border border-black/10 text-[10px] font-bold text-zinc-600 uppercase max-w-max backdrop-blur-md">
             <AlertCircle size={12} /> Live DB Offline
           </div>
        )}
      </div>

      <div className="p-5 space-y-6 relative z-10">
        
        {/* Tabs */}
        <div className="flex bg-white/50 backdrop-blur-md border border-white/60 shadow-inner p-1 rounded-2xl">
          {TABS.map(t => (
            <button 
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 text-[11px] font-bold uppercase tracking-wide py-3 rounded-xl transition-all ${
                tab === t 
                  ? "bg-black text-white shadow-md" 
                  : "text-zinc-500 hover:text-black hover:bg-black/5"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4">
             <div className="h-24 bg-black/5 rounded-2xl border border-white/40"></div>
             <div className="h-24 bg-black/5 rounded-2xl border border-white/40"></div>
             <div className="h-48 bg-black/5 rounded-2xl border border-white/40"></div>
          </div>
        ) : (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-3">
               <div className="bg-white/70 backdrop-blur-xl p-5 rounded-2xl border border-white/60 shadow-lg shadow-black/5">
                 <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Avg Vehicles</p>
                 <p className="text-2xl font-black text-black">{avgVol}</p>
                 <p className="text-[10px] font-semibold text-zinc-400 mt-1 uppercase">veh/hr</p>
               </div>
               <div className="bg-white/70 backdrop-blur-xl p-5 rounded-2xl border border-white/60 shadow-lg shadow-black/5">
                 <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Congested Time</p>
                 <p className="text-2xl font-black text-black">{congestionPct}%</p>
                 <p className="text-[10px] font-semibold text-zinc-400 mt-1 uppercase">of period</p>
               </div>
               <div className="bg-white/70 backdrop-blur-xl p-5 rounded-2xl border border-white/60 shadow-lg shadow-black/5">
                 <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Peak Count</p>
                 <p className="text-2xl font-black text-black">{maxVol}</p>
                 <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-zinc-500 uppercase">
                    <Clock size={10} /> at {maxTime}
                 </div>
               </div>
               <div className="bg-white/70 backdrop-blur-xl p-5 rounded-2xl border border-white/60 shadow-lg shadow-black/5">
                 <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Data Points</p>
                 <p className="text-2xl font-black text-black">{totalPoints}</p>
                 <p className="text-[10px] font-semibold text-zinc-400 mt-1 uppercase">Records</p>
               </div>
            </div>

            {/* Bar Chart 24h */}
            <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white/60 shadow-lg shadow-black/5">
               <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Hourly Vehicle Flow</h3>
               
               <div className="flex items-end gap-1 h-32 mb-3">
                 {/* Downsample to 24 bars for display */}
                 {records.filter((_, i) => i % Math.max(1, Math.floor(records.length / 24)) === 0).slice(-24).map((r, i) => {
                    const h = Math.max(5, (r.vehicle_count / Math.max(maxVol, 1)) * 100);
                    // Map Status to Monochrome Theme (Black/Dark-Gray/Light-Gray)
                    const color = r.congestion_status === "CONGESTED" ? "bg-black" :
                                  r.congestion_status === "MODERATE"  ? "bg-zinc-400" :
                                  "bg-zinc-200";
                    return (
                       <div key={i} className={`flex-1 rounded-full ${color} opacity-90 transition-all hover:opacity-100 hover:scale-y-105 origin-bottom`} style={{ height: `${h}%` }}></div>
                    );
                 })}
               </div>
               
               <div className="flex justify-between text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                 <span>Start</span>
                 <span>Now</span>
               </div>
               
               {/* Legend Monochrome */}
               <div className="flex flex-wrap items-center gap-4 mt-6 text-[10px] font-bold text-zinc-500 uppercase tracking-wide bg-zinc-50 p-3 rounded-xl border border-black/5">
                 <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-zinc-200 border border-black/10"/> Clear</div>
                 <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-zinc-400"/> Moderate</div>
                 <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-black"/> Congested</div>
               </div>
            </div>
            
            {/* Heatmap Monochrome Visual Placeholder */}
            <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white/60 shadow-lg shadow-black/5">
               <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Weekly Intensity</h3>
               <div className="flex flex-col gap-1.5">
                 {["Mon", "Tue"].map(day => (
                   <div key={day} className="flex items-center gap-3">
                     <span className="w-8 text-[10px] font-black text-zinc-400 uppercase">{day}</span>
                     <div className="flex-1 flex gap-1">
                       {Array.from({length: 12}).map((_, i) => (
                         <div key={i} className={`h-4 flex-1 rounded-sm ${["bg-zinc-100", "bg-zinc-300", "bg-zinc-500", "bg-black"][Math.floor(Math.random()*4)]}`}></div>
                       ))}
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
