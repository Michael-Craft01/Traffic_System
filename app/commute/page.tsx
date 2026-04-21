"use client";
import { useState, useEffect } from "react";
import TrafficMap, { CAMERA_NODES } from "@/components/TrafficMap";
import { fetchForecast, fetchRecommendation, ForecastResult, RecommendationResult, fetchTrafficState } from "@/lib/api";
import { 
  getSavedRoutes, getRecentRoutes, addRecentRoute, saveRoute, deleteSavedRoute, SavedRoute, RecentRoute 
} from "@/lib/storage";
import { 
  Map as RouteIcon, MapPin, TrendingDown, TrendingUp,
  BrainCircuit, AlertTriangle, CheckCircle2, ChevronRight, Info, Search, Route,
  History, Star, Plus, Clock, X, Trash2
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

  // Storage State
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveTime, setSaveTime] = useState("");

  const routesLib = useMapsLibrary("routes");
  const geometryLib = useMapsLibrary("geometry");
  
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService>();

  const loadLists = () => {
    setSavedRoutes(getSavedRoutes());
    setRecentRoutes(getRecentRoutes());
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

  const handleSearch = async (oOverride?: string, dOverride?: string) => {
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
      addRecentRoute({
        origin: { name: leg.start_address || o, lat: leg.start_location.lat(), lng: leg.start_location.lng() },
        destination: { name: leg.end_address || d, lat: leg.end_location.lat(), lng: leg.end_location.lng() }
      });
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

      // Auto-analyze
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
    <div className="h-full flex flex-col bg-zinc-100 relative">
      
      {/* Header */}
      <div className="z-10 bg-white/90 backdrop-blur-xl px-5 pt-8 pb-4 border-b border-white/60 shadow-sm shrink-0">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-black text-black tracking-tight flex items-center gap-2">
            <RouteIcon className="text-black" size={24} strokeWidth={3} />
            Route Brain
          </h1>
          {recentRoutes.length > 0 && (
             <button onClick={() => { localStorage.removeItem("traffic_recent_routes"); loadLists(); }} 
               className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest hover:text-red-500 transition-colors">
               Clear history
             </button>
          )}
        </div>
        
        {/* Search Inputs */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="w-1.5 h-1.5 rounded-full bg-black shrink-0 ml-3" />
             <input type="text" placeholder="Start Point" 
               value={origin} onChange={e=>setOrigin(e.target.value)}
               className="flex-1 bg-zinc-100/80 border border-black/5 rounded-xl px-4 py-2.5 text-sm font-bold placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition-all font-mono" 
             />
          </div>
          <div className="flex items-center gap-3">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 ml-3" />
             <input type="text" placeholder="Destination" 
               value={destination} onChange={e=>setDestination(e.target.value)}
               className="flex-1 bg-zinc-100/80 border border-black/5 rounded-xl px-4 py-2.5 text-sm font-bold placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition-all font-mono" 
             />
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleSearch()} disabled={loading || !origin || !destination || !directionsService} 
              className="flex-1 mt-2 bg-black text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md disabled:bg-zinc-300">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={16} />}
              Analyze Route
            </button>
            {dynamicPath.length > 0 && (
              <button onClick={() => setShowSaveModal(true)} className="mt-2 bg-white border border-black/10 px-4 py-3 rounded-xl text-black shadow-sm active:scale-95 transition-all">
                <Star size={18} />
              </button>
            )}
          </div>
        </div>

        {/* History / Saved Reel */}
        {(savedRoutes.length > 0 || recentRoutes.length > 0) && (
          <div className="flex gap-2 overflow-x-auto mt-4 pb-1 scrollbar-hide -mx-5 px-5">
            {savedRoutes.map(r => (
              <div key={r.id} className="relative group shrink-0">
                <button onClick={() => handleSearch(r.origin.name, r.destination.name)}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-xs font-bold shadow-md shadow-black/10 active:scale-95 transition-all">
                  <Star size={10} fill="white" /> {r.label}
                </button>
                <button onClick={(e) => removeSaved(e, r.id)} className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full border border-black/10 flex items-center justify-center text-black hidden group-hover:flex hover:bg-black hover:text-white transition-all shadow-sm">
                   <X size={8} />
                </button>
              </div>
            ))}
            {recentRoutes.map(r => (
              <div key={r.id} className="relative group shrink-0">
                <button onClick={() => handleSearch(r.origin.name, r.destination.name)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-black/5 text-zinc-600 rounded-full text-xs font-bold shadow-sm active:scale-95 transition-all">
                  <History size={10} /> {r.destination.name.split(',')[0]}
                </button>
                <button onClick={(e) => removeRecent(e, r.id)} className="absolute -top-1 -right-1 w-4 h-4 bg-black rounded-full flex items-center justify-center text-white hidden group-hover:flex hover:bg-white hover:text-black hover:border border-black/10 transition-all shadow-sm">
                   <X size={8} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Modal Overlays */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm flex items-end justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
              <div className="flex justify-between items-start mb-6">
                 <div>
                    <h2 className="text-xl font-black text-black">Save this Route</h2>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Setup proactive monitoring</p>
                 </div>
                 <button onClick={() => setShowSaveModal(false)} className="p-2 bg-zinc-100 rounded-full text-zinc-400 hover:text-black">
                    <X size={20} />
                 </button>
              </div>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1.5 ml-1">Route Label</label>
                    <input type="text" placeholder="e.g. Home, Office, Gym" value={saveName} onChange={e=>setSaveName(e.target.value)}
                      className="w-full bg-zinc-100 border-none rounded-xl px-4 py-3 font-bold text-black focus:ring-2 focus:ring-black/10 transition-all" />
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1.5 ml-1">Daily Departure Time (Optional)</label>
                    <div className="relative">
                       <Clock className="absolute left-4 top-3.5 text-zinc-400" size={16} />
                       <input type="time" value={saveTime} onChange={e=>setSaveTime(e.target.value)}
                         className="w-full bg-zinc-100 border-none rounded-xl pl-12 pr-4 py-3 font-bold text-black focus:ring-2 focus:ring-black/10 transition-all" />
                    </div>
                 </div>
                 <button onClick={handleSave} className="w-full bg-black text-white font-bold py-4 rounded-2xl shadow-xl shadow-black/20 mt-4 active:scale-95 transition-all">
                    Register Permanent Monitoring
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Map Hero Area */}
      <div className="flex-1 min-h-[300px] relative z-0">
        {sensorData ? (
           <TrafficMap sensorData={sensorData} dynamicPath={dynamicPath.length > 0 ? dynamicPath : undefined} />
        ) : (
           <div className="w-full h-full bg-zinc-200 animate-pulse flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-black/10 border-t-black rounded-full animate-spin" />
           </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-zinc-100 to-transparent z-[1000] pointer-events-none" />
      </div>

      {/* Controls Area */}
      <div className="shrink-0 p-5 z-10 bg-zinc-100 pb-24">
        {dynamicPath.length > 0 && !recommendation && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center mb-6">
             <span className="text-[10px] font-black uppercase text-zinc-500 bg-white shadow-sm border border-black/5 px-4 py-2 rounded-full inline-flex items-center gap-2">
               <Route size={14} className="text-blue-500"/>
               Route snapped to {intersectingCams.length} AI nodes.
             </span>
             <button onClick={analyze} disabled={loading}
               className="w-full mt-4 bg-black text-white font-bold py-4 rounded-xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
               <BrainCircuit size={20} /> Evaluation Route Quality
             </button>
          </div>
        )}

        {/* Results */}
        {recommendation && (
          <section className="animate-in zoom-in-95 duration-300">
            <div className={`border rounded-3xl p-6 shadow-xl ${
              recommendation.status === "CLEAR" ? "bg-white border-white/60" :
              recommendation.status === "WARNING" ? "bg-zinc-100 border-zinc-200" :
              recommendation.status === "ALERT" ? "bg-zinc-200 border-zinc-300" :
              "bg-white border-white/60"
            }`}>
              <div className="flex items-start gap-4 mb-6">
                 <div className={`p-4 rounded-2xl shrink-0 ${
                    recommendation.status === "CLEAR" ? "bg-green-600 text-white shadow-lg shadow-green-600/20" :
                    recommendation.status === "ALERT" ? "bg-black text-white shadow-lg" :
                    "bg-amber-600 text-white"
                 }`}>
                   {recommendation.status === "CLEAR" && <CheckCircle2 size={24} />}
                   {(recommendation.status === "ALERT" || recommendation.status === "WARNING") && <AlertTriangle size={24} />}
                 </div>
                 
                 <div className="pt-1">
                   <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">AI Recommendation</h2>
                   <p className="font-black text-lg text-black leading-tight">
                     {recommendation.message}
                   </p>
                 </div>
              </div>

              {/* Forecast Chart */}
              {forecast && forecast.forecast_30_mins.length > 0 && (
                <div className="mt-4 pt-6 border-t border-black/5">
                   <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                     <TrendingUp size={12} /> 30m Traffic Projection
                   </h3>
                   <div className="flex items-end gap-1 h-12 mb-2">
                     {forecast.forecast_30_mins.map((val, i) => (
                       <div key={i} className="flex-1 bg-black/10 rounded-t-sm transition-all hover:bg-black origin-bottom group relative" 
                         style={{ height: `${Math.max(10, (val / Math.max(...forecast.forecast_30_mins)) * 100)}%` }}>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black text-white text-[8px] font-bold px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            {val}
                          </div>
                       </div>
                     ))}
                   </div>
                   <div className="flex justify-between text-[8px] font-bold text-zinc-400 uppercase">
                     <span>T+0m</span>
                     <span>T+15m</span>
                     <span>T+30m</span>
                   </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-4 pt-1 scrollbar-hide">
              {WINDOWS.map((w) => {
                const active = selectedMins === w.mins;
                return (
                  <button key={w.mins} onClick={() => { setSelectedMins(w.mins); setTimeout(analyze, 100); }}
                    className={`shrink-0 px-5 py-3 rounded-xl border text-[11px] font-bold transition-all ${
                      active ? "bg-black text-white border-black shadow-lg scale-105" : "bg-white text-zinc-400 border-zinc-200"
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


