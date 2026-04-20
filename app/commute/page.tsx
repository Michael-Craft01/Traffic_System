"use client";
import { useState, useCallback, useEffect } from "react";
import { fetchForecast, fetchRecommendation, ForecastResult, RecommendationResult } from "@/lib/api";
import { 
  Map as RouteIcon,
  MapPin,
  Clock,
  TrendingDown,
  TrendingUp,
  BrainCircuit,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info
} from "lucide-react";

const WINDOWS = [
  { label: "Now",   mins: 0 },
  { label: "+ 5m",  mins: 5 },
  { label: "+ 10m", mins: 10 },
  { label: "+ 15m", mins: 15 },
  { label: "+ 20m", mins: 20 },
  { label: "+ 30m", mins: 30 },
];

export default function CommutePage() {
  const [selectedMins, setSelectedMins] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  
  useEffect(() => {
    const loadInitial = async () => {
      const data = await fetchForecast("cam_main_01");
      setForecast(data);
      setLoadingInitial(false);
    };
    loadInitial();
  }, []);

  const analyze = async () => {
    setLoading(true);
    const [rcm, fcast] = await Promise.all([
      fetchRecommendation("cam_main_01", selectedMins),
      fetchForecast("cam_main_01")
    ]);
    
    setRecommendation(rcm);
    setForecast(fcast);
    setLoading(false);
  };

  return (
    <div className="h-full overflow-y-auto bg-zinc-100 pb-20 relative">
      
      {/* Background Mesh */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-300 via-zinc-100 to-zinc-50" />
      
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/70 backdrop-blur-xl px-5 pt-8 pb-5 border-b border-white/60 shadow-sm shadow-black/5">
        <h1 className="text-2xl font-black text-black tracking-tight flex items-center gap-2">
          <RouteIcon className="text-black" size={24} strokeWidth={3} />
          Smart Commute
        </h1>
        <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
          AI-Powered Departure Planning
        </p>
      </div>

      <div className="p-5 space-y-6 relative z-10">
        
        {/* Route Card */}
        <section>
          <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">
            Your Route
          </h2>
          <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl p-1 shadow-lg shadow-black/5">
            <div className="flex items-center gap-4 p-4">
               <div className="w-10 h-10 rounded-2xl bg-zinc-100 border border-black/5 flex items-center justify-center shrink-0">
                 <MapPin className="text-black" size={20} />
               </div>
               <div className="text-left flex-1">
                 <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">From</p>
                 <p className="font-bold text-black mt-0.5">Home (Sector 7)</p>
               </div>
            </div>
            <div className="w-px h-6 bg-zinc-200 mx-auto -my-3 relative z-10" />
            <div className="flex items-center gap-4 p-4 border-t border-black/5 bg-black/[0.02] rounded-b-3xl">
               <div className="w-10 h-10 rounded-2xl bg-black flex items-center justify-center shrink-0 shadow-md shadow-black/20">
                 <MapPin className="text-white" size={20} />
               </div>
               <div className="text-left flex-1">
                 <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">To</p>
                 <p className="font-bold text-black mt-0.5">Office (CBD North)</p>
               </div>
            </div>
          </div>
        </section>

        {/* Departure Time */}
        <section>
          <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">
            Planned Departure
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-4 pt-1 scrollbar-hide -mx-5 px-5">
            {WINDOWS.map((w) => {
              const active = selectedMins === w.mins;
              return (
                <button
                  key={w.mins}
                  onClick={() => setSelectedMins(w.mins)}
                  className={`shrink-0 px-6 py-4 rounded-2xl border text-sm font-bold transition-all ${
                    active 
                      ? "bg-black text-white border-black shadow-xl shadow-black/20 transform scale-105" 
                      : "bg-white/70 backdrop-blur-md text-zinc-600 border-white/60 shadow-sm hover:bg-white relative top-1"
                  }`}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={analyze}
            disabled={loading}
            className="w-full mt-2 bg-black active:bg-zinc-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-black/20 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            {loading ? (
               <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing...
               </>
            ) : (
               <>
                  <BrainCircuit size={20} />
                  Analyze Commute Window
               </>
            )}
          </button>
        </section>

        {/* Results */}
        {recommendation && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
              <BrainCircuit size={12} className="text-black" />
              AI Recommendation
            </h2>
            
            <div className={`border rounded-3xl p-6 shadow-xl shadow-black/5 ${
              recommendation.status === "CLEAR" ? "bg-white/90 border-white/60" :
              recommendation.status === "WARNING" ? "bg-zinc-100/90 border-white/60" :
              recommendation.status === "ALERT" ? "bg-zinc-200/90 border-white/60" :
              "bg-white/70 border-white/60"
            } backdrop-blur-xl`}>
              
              <div className="flex items-start gap-4 mb-5">
                 <div className={`p-4 rounded-2xl shrink-0 ${
                    recommendation.status === "CLEAR" ? "bg-zinc-100 text-black border border-black/5" :
                    recommendation.status === "WARNING" ? "bg-zinc-200 text-black border border-black/10" :
                    recommendation.status === "ALERT" ? "bg-black text-white shadow-lg shadow-black/20" :
                    "bg-zinc-100 text-zinc-500"
                 }`}>
                   {recommendation.status === "CLEAR" && <CheckCircle2 size={24} />}
                   {recommendation.status === "WARNING" && <AlertTriangle size={24} />}
                   {recommendation.status === "ALERT" && <AlertTriangle size={24} strokeWidth={2.5}/>}
                   {recommendation.status === "error" && <Info size={24} />}
                 </div>
                 
                 <div className="pt-1">
                   <p className="font-black text-lg text-black leading-tight mb-1.5">
                     {recommendation.message}
                   </p>
                   {recommendation.suggested_shift_mins ? (
                     <p className="text-sm font-bold text-zinc-500 flex items-center gap-1 hover:text-black cursor-pointer transition-colors" onClick={() => setSelectedMins(recommendation.suggested_shift_mins || 0)}>
                       Try +{recommendation.suggested_shift_mins}m instead <ChevronRight size={16}/>
                     </p>
                   ) : null}
                 </div>
              </div>

              {/* Stats Box */}
              {(recommendation.predicted_volume !== undefined || forecast?.forecast_30_mins) && (
                <div className="bg-white/80 rounded-2xl p-4 grid grid-cols-2 gap-4 border border-black/5 shadow-inner">
                   {recommendation.predicted_volume !== undefined && (
                     <div>
                       <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Est. Volume</p>
                       <p className="font-black text-2xl text-black">{recommendation.predicted_volume} <span className="text-xs font-semibold text-zinc-400 normal-case tracking-normal">veh/hr</span></p>
                     </div>
                   )}
                   {forecast?.forecast_30_mins && forecast.forecast_30_mins.length > 0 && (
                     <div>
                       <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Trend</p>
                       <div className="flex items-center gap-1.5 mt-2">
                          {forecast.forecast_30_mins[0] < forecast.forecast_30_mins[forecast.forecast_30_mins.length-1] ? (
                             <><TrendingUp size={20} className="text-black"/><span className="text-sm font-bold text-black">Rising</span></>
                          ) : (
                             <><TrendingDown size={20} className="text-zinc-600"/><span className="text-sm font-bold text-zinc-600">Falling</span></>
                          )}
                       </div>
                     </div>
                   )}
                </div>
              )}
              
              {!recommendation.backend_online && (
                 <p className="text-[10px] font-bold text-zinc-500 uppercase text-center mt-4 tracking-wider bg-black/5 py-1.5 rounded-full inline-block w-full">
                   ⚠ Using offline ML inference model
                 </p>
              )}
            </div>
          </section>
        )}

        {/* Tips Section */}
        <section className="bg-white/50 backdrop-blur-md border border-white/60 shadow-sm shadow-black/5 rounded-3xl p-6 mb-8">
           <h2 className="text-[10px] font-bold text-black uppercase tracking-widest mb-4 flex items-center gap-2">
              <Lightbulb size={14} className="text-black" />
              General Guidance
           </h2>
           <ul className="space-y-4">
             {[
               "Morning peak is typically 07:30 - 08:45 AM.",
               "Leaving 15 minutes early can save 25% trip time.",
               "AI Brain analyzes 12 past data points to predict the next 6 time windows."
             ].map((tip, i) => (
                <li key={i} className="flex items-start gap-3 text-sm font-semibold text-zinc-700 border-b border-black/5 pb-4 last:border-0 last:pb-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-black mt-1.5 shrink-0" />
                   {tip}
                </li>
             ))}
           </ul>
        </section>

      </div>
    </div>
  );
}
