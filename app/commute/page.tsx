"use client";
import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Search, 
  Clock, 
  AlertTriangle, 
  ShieldCheck,
  Zap,
  Sparkles,
  Route as RouteIcon,
  X,
  Layers,
  LocateFixed,
  History,
  MoreVertical,
  Activity,
  ArrowRight,
  TrendingDown,
  Navigation,
  Star
} from 'lucide-react';
import MapProvider from '@/components/MapProvider';
import PlaceAutocomplete from '@/components/PlaceAutocomplete';
import { 
  getRecentRoutes, 
  addRecentRoute 
} from '@/lib/storage';
import { fetchRecommendation, fetchTrafficState, logJourney, fetchSuggestions } from '@/lib/api';
import { CAMERA_NODES } from '@/components/TrafficMap';

// Manual Polyline Decoder
function decodePolyline(encoded: string) {
  if (!encoded) return [];
  let points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  while (index < len) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    points.push({ lat: lat / 1E5, lng: lng / 1E5 });
  }
  return points;
}

export default function CommutePage() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originCoords, setOriginCoords] = useState("");
  const [destCoords, setDestCoords] = useState("");

  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [sensorData, setSensorData] = useState<any>(null);
  const [dynamicPath, setDynamicPath] = useState<google.maps.LatLngLiteral[]>([]);
  const [intersectingCams, setIntersectingCams] = useState<string[]>([]);
  
  const [recentRoutes, setRecentRoutes] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [departureTime, setDepartureTime] = useState(new Date().toTimeString().slice(0,5));
  const [toast, setToast] = useState<{ 
    message: string, 
    duration: string, 
    distance: string,
    insight?: string,
    status?: string
  } | null>(null);
  const toastTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setRecentRoutes(getRecentRoutes());
    fetchSuggestions().then(s => {
      // COORDINATE-BASED FALLBACKS: Guarantees a route is found even if strings are vague
      if (!s || s.length === 0) {
        setSuggestions([
          { label: "Morning CBD", origin_name: "Borrowdale, Harare", dest_name: "CBD, Harare", origin_coord: "-17.750,31.100", dest_coord: "-17.830,31.050" },
          { label: "Evening Return", origin_name: "CBD, Harare", dest_name: "Borrowdale, Harare", origin_coord: "-17.830,31.050", dest_coord: "-17.750,31.100" }
        ]);
      } else {
        setSuggestions(s);
      }
    });
    fetchTrafficState().then(setSensorData);
  }, []);

  const runAIForecast = async (camIds: string[]) => {
    try {
      const allPredictions = await Promise.all(camIds.map(camId => fetchRecommendation(camId, 0)));
      const worstRec = allPredictions.reduce((prev, curr) => (curr.predicted_volume || 0) >= (prev.predicted_volume || 0) ? curr : prev);
      const timeline = [
        worstRec.predicted_volume * 0.4, worstRec.predicted_volume * 0.7, worstRec.predicted_volume,
        worstRec.predicted_volume * 0.8, worstRec.predicted_volume * 0.5, worstRec.predicted_volume * 0.3
      ];
      setRecommendation({ ...worstRec, timeline });
      return worstRec;
    } catch (e) {
      setRecommendation({ status: "error", message: "AI Analysis Offline" });
      return null;
    }
  };

  const handleModernAnalyze = async (oOverride?: string, dOverride?: string, silentLog = false) => {
    const o = oOverride || originCoords || origin;
    const d = dOverride || destCoords || destination;
    if (!o || !d) return;
    
    setLoading(true);
    setRecommendation(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      const response = await fetch(`https://routes.googleapis.com/directions/v2:computeRoutes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey || "",
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline,routes.legs'
        },
        body: JSON.stringify({
          origin: o.includes(',') && !isNaN(parseFloat(o.split(',')[0])) ? { location: { latLng: { latitude: Number(o.split(',')[0]), longitude: Number(o.split(',')[1]) } } } : { address: o },
          destination: d.includes(',') && !isNaN(parseFloat(d.split(',')[0])) ? { location: { latLng: { latitude: Number(d.split(',')[0]), longitude: Number(d.split(',')[1]) } } } : { address: d },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          units: 'METRIC'
        })
      });

      const data = await response.json();
      if (data.error) {
        if (data.error.message.includes("not been used")) {
           throw new Error("ROUTES API DISABLED: Please enable 'Routes API' in Google Cloud Console.");
        }
        throw new Error(data.error.message);
      }
      if (!data.routes || data.routes.length === 0) throw new Error("No driving route found between these locations.");

      const route = data.routes[0];
      const path = route.polyline ? decodePolyline(route.polyline.encodedPolyline) : [];
      setDynamicPath(path);

      // Extract details for toast
      const durationSecs = parseInt(route.duration.replace('s', ''));
      const distanceMeters = route.distanceMeters;
      const timeStr = durationSecs >= 3600 
        ? `${Math.floor(durationSecs / 3600)}h ${Math.floor((durationSecs % 3600) / 60)}m`
        : `${Math.floor(durationSecs / 60)} mins`;
      const distStr = `${(distanceMeters / 1000).toFixed(1)} km`;

      setToast({
        message: "Route Optimized",
        duration: timeStr,
        distance: distStr
      });
      
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 8000);

      const leg = route.legs[0];
      const journey = {
        origin: { name: origin || "Start", lat: leg.startLocation.latLng.latitude, lng: leg.startLocation.latLng.longitude },
        destination: { name: destination || "End", lat: leg.endLocation.latLng.latitude, lng: leg.endLocation.latLng.longitude }
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
      setRecentRoutes(getRecentRoutes());

      const foundCams = new Set<string>();
      path.forEach(pt => {
        CAMERA_NODES.forEach(cam => {
          const dx = (cam.lng - pt.lng) * Math.cos(cam.lat * Math.PI / 180);
          const dy = (cam.lat - pt.lat);
          if (Math.sqrt(dx*dx + dy*dy) * 111320 <= 1000) foundCams.add(cam.id);
        });
      });
      
      const camList = Array.from(foundCams);
      setIntersectingCams(camList);
      
      // AI RECOMMENDATION LOGIC
      // Even if no cameras are found, we trigger a forecast using a "virtual" global ID
      // so the user always gets a time-of-day based prediction.
      const aiRec = await runAIForecast(camList.length > 0 ? camList : ["cam_virtual_harare"]);
      
      if (aiRec) {
        setToast(prev => prev ? {
          ...prev,
          insight: aiRec.message,
          status: aiRec.status
        } : null);
        
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 8000);
      }

    } catch (e: any) {
      alert(e.message || "Route search failed");
    }
    setLoading(false);
  };

  return (
    <div className="h-screen w-full relative bg-slate-900 overflow-hidden font-sans">
      <div className="absolute inset-0 z-0">
        <MapProvider path={dynamicPath} sensorData={sensorData} />
      </div>

      {/* PREMIUM ROUTE TOAST */}
      {toast && (
        <div className="absolute top-8 right-8 z-[100] animate-in fade-in slide-in-from-right-12 duration-700 flex flex-col items-end gap-4 max-w-[450px] pointer-events-none">
           {/* Metrics Row */}
           <div className="flex gap-4">
              <div className="bg-white/95 backdrop-blur-2xl border border-white/60 p-5 rounded-[2.5rem] shadow-2xl flex items-center gap-5 pointer-events-auto">
                 <div className="bg-blue-600 p-3.5 rounded-2xl text-white shadow-xl shadow-blue-600/30"><Clock size={28} strokeWidth={3} /></div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Time</p>
                    <p className="text-2xl font-black text-slate-900 leading-none tracking-tighter">{toast.duration}</p>
                 </div>
              </div>
              <div className="bg-white/95 backdrop-blur-2xl border border-white/60 p-5 rounded-[2.5rem] shadow-2xl flex items-center gap-5 pointer-events-auto">
                 <div className="bg-slate-900 p-3.5 rounded-2xl text-white shadow-xl shadow-black/20"><Navigation size={28} strokeWidth={3} /></div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Distance</p>
                    <p className="text-2xl font-black text-slate-900 leading-none tracking-tighter">{toast.distance}</p>
                 </div>
              </div>
           </div>

           {/* AI Insight Card */}
           {(toast.status || toast.insight) && (
              <div className={`bg-white/95 backdrop-blur-3xl border-4 p-8 rounded-[3.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.25)] animate-in slide-in-from-bottom-6 duration-700 pointer-events-auto flex flex-col gap-6 ${
                toast.status === 'ALERT' || toast.status === 'CONGESTED' ? 'border-red-500' : 
                toast.status === 'WARNING' || toast.status === 'MODERATE' ? 'border-amber-500' : 
                toast.status === 'error' ? 'border-slate-800' : 'border-emerald-500'
              }`}>
                 <div className="flex items-center justify-between gap-12">
                    <div className="flex items-center gap-4">
                       <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/30"><Sparkles size={20} /></div>
                       <div>
                          <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest leading-none mb-1">AI Intelligence</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Real-time Forecast</p>
                       </div>
                    </div>
                    <div className={`px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest shadow-lg ${
                      toast.status === 'ALERT' || toast.status === 'CONGESTED' ? 'bg-red-500 text-white shadow-red-500/30' : 
                      toast.status === 'WARNING' || toast.status === 'MODERATE' ? 'bg-amber-500 text-white shadow-amber-500/30' : 
                      toast.status === 'error' ? 'bg-slate-800 text-slate-300' : 'bg-emerald-500 text-white shadow-emerald-500/30'
                    }`}>
                      {toast.status === 'error' ? 'AI OFFLINE' : toast.status || 'CLEAR'}
                    </div>
                 </div>
                 <div className="bg-slate-50/80 p-5 rounded-[2rem] border border-slate-100">
                    <p className="text-[15px] font-bold text-slate-800 leading-snug">
                       {toast.insight || 'Your planned route looks optimal for current conditions. No shift suggested.'}
                    </p>
                 </div>
              </div>
           )}
        </div>
      )}

      <div className="absolute top-8 left-8 w-[420px] z-50 flex flex-col gap-6 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-3xl rounded-[3rem] shadow-[0_40px_80px_rgba(0,0,0,0.3)] border border-white/60 p-10 pointer-events-auto animate-in slide-in-from-left-16 duration-700">
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                 <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-2xl shadow-blue-600/30 ring-8 ring-blue-50/50">
                    <RouteIcon size={28} strokeWidth={3} />
                 </div>
                 <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tighter">Route Brain</h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Intelligence v2.6</p>
                 </div>
              </div>
              <button onClick={() => setShowHistory(!showHistory)} className={`p-3 rounded-2xl transition-all ${showHistory ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-100 text-slate-400'}`}>
                 <History size={28} />
              </button>

           </div>

           {showHistory ? (
              <div className="mt-8 space-y-3 animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-auto">
                <div className="flex items-center justify-between px-2">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Journeys</p>
                   <button onClick={() => setShowHistory(false)} className="text-[10px] font-black text-blue-600 uppercase">Back to Search</button>
                </div>
                {recentRoutes.length === 0 ? (
                  <div className="p-10 text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
                    <p className="text-sm font-bold text-slate-300">No history yet</p>
                  </div>
                ) : (
                  recentRoutes.map((r) => (
                    <button 
                      key={r.id} 
                      onClick={() => {
                        setOrigin(r.origin.name);
                        setDestination(r.destination.name);
                        handleModernAnalyze(`${r.origin.lat},${r.origin.lng}`, `${r.destination.lat},${r.destination.lng}`);
                        setShowHistory(false);
                      }}
                      className="w-full bg-slate-50/50 hover:bg-slate-100 p-4 rounded-2xl flex items-center gap-4 transition-all group text-left"
                    >
                      <div className="bg-white p-2 rounded-xl text-slate-400 group-hover:text-blue-600 shadow-sm"><RouteIcon size={18} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Via {r.origin.name.split(',')[0]}</p>
                        <p className="text-sm font-bold text-slate-900 truncate">to {r.destination.name.split(',')[0]}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-4 relative">
                <div className="absolute left-[15px] top-[55px] bottom-[115px] w-[4px] bg-slate-50 rounded-full" />
                <PlaceAutocomplete 
                  onPlaceSelect={(p: any) => { setOrigin(p.displayName); setOriginCoords(`${p.location.lat},${p.location.lng}`); }}
                  placeholder="Starting Point" defaultValue={origin} iconColor="bg-slate-900"
                />
                <PlaceAutocomplete 
                  onPlaceSelect={(p: any) => { setDestination(p.displayName); setDestCoords(`${p.location.lat},${p.location.lng}`); }}
                  placeholder="Where to?" defaultValue={destination} iconColor="bg-blue-600"
                />
                
                <div className="flex items-center gap-3 bg-white rounded-xl px-3 border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500/20 shadow-sm transition-all ml-1 pointer-events-auto">
                  <Clock size={16} className="text-slate-400" />
                  <input 
                    type="time" 
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className="flex-1 bg-transparent border-none py-3 text-sm font-bold placeholder-slate-400 focus:outline-none"
                  />
                  <span className="text-[10px] font-black text-slate-300 uppercase pr-2">Departure</span>
                </div>

                <button onClick={() => handleModernAnalyze()} disabled={loading}
                  className="w-full mt-6 bg-slate-900 text-white py-5 rounded-[1.8rem] font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-4 shadow-[0_20px_40px_rgba(0,0,0,0.3)] active:scale-[0.97] transition-all disabled:opacity-50">
                  <div className="w-5 h-5 flex items-center justify-center">
                    {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={22} />}
                  </div>
                  Analyze Route
                </button>
              </div>
            )}

        </div>

        {recommendation && (
           <div className={`rounded-[3.5rem] p-10 shadow-2xl pointer-events-auto animate-in slide-in-from-left-16 duration-500 relative overflow-hidden border-4 border-white/30 ${
              recommendation.status === 'ALERT' || recommendation.status === 'CONGESTED' ? 'bg-red-600 text-white' : 
              recommendation.status === 'WARNING' || recommendation.status === 'MODERATE' ? 'bg-amber-500 text-white' : 
              recommendation.status === 'error' ? 'bg-slate-800 text-slate-300' : 'bg-emerald-500 text-white'
           }`}>
              <div className="flex justify-between items-start mb-10 relative z-10">
                 <div className="bg-white/25 p-5 rounded-[1.5rem] backdrop-blur-md shadow-inner">
                    {recommendation.status === 'ALERT' ? <AlertTriangle size={36} /> : 
                     recommendation.status === 'WARNING' ? <Clock size={36} /> : <ShieldCheck size={36} />}
                 </div>
                 <button onClick={() => setRecommendation(null)} className="p-3 bg-black/10 rounded-full"><X size={24}/></button>
              </div>
              <h2 className="text-5xl font-black mb-4 tracking-tighter uppercase leading-none relative z-10">
                 {recommendation.status === 'ALERT' || recommendation.status === 'CONGESTED' ? 'Traffic Alert' : 
                  recommendation.status === 'error' ? 'AI Offline' : 'Route Clear'}
              </h2>
              <p className="text-base font-bold opacity-90 leading-snug mb-10 max-w-[300px] relative z-10">{recommendation.message}</p>
              <div className="mb-10 relative z-10">
                 <p className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em] mb-4">Predicted Intensity</p>
                 <div className="flex items-end gap-2.5 h-24 px-2">
                    {recommendation.timeline?.map((v: number, i: number) => (
                       <div key={i} className={`flex-1 rounded-t-2xl transition-all duration-1000 ${v > 60 ? 'bg-white' : 'bg-white/30'}`} style={{ height: `${Math.max(v, 10)}%` }} />
                    ))}
                 </div>
              </div>
              {recommendation.suggested_shift_mins !== 0 && (
                 <div className="bg-white text-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative z-10 flex items-center justify-between group">
                    <p className="font-black text-xl leading-none">In {Math.abs(recommendation.suggested_shift_mins)} mins</p>
                    <div className="bg-slate-900 text-white p-4 rounded-2xl group-hover:translate-x-2 transition-transform"><ArrowRight size={24} /></div>
                 </div>
              )}
           </div>
        )}
      </div>

      {/* RE-DESIGNED AI SUGGESTIONS WITH COORDINATE GUARANTEE */}
      {suggestions.length > 0 && (
         <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[60] flex gap-6 px-10 pointer-events-none">
            {suggestions.slice(0, 3).map((s, i) => (
               <button 
                  key={i} 
                  onClick={() => { 
                    setOrigin(s.origin_name); 
                    setDestination(s.dest_name); 
                    handleModernAnalyze(s.origin_coord || s.origin_name, s.dest_coord || s.dest_name, true); 
                  }}
                  className="group pointer-events-auto relative flex items-center gap-4 bg-white/95 backdrop-blur-2xl px-8 py-5 rounded-full border border-white shadow-[0_30px_60px_rgba(0,0,0,0.3)] hover:scale-110 hover:bg-white transition-all duration-500 animate-in fade-in slide-in-from-bottom-8"
                  style={{ animation: `float 6s ease-in-out infinite ${i * 1.5}s` }}
               >
                  <div className="bg-blue-600 p-3.5 rounded-full text-white shadow-xl shadow-blue-600/30 ring-4 ring-blue-50">
                     <Sparkles size={20} />
                  </div>
                  <div className="text-left">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">AI Path</p>
                     <p className="text-base font-black text-slate-900 leading-none tracking-tight">{s.label}</p>
                  </div>
               </button>
            ))}
         </div>
      )}

      <div className="absolute top-10 right-10 flex flex-col gap-5 z-50">
         {[Layers, LocateFixed, MoreVertical].map((Icon, i) => (
            <button key={i} className="w-16 h-16 bg-white/95 backdrop-blur-3xl rounded-[1.5rem] shadow-2xl flex items-center justify-center text-slate-800 hover:text-blue-600 transition-all border border-white/60 active:scale-90"><Icon size={26} /></button>
         ))}
      </div>

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
      `}</style>
    </div>
  );
}
