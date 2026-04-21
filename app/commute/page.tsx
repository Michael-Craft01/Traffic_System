"use client";
import { useState, useEffect } from "react";
import TrafficMap, { CAMERA_NODES } from "@/components/TrafficMap";
import { 
  fetchForecast, fetchRecommendation, ForecastResult, RecommendationResult, fetchTrafficState,
  logJourney, fetchSuggestions, PatternResponse 
} from "@/lib/api";
import { 
  getSavedRoutes, getRecentRoutes, addRecentRoute, saveRoute, deleteSavedRoute, deleteRecentRoute, SavedRoute, RecentRoute 
} from "@/lib/storage";
import { 
  Map as RouteIcon, MapPin, TrendingDown, TrendingUp,
  BrainCircuit, AlertTriangle, CheckCircle2, ChevronRight, Info, Search, Route,
  History, Star, Plus, Clock, X, Trash2, Sparkles
} from "lucide-react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

const WINDOWS = [
  { label: "Now",   mins: 0 },
  { label: "+ 5m",  mins: 5 },
  { label: "+ 10m", mins: 10 },
  { label: "+ 15m", mins: 15 },
  { label: "+ 20m", mins: 20 },
  { label: "+ 25m", mins: 25 },
];

export default function CommutePage() {
  const [selectedMins, setSelectedMins] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [dynamicPath, setDynamicPath] = useState<google.maps.LatLngLiteral[]>([]);
  const [intersectingCams, setIntersectingCams] = useState<string[]>([]);
  
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [sensorData, setSensorData] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<PatternResponse[]>([]);

  // Storage State
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveTime, setSaveTime] = useState("");

  const routesLib = useMapsLibrary("routes");
  const geometryLib = useMapsLibrary("geometry");
  
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService>();

  const loadLists = async () => {
    setSavedRoutes(getSavedRoutes());
    setRecentRoutes(getRecentRoutes());
    const sugs = await fetchSuggestions();
    setSuggestions(sugs);
  };

  useEffect(() => {
    loadLists();
    if (!routesLib) return;
    setDirectionsService(new routesLib.DirectionsService());
  }, [routesLib]);

  // Load basic sensor data for the map
  useEffect(() => {
    fetchTrafficState().then(setSensorData);
  }, []);

  const handleSearch = async (oOverride?: string, dOverride?: string, silentLog = false) => {
    const o = oOverride || origin;
    const d = dOverride || destination;
    if (!o || !d || !directionsService || !geometryLib) return;
    
    setLoading(true);
    setRecommendation(null);
    setForecast(null);

    try {
      const response = await directionsService.route({
        origin: o,
        destination: d,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      });

      if (!response.routes || response.routes.length === 0) {
        throw new Error("No driving route found.");
      }

      const route = response.routes[0];
      const overviewPath = route.overview_path.map(pt => ({
        lat: pt.lat(),
        lng: pt.lng()
      }));
      
      setDynamicPath(overviewPath);

      // Robust Auto-Save to History
      const leg = route.legs[0];
      const journey = {
        origin: { name: leg.start_address || o, lat: leg.start_location.lat(), lng: leg.start_location.lng() },
        destination: { name: leg.end_address || d, lat: leg.end_location.lat(), lng: leg.end_location.lng() }
      };
      
      addRecentRoute(journey);
      if (!silentLog) {
         logJourney({
            origin_name: journey.origin.name,
            origin_lat: journey.origin.lat,
            origin_lng: journey.origin.lng,
            dest_name: journey.destination.name,
            dest_lat: journey.destination.lat,
            dest_lng: journey.destination.lng
         });
      }
      loadLists();

      // Simple collision detection with existing ML camera nodes
      const foundCams = new Set<string>();
      route.overview_path.forEach(pt => {
        CAMERA_NODES.forEach(cam => {
          const camLatLng = new google.maps.LatLng(cam.lat, cam.lng);
          const distance = geometryLib.spherical.computeDistanceBetween(pt, camLatLng);
          if (distance <= 1000) foundCams.add(cam.id);
        });
      });
      setIntersectingCams(Array.from(foundCams));

      // Auto-set inputs if overridden
      if (oOverride || dOverride) {
        setOrigin(o);
        setDestination(d);
      }

    } catch (e: any) {
      alert("Failed to find route: " + (e.message || "Unknown error"));
    }
    setLoading(false);
  };

  const analyze = async () => {
    setLoading(true);
    if (intersectingCams.length === 0) {
       setRecommendation({
         status: "CLEAR",
         message: "Your route avoids all monitored congestion zones.",
         backend_online: true,
         error: null,
         suggested_shift_mins: 0
       });
       setLoading(false);
       return;
    }
    const targetCam = intersectingCams[0];
    const [rcm, fcast] = await Promise.all([
      fetchRecommendation(targetCam, selectedMins),
      fetchForecast(targetCam)
    ]);
    setRecommendation(rcm);
    setForecast(fcast);
    setLoading(false);
  };

  const handleSave = () => {
    if (!saveName || dynamicPath.length === 0) return;
    saveRoute({
      id: `saved_${Date.now()}`,
      label: saveName,
      origin: { name: origin, lat: dynamicPath[0].lat, lng: dynamicPath[0].lng },
      destination: { name: destination, lat: dynamicPath[dynamicPath.length-1].lat, lng: dynamicPath[dynamicPath.length-1].lng },
      scheduledTime: saveTime || undefined
    });
    setShowSaveModal(false);
    setSaveName("");
    setSaveTime("");
    loadLists();
  };

  const removeSaved = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteSavedRoute(id);
    loadLists();
  };

  const removeRecent = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteRecentRoute(id);
    loadLists();
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden">
      
      {/* Header & Smart Suggestions */}
      <div className="z-10 bg-white/95 backdrop-blur-2xl px-5 pt-8 pb-4 border-b border-slate-200 shadow-sm shrink-0">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <RouteIcon className="text-blue-600" size={26} strokeWidth={3} />
            Route Brain
          </h1>
          {recentRoutes.length > 0 && (
             <button onClick={() => { localStorage.removeItem("traffic_recent_routes"); loadLists(); }} 
               className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors">
               Wipe History
             </button>
          )}
        </div>
        
        {suggestions.length > 0 && (
           <div className="mb-5 animate-in slide-in-from-top-4 duration-500">
              <h2 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
                 <Sparkles size={12} className="animate-pulse" /> AI Pattern Discovered
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                 {suggestions.map(s => (
                    <button key={s.id} onClick={() => handleSearch(s.origin_name, s.dest_name, true)}
                      className="shrink-0 bg-blue-50 border border-blue-100 rounded-2xl p-3 flex flex-col gap-1.5 hover:bg-blue-100 transition-all text-left min-w-[160px]">
                       <span className="text-xs font-black text-blue-900">{s.label}</span>
                       <span className="text-[10px] font-bold text-blue-700/70 uppercase">Leaves around {s.target_time}</span>
                    </button>
                 ))}
              </div>
           </div>
        )}

        {/* Search Inputs */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
             <div className="w-2 h-2 rounded-full bg-slate-900 shrink-0" />
             <input type="text" placeholder="Starting Point" 
               value={origin} onChange={e=>setOrigin(e.target.value)}
               className="flex-1 bg-transparent border-none py-2.5 text-sm font-bold placeholder-slate-400 focus:outline-none" 
             />
          </div>
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
             <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
             <input type="text" placeholder="Final Destination" 
               value={destination} onChange={e=>setDestination(e.target.value)}
               className="flex-1 bg-transparent border-none py-2.5 text-sm font-bold placeholder-slate-400 focus:outline-none" 
             />
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleSearch()} disabled={loading || !origin || !destination || !directionsService} 
              className="flex-1 mt-2 bg-slate-900 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-slate-900/10 disabled:bg-slate-300">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={18} />}
              Analyze Commute
            </button>
            {dynamicPath.length > 0 && (
              <button onClick={() => setShowSaveModal(true)} className="mt-2 bg-white border border-slate-200 px-5 py-3.5 rounded-xl text-slate-900 shadow-sm active:scale-95 transition-all hover:bg-slate-50">
                <Star size={20} />
              </button>
            )}
          </div>
        </div>

        {/* History / Saved Reel */}
        {(savedRoutes.length > 0 || recentRoutes.length > 0) && (
          <div className="flex gap-2 overflow-x-auto mt-5 pb-1 scrollbar-hide -mx-5 px-5">
            {savedRoutes.map(r => (
              <div key={r.id} className="relative group shrink-0">
                <button onClick={() => handleSearch(r.origin.name, r.destination.name)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-bold shadow-md active:scale-95 transition-all">
                  <Star size={10} fill="white" /> {r.label}
                </button>
                <button onClick={(e) => removeSaved(e, r.id)} className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full border border-slate-200 flex items-center justify-center text-slate-900 hidden group-hover:flex hover:bg-red-500 hover:text-white transition-all shadow-sm">
                   <X size={8} />
                </button>
              </div>
            ))}
            {recentRoutes.map(r => (
              <div key={r.id} className="relative group shrink-0">
                <button onClick={() => handleSearch(r.origin.name, r.destination.name)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-full text-xs font-bold shadow-sm active:scale-95 transition-all hover:border-blue-500/30">
                  <History size={10} /> {r.destination.name.split(',')[0]}
                </button>
                <button onClick={(e) => removeRecent(e, r.id)} className="absolute -top-1 -right-1 w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center text-white hidden group-hover:flex hover:bg-red-500 transition-all shadow-sm">
                   <X size={8} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-md flex items-end justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-12 duration-500">
              <div className="flex justify-between items-start mb-8">
                 <div>
                    <h2 className="text-2xl font-black text-slate-900">Finalize Monitoring</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em] mt-1.5">Activate proactive AI sentinel</p>
                 </div>
                 <button onClick={() => setShowSaveModal(false)} className="p-2.5 bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors">
                    <X size={24} />
                 </button>
              </div>
              <div className="space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Route Descriptor</label>
                    <input type="text" placeholder="Home, Office, Headquarters..." value={saveName} onChange={e=>setSaveName(e.target.value)}
                      className="w-full bg-slate-100 border-none rounded-2xl px-5 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Daily Departure Window (Optional)</label>
                    <div className="relative">
                       <Clock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                       <input type="time" value={saveTime} onChange={e=>setSaveTime(e.target.value)}
                         className="w-full bg-slate-100 border-none rounded-2xl pl-14 pr-5 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all" />
                    </div>
                 </div>
                 <button onClick={handleSave} className="w-full bg-slate-900 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-slate-900/30 mt-4 active:scale-95 transition-all text-lg hover:bg-slate-800">
                    Enable High-Confidence Watch
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Map Hero */}
      <div className="flex-1 min-h-[300px] relative z-0">
        {sensorData ? (
           <TrafficMap sensorData={sensorData} dynamicPath={dynamicPath.length > 0 ? dynamicPath : undefined} />
        ) : (
           <div className="w-full h-full bg-slate-200 animate-pulse flex items-center justify-center">
              <div className="w-10 h-10 border-[6px] border-slate-900/10 border-t-blue-600 rounded-full animate-spin" />
           </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-50 to-transparent z-[1000] pointer-events-none" />
      </div>

      {/* Evaluation Results */}
      <div className="shrink-0 p-5 z-10 bg-slate-50 pb-24">
        {dynamicPath.length > 0 && !recommendation && !loading && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 text-center mb-6">
             <div className="mb-4 inline-flex items-center gap-2 bg-white px-4 py-2.5 rounded-full shadow-sm border border-slate-200">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Route Identified ({intersectingCams.length} AI Nodes)</span>
             </div>
             <button onClick={analyze} className="w-full bg-slate-900 text-white font-black py-4.5 rounded-2xl shadow-xl hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-3">
               <BrainCircuit size={22} className="text-blue-400" /> Calculate Optimal Departure
             </button>
          </div>
        )}

        {recommendation && (
          <section className="animate-in zoom-in-95 curve-spring duration-500">
            <div className={`rounded-[2rem] p-7 shadow-2xl border-2 ${
              recommendation.status === "CLEAR" ? "bg-white border-green-500/10" :
              recommendation.status === "WARNING" ? "bg-white border-amber-500/10" :
              recommendation.status === "ALERT" ? "bg-slate-900 text-white border-slate-700" :
              "bg-white border-slate-200"
            }`}>
              <div className="flex items-start gap-5 mb-8">
                 <div className={`p-4.5 rounded-2xl shrink-0 ${
                    recommendation.status === "CLEAR" ? "bg-green-50 text-green-600 shadow-lg shadow-green-600/10" :
                    recommendation.status === "ALERT" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" :
                    "bg-amber-50 text-amber-600"
                 }`}>
                   {recommendation.status === "CLEAR" && <CheckCircle2 size={26} />}
                   {(recommendation.status === "ALERT" || recommendation.status === "WARNING") && <AlertTriangle size={26} />}
                 </div>
                 
                 <div className="pt-1.5 flex-1">
                   <h2 className={`text-[10px] font-black uppercase tracking-[0.3em] mb-2 ${recommendation.status === 'ALERT' ? 'text-blue-400' : 'text-slate-400'}`}>AI Commute Strategy</h2>
                   <p className="font-black text-xl leading-snug">
                     {recommendation.message}
                   </p>
                 </div>
              </div>

              {/* Forecast Visualization */}
              {forecast && forecast.forecast_30_mins.length > 0 && (
                <div className="mt-6 pt-8 border-t border-slate-200/60">
                   <div className="flex justify-between items-center mb-5">
                      <h3 className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2 ${recommendation.status === 'ALERT' ? 'text-slate-400' : 'text-slate-900'}`}>
                        <TrendingUp size={16} /> Volume Trajectory
                      </h3>
                   </div>
                   <div className="flex items-end gap-1.5 h-16 mb-3">
                     {forecast.forecast_30_mins.map((val, i) => (
                       <div key={i} className={`flex-1 rounded-t-md transition-all hover:scale-x-110 origin-bottom group relative ${recommendation.status === 'ALERT' ? 'bg-blue-500/40 hover:bg-blue-400' : 'bg-slate-900/10 hover:bg-slate-900'}`} 
                         style={{ height: `${Math.max(12, (val / Math.max(...forecast.forecast_30_mins)) * 100)}%` }}>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-[9px] font-black py-1.5 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-xl pointer-events-none whitespace-nowrap z-50">
                            {val} vehicles
                          </div>
                       </div>
                     ))}
                   </div>
                   <div className="flex justify-between text-[9px] font-black text-slate-400 tracking-widest uppercase">
                     <span>Instant</span>
                     <span>T+15m</span>
                     <span>T+30m</span>
                   </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-4 pt-1 scrollbar-hide">
              {WINDOWS.map((w) => {
                const active = selectedMins === w.mins;
                return (
                  <button key={w.mins} onClick={() => { setSelectedMins(w.mins); setTimeout(analyze, 150); }}
                    className={`shrink-0 px-6 py-3.5 rounded-2xl border-2 text-[11px] font-black tracking-widest transition-all ${
                      active ? "bg-slate-900 text-white border-slate-900 shadow-xl scale-110 z-10" : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
