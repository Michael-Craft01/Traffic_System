"use client";
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
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
  addRecentRoute,
  getCommuterScore,
  addCommuterPoints
} from '@/lib/storage';
import { fetchRecommendation, fetchTrafficState, logJourney, fetchSuggestions, reportTrafficIncident } from '@/lib/api';
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
  const notifiedAlerts = React.useRef<Set<string>>(new Set());
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentArea, setIncidentArea] = useState(CAMERA_NODES[0]?.id || "cam_main_01");
  const [commuterScore, setCommuterScore] = useState(0);

  useEffect(() => {
    setRecentRoutes(getRecentRoutes());
    setCommuterScore(getCommuterScore());
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

    const pollTraffic = async () => {
      const state = await fetchTrafficState();
      setSensorData(state);
      
      if (state.backend_online && state.cameras) {
        Object.entries(state.cameras).forEach(([camId, data]) => {
          if (data.status === 'CONGESTED' || data.status === 'ALERT') {
            if (!notifiedAlerts.current.has(camId)) {
              const camNode = CAMERA_NODES.find(c => c.id === camId);
              const label = camNode ? camNode.area : camId;
              toast.error(`⚠️ Proactive Traffic Alert`, {
                description: `Severe congestion detected at ${label}. Expect delays if heading that way.`,
                duration: 10000,
              });
              notifiedAlerts.current.add(camId);
            }
          } else {
            notifiedAlerts.current.delete(camId);
          }
        });
      }
    };

    pollTraffic();
    const interval = setInterval(pollTraffic, 15000);

    return () => clearInterval(interval);
  }, []);

  const runAIForecast = async (camIds: string[]) => {
    try {
      const allPredictions = await Promise.all(camIds.map(camId => fetchRecommendation(camId, 0)));
      const worstRec = allPredictions.reduce((prev, curr) => (curr.predicted_volume || 0) >= (prev.predicted_volume || 0) ? curr : prev);
      const worstVol = worstRec.predicted_volume || 0;
      const timeline = [
        worstVol * 0.4, worstVol * 0.7, worstVol,
        worstVol * 0.8, worstVol * 0.5, worstVol * 0.3
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

      toast.success("Route Optimized", {
        description: `Time: ${timeStr} | Distance: ${distStr}`
      });

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
        const type = aiRec.status === 'ALERT' || aiRec.status === 'CONGESTED' ? 'error' : 
                     aiRec.status === 'WARNING' || aiRec.status === 'MODERATE' ? 'warning' : 
                     aiRec.status === 'error' ? 'error' : 'success';
                     
        if ((aiRec.suggested_shift_mins || 0) > 0) {
           toast[type as "error" | "warning"](`AI Insight: ${aiRec.status || 'WARNING'}`, {
             description: aiRec.message,
             duration: 10000,
             action: {
               label: 'Accept Slot (+50 pts)',
               onClick: () => {
                 const newScore = addCommuterPoints(50);
                 setCommuterScore(newScore);
                 toast.success("Departure scheduled! You earned 50 Eco-Points.");
               }
             }
           });
        } else if (aiRec.status === 'CLEAR') {
           toast.success(`AI Insight: CLEAR`, {
             description: aiRec.message,
             action: {
               label: 'Drive Now (+10 pts)',
               onClick: () => {
                 const newScore = addCommuterPoints(10);
                 setCommuterScore(newScore);
                 toast.success("Eco-Points awarded for off-peak driving!");
               }
             }
           });
        } else {
          toast[type as "error" | "warning" | "success"](`AI Insight: ${aiRec.status || 'CLEAR'}`, {
            description: aiRec.message || 'Your planned route looks optimal for current conditions.'
          });
        }
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

      <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white/95 backdrop-blur-3xl px-6 py-3 rounded-full shadow-2xl border border-white/60">
        <Star size={20} className={commuterScore >= 300 ? "text-yellow-500 fill-yellow-500" : commuterScore >= 100 ? "text-slate-400 fill-slate-400" : "text-amber-700 fill-amber-700"} />
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Commuter Rank</p>
          <p className="text-sm font-black text-slate-900 leading-none">
            {commuterScore >= 300 ? 'Gold' : commuterScore >= 100 ? 'Silver' : 'Bronze'} ({commuterScore} pts)
          </p>
        </div>
      </div>

      {/* PREMIUM ROUTE TOAST REMOVED IN FAVOR OF SONNER */}

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
         <button onClick={() => setShowIncidentModal(true)} className="w-16 h-16 bg-red-500 text-white backdrop-blur-3xl rounded-[1.5rem] shadow-2xl flex items-center justify-center hover:bg-red-600 hover:scale-110 transition-all active:scale-90 relative group">
           <AlertTriangle size={26} />
           <span className="absolute right-full mr-4 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Report Incident</span>
         </button>
         {[Layers, LocateFixed, MoreVertical].map((Icon, i) => (
            <button key={i} className="w-16 h-16 bg-white/95 backdrop-blur-3xl rounded-[1.5rem] shadow-2xl flex items-center justify-center text-slate-800 hover:text-blue-600 transition-all border border-white/60 active:scale-90"><Icon size={26} /></button>
         ))}
      </div>

      {showIncidentModal && (
        <div className="absolute inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="bg-red-100 text-red-600 p-3 rounded-2xl">
                  <AlertTriangle size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Report Incident</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Community Alert</p>
                </div>
              </div>
              <button onClick={() => setShowIncidentModal(false)} className="p-3 bg-slate-100 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Location Area</label>
                <select 
                  value={incidentArea}
                  onChange={(e) => setIncidentArea(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                >
                  {CAMERA_NODES.map(node => (
                    <option key={node.id} value={node.id}>{node.area} ({node.label})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { type: 'CRASH', icon: '🚗', label: 'Crash' },
                  { type: 'HAZARD', icon: '🚧', label: 'Hazard' },
                  { type: 'POLICE', icon: '🚓', label: 'Police' }
                ].map(incident => (
                  <button 
                    key={incident.type}
                    onClick={async () => {
                      toast.loading("Broadcasting incident...", { id: "incident-toast" });
                      const res = await reportTrafficIncident(incidentArea, incident.type as any);
                      toast.dismiss("incident-toast");
                      if (res.success) {
                        const newScore = addCommuterPoints(20);
                        setCommuterScore(newScore);
                        toast.success("Incident broadcasted. You earned 20 Eco-Points!");
                        setShowIncidentModal(false);
                      } else {
                        toast.error("Failed to broadcast incident.");
                      }
                    }}
                    className="flex flex-col items-center justify-center gap-2 bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 p-4 rounded-2xl transition-all active:scale-95"
                  >
                    <span className="text-3xl">{incident.icon}</span>
                    <span className="text-xs font-bold text-slate-700">{incident.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
      `}</style>
    </div>
  );
}
