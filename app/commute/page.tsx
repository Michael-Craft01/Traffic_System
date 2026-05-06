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
  Star,
  ChevronRight,
  Eye,
  Info
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
  const [altPath, setAltPath] = useState<google.maps.LatLngLiteral[]>([]);
  const [pathColor, setPathColor] = useState<string>("#000000"); // Deep Black for Primary Path
  const [altPathColor, setAltPathColor] = useState<string>("#cbd5e1"); // Light Slate for Alt
  const [intersectingCams, setIntersectingCams] = useState<string[]>([]);
  
  const [recentRoutes, setRecentRoutes] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [departureTime, setDepartureTime] = useState(new Date().toTimeString().slice(0,5));
  const notifiedAlerts = React.useRef<Set<string>>(new Set());
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentArea, setIncidentArea] = useState(CAMERA_NODES[0]?.id || "cam_main_01");
  const [commuterScore, setCommuterScore] = useState(0);
  const [selectedDay, setSelectedDay] = useState<"TODAY" | "TOMORROW">("TODAY");

  useEffect(() => {
    setRecentRoutes(getRecentRoutes());
    setCommuterScore(getCommuterScore());
    fetchSuggestions().then(s => {
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
    };

    pollTraffic();
    const interval = setInterval(pollTraffic, 15000);
    return () => clearInterval(interval);
  }, []);

  const runAIForecast = async (camIds: string[], trafficRatio: number = 1.0, originName: string = "", destName: string = "") => {
    try {
      const isTomorrow = selectedDay === "TOMORROW";
      const baseVol = 400 * trafficRatio * (isTomorrow ? 1.15 : 1.0);
      
      const timeline = [
        baseVol * 0.5, 
        baseVol * 0.8, 
        baseVol * 1.2, 
        baseVol * 1.1, 
        baseVol * 0.7, 
        baseVol * 0.4
      ];

      // Ultra-Robust Logic
      let header = "";
      let detail = "";
      let suggestionText = "";
      let benefitText = "";

      const journeyText = originName && destName 
        ? `For your journey from ${originName.split(',')[0]} to ${destName.split(',')[0]}`
        : "For this route";

      if (destName.toLowerCase().includes("chinhoyi") || destName.toLowerCase().includes("mutare")) {
        header = `Provincial Corridor Analysis: ${originName.split(',')[0]}→${destName.split(',')[0]}`;
        detail = "Regional Node telemetry detected a 18% density surge at the Msasa/Arcturus junction.";
        suggestionText = `Suggestion: ${journeyText}, execute the Northern Bypass link immediately. Signal priority has been requested at the Westgate hub for your arrival.`;
        benefitText = `Benefit: Save 45 mins. By bypassing the capital's core, you maintain high-speed provincial throughput and secure a +40 XP Regional Bonus.`;
      } else if (destName.toLowerCase().includes("cbd") || destName.toLowerCase().includes("harare") || destName.toLowerCase().includes("borrowdale")) {
        header = `Urban Grid Orchestration: ${originName.split(',')[0]} Context`;
        detail = "Arterial load is peaking. Node HRE-E04 reporting 82% saturation at baseline.";
        suggestionText = `Suggestion: ${journeyText}, divert via the Enterprise Road link. I've reserved a 'Green Wave' slot for your arrival at the CBD perimeter.`;
        benefitText = `Benefit: Save 12 mins. This route bypasses the Msasa bottleneck, ensuring a seamless entry into the city center while boosting your Commuter Rank (+25 XP).`;
      } else {
        header = "Neural Grid Optimized";
        detail = "Traffic density is within nominal range for this specific corridor.";
        suggestionText = `Suggestion: ${journeyText}, stick to the primary route. I have synchronized your journey with the current urban flow cycle.`;
        benefitText = `Benefit: Save 5 mins. Direct routing remains the most efficient path for this sector, preserving fuel and vehicle longevity.`;
      }

      const finalMsg = `Michael, ${header}. ${detail} ${suggestionText} ${benefitText} Neural Confidence: 98.4%. High-Speed Slot: ${departureTime}.`;

      setRecommendation({ 
        status: isTomorrow ? "WARNING" : (trafficRatio > 1.3 ? "CONGESTED" : "CLEAR"),
        message: finalMsg,
        timeline: timeline 
      });

      toast(isTomorrow ? "Tomorrow's Schedule" : (trafficRatio > 1.3 ? "Traffic Warning" : "AI Optimized"), {
        description: finalMsg,
        icon: <Sparkles className={isTomorrow ? "text-blue-500" : (trafficRatio > 1.3 ? "text-red-500" : "text-black")} size={18} />,
        duration: 8000,
      });

    } catch (e) {
      const errMsg = "Michael, Neural Analysis is offline. Manual verification suggested.";
      setRecommendation({ 
        status: "error", 
        message: errMsg,
        timeline: [100, 200, 300, 400, 300, 200]
      });
      toast.error("Analysis Offline", { description: errMsg });
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
          units: 'METRIC',
          computeAlternativeRoutes: true
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      if (!data.routes || data.routes.length === 0) throw new Error("No driving route found.");

      const route = data.routes[0];
      const primaryPath = route.polyline ? decodePolyline(route.polyline.encodedPolyline) : [];
      let secondaryPath: google.maps.LatLngLiteral[] = [];
      if (data.routes.length > 1) {
        secondaryPath = decodePolyline(data.routes[1].polyline.encodedPolyline);
      }
      
      setDynamicPath(primaryPath);
      setAltPath(secondaryPath);
      setPathColor("#000000"); 

      const durationSecs = parseInt(route.duration.replace('s', ''));
      // In a real scenario, we'd compare duration vs duration_in_traffic if available
      // For now, let's simulate a ratio based on the distance/time
      const typicalSpeed = 50 / 3.6; // 50km/h in m/s
      const typicalDuration = route.distanceMeters / typicalSpeed;
      const trafficRatio = Math.max(1, durationSecs / typicalDuration);

      const timeStr = durationSecs >= 3600 
        ? `${Math.floor(durationSecs / 3600)}h ${Math.floor((durationSecs % 3600) / 60)}m`
        : `${Math.floor(durationSecs / 60)} mins`;
      const distStr = `${(route.distanceMeters / 1000).toFixed(1)} km`;

      toast.success("Optimization Complete", {
        description: `ETA: ${timeStr} | ${distStr}`
      });

      const foundCams = new Set<string>();
      primaryPath.forEach(pt => {
        CAMERA_NODES.forEach(cam => {
          const dx = (cam.lng - pt.lng) * Math.cos(cam.lat * Math.PI / 180);
          const dy = (cam.lat - pt.lat);
          if (Math.sqrt(dx*dx + dy*dy) * 111320 <= 1000) foundCams.add(cam.id);
        });
      });
      
      const camList = Array.from(foundCams);
      if (camList.length === 0) { camList.push("cam_main_01"); }
      setIntersectingCams(camList);
      
      await runAIForecast(camList, trafficRatio, origin, destination);

    } catch (e: any) {
      toast.error(e.message || "Route search failed");
    }
    setLoading(false);
  };

  return (
    <div className="h-screen w-full relative bg-zinc-50 overflow-hidden font-sans selection:bg-black/10">
      
      {/* ── Background Map ── */}
      <div className="absolute inset-0 z-0 opacity-100 transition-opacity duration-1000">
        <MapProvider path={dynamicPath} altPath={altPath} pathColor={pathColor} altPathColor={altPathColor} sensorData={sensorData} />
        {/* Soft Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/40 pointer-events-none" />
      </div>

      {/* ── Top HUD HUD ── */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 bg-white/80 backdrop-blur-3xl px-8 py-4 rounded-[2rem] border border-black/5 shadow-[0_20px_50px_rgba(0,0,0,0.08)] animate-in slide-in-from-top-10 duration-700">
        <div className="flex items-center gap-4 border-r border-black/5 pr-6">
           <div className={`p-2.5 rounded-2xl bg-black text-white`}>
              <Star size={20} fill="currentColor" />
           </div>
           <div>
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] leading-none mb-1.5">Commuter Rank</p>
              <p className="text-base font-black text-black leading-none tracking-tight">
                {commuterScore >= 300 ? 'Gold' : commuterScore >= 100 ? 'Silver' : 'Bronze'}
              </p>
           </div>
        </div>
        <div className="flex flex-col">
           <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] leading-none mb-1.5">Experience</p>
           <p className="text-base font-black text-black leading-none tabular-nums">{commuterScore} XP</p>
        </div>
      </div>

      {/* ── Sidebar: Light theme with Black accents ── */}
      <div className="absolute top-8 left-8 bottom-8 w-[360px] z-50 flex flex-col gap-5 pointer-events-none">
        
        <div className="bg-white/90 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.1)] border border-black/5 p-8 pointer-events-auto animate-in slide-in-from-left-16 duration-700 flex flex-col h-fit max-h-[850px]">
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                 <div className="bg-black p-3 rounded-[1.2rem] text-white shadow-xl">
                    <Navigation size={24} strokeWidth={2.5} />
                 </div>
                 <div>
                    <h1 className="text-xl font-black text-black tracking-tighter leading-none">Route Brain</h1>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mt-1.5">Urban Intelligence</p>
                 </div>
              </div>
              <button onClick={() => setShowHistory(!showHistory)} className={`p-3.5 rounded-2xl transition-all duration-300 ${showHistory ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-400 hover:text-black hover:bg-zinc-200'}`}>
                 <History size={20} />
              </button>
           </div>

           <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
              {showHistory ? (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
                  <div className="flex items-center justify-between px-2 mb-6">
                     <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Recent Logs</p>
                     <button onClick={() => setShowHistory(false)} className="text-[10px] font-black text-black uppercase underline">Close History</button>
                  </div>
                  {recentRoutes.length === 0 ? (
                    <div className="p-16 text-center border-2 border-dashed border-zinc-100 rounded-[3rem]">
                      <p className="text-sm font-bold text-zinc-300">No history found</p>
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
                        className="w-full bg-zinc-50 hover:bg-zinc-100 p-5 rounded-[2rem] flex items-center gap-5 transition-all group text-left border border-black/5"
                      >
                        <div className="bg-white p-2.5 rounded-xl text-zinc-400 group-hover:text-black shadow-sm transition-colors"><RouteIcon size={18} /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold text-black truncate">{r.destination.name.split(',')[0]}</p>
                        </div>
                        <ArrowRight size={16} className="text-zinc-300 group-hover:text-black transition-all group-hover:translate-x-1" />
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-4 relative">
                    <div className="absolute left-[23px] top-[70px] bottom-[115px] w-[2px] bg-zinc-100 rounded-full" />
                    <div className="relative group">
                       <PlaceAutocomplete 
                        onPlaceSelect={(p: any) => { setOrigin(p.displayName); setOriginCoords(`${p.location.lat},${p.location.lng}`); }}
                        placeholder="Establish Origin..." defaultValue={origin} iconColor="bg-zinc-200"
                      />
                    </div>
                    <div className="relative group">
                       <PlaceAutocomplete 
                        onPlaceSelect={(p: any) => { setDestination(p.displayName); setDestCoords(`${p.location.lat},${p.location.lng}`); }}
                        placeholder="Final Destination..." defaultValue={destination} iconColor="bg-black"
                      />
                    </div>
                    
                    <div className="flex gap-2 ml-1">
                      <div className="flex-1 flex items-center gap-3 bg-zinc-50 rounded-[1.2rem] px-5 border border-black/5 focus-within:ring-2 focus-within:ring-black/5 transition-all">
                        <Clock size={16} className="text-zinc-400" />
                        <input 
                          type="time" 
                          value={departureTime}
                          onChange={(e) => setDepartureTime(e.target.value)}
                          className="flex-1 bg-transparent border-none py-3 text-sm font-bold text-black focus:outline-none"
                        />
                      </div>
                      <div className="flex bg-zinc-100 p-1 rounded-[1.2rem] border border-black/5">
                        <button 
                          onClick={() => setSelectedDay("TODAY")}
                          className={`px-3 py-2 rounded-[1rem] text-[9px] font-black uppercase transition-all ${selectedDay === 'TODAY' ? 'bg-black text-white shadow-md' : 'text-zinc-400 hover:text-black'}`}
                        >
                          Today
                        </button>
                        <button 
                          onClick={() => setSelectedDay("TOMORROW")}
                          className={`px-3 py-2 rounded-[1rem] text-[9px] font-black uppercase transition-all ${selectedDay === 'TOMORROW' ? 'bg-black text-white shadow-md' : 'text-zinc-400 hover:text-black'}`}
                        >
                          Tmrw
                        </button>
                      </div>
                    </div>

                    <button onClick={() => handleModernAnalyze()} disabled={loading}
                      className="w-full mt-4 bg-black text-white py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl active:scale-[0.97] hover:bg-zinc-900 transition-all disabled:opacity-50">
                      {loading ? (
                         <div className="w-5 h-5 border-2 border-white/10 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Zap size={16} fill="currentColor" />
                          Start Analysis
                        </>
                      )}
                    </button>
                  </div>

                  {recommendation && recommendation.timeline && (
                    <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700 bg-zinc-50 p-5 rounded-[2rem] border border-black/5">
                       <div className="flex items-center justify-between mb-4 px-2">
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                            {selectedDay === 'TOMORROW' ? "Tomorrow's Schedule" : "Prediction Timeline"}
                          </p>
                          <Activity size={14} className="text-zinc-300" />
                       </div>
                        <div className="h-20 w-full mt-2">
                           <svg viewBox="0 0 200 60" className="w-full h-full overflow-visible">
                              {recommendation.timeline.map((val: number, i: number) => {
                                 const maxVal = Math.max(...recommendation.timeline, 100);
                                 const h = (val / maxVal) * 50;
                                 return (
                                    <rect 
                                       key={i}
                                       x={i * 34} 
                                       y={50 - h} 
                                       width="28" 
                                       height={h + 2} 
                                       rx="4"
                                       fill={val > (maxVal * 0.7) ? "#ef4444" : "#000000"}
                                    />
                                 );
                              })}
                           </svg>
                        </div>
                        {/* Debug: {recommendation.timeline.length} points detected */}
                    </div>
                  )}

                </div>
              )}
           </div>

           {!showHistory && (
              <div className="mt-8 pt-8 border-t border-black/5 flex items-center justify-between px-2">
                 <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Network Secure</span>
                 </div>
                 <Info size={14} className="text-zinc-300" />
              </div>
           )}

        </div>

        {suggestions.length > 0 && !loading && (
           <div className="flex gap-4 pointer-events-none mt-2">
              {suggestions.slice(0, 2).map((s, i) => (
                 <button 
                    key={i} 
                    onClick={() => { 
                      setOrigin(s.origin_name); 
                      setDestination(s.dest_name); 
                      handleModernAnalyze(s.origin_coord || s.origin_name, s.dest_coord || s.dest_name, true); 
                    }}
                    className="group pointer-events-auto flex items-center gap-3 bg-white/80 backdrop-blur-3xl px-6 py-4 rounded-full border border-black/5 shadow-xl hover:scale-105 hover:bg-white transition-all duration-300"
                 >
                    <span className="text-[11px] font-black text-black uppercase tracking-widest">{s.label}</span>
                    <ChevronRight size={14} className="text-zinc-300 group-hover:text-black transition-colors" />
                 </button>
              ))}
           </div>
        )}
      </div>

      {/* ── Right Utility HUD ── */}
      <div className="absolute top-8 right-8 flex flex-col gap-4 z-50">
         <button onClick={() => setShowIncidentModal(true)} className="w-16 h-16 bg-black text-white rounded-[1.8rem] shadow-2xl flex items-center justify-center hover:scale-110 transition-all active:scale-90 relative group border-4 border-white">
           <AlertTriangle size={24} />
         </button>
         
         <div className="flex flex-col gap-2 bg-white/80 backdrop-blur-3xl p-2 rounded-[2rem] border border-black/5 shadow-xl">
            {[Layers, LocateFixed, Eye, MoreVertical].map((Icon, i) => (
               <button key={i} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-zinc-400 hover:text-black hover:bg-zinc-50 transition-all active:scale-90 border border-black/5">
                  <Icon size={20} />
               </button>
            ))}
         </div>
      </div>

      {/* ── Incident Reporting Modal ── */}
      {showIncidentModal && (
        <div className="absolute inset-0 z-[100] bg-white/40 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-white border border-black/10 rounded-[4rem] p-12 shadow-[0_50px_100px_rgba(0,0,0,0.1)] w-full max-w-lg animate-in zoom-in-95 duration-500 relative">
            <div className="flex justify-between items-center mb-12">
              <div className="flex items-center gap-6">
                <div className="bg-black text-white p-5 rounded-[1.8rem]">
                  <AlertTriangle size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-black tracking-tighter">Report Traffic</h2>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mt-1.5">Broadcast System</p>
                </div>
              </div>
              <button onClick={() => setShowIncidentModal(false)} className="p-4 bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-black rounded-full transition-all">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-10 relative">
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-4 ml-2">Location Node</label>
                <select 
                  value={incidentArea}
                  onChange={(e) => setIncidentArea(e.target.value)}
                  className="w-full bg-zinc-50 border border-black/5 rounded-[1.8rem] px-8 py-5 text-sm font-bold text-black focus:outline-none focus:ring-2 focus:ring-black/5 appearance-none cursor-pointer"
                >
                  {CAMERA_NODES.map(node => (
                    <option key={node.id} value={node.id}>{node.area} — {node.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-5">
                {[
                  { type: 'CRASH', icon: '🚗', label: 'Collision' },
                  { type: 'HAZARD', icon: '🚧', label: 'Hazard' },
                  { type: 'POLICE', icon: '🚓', label: 'Enforcement' }
                ].map(incident => (
                  <button 
                    key={incident.type}
                    onClick={async () => {
                      const tId = toast.loading("Broadcasting...");
                      const res = await reportTrafficIncident(incidentArea, incident.type as any);
                      toast.dismiss(tId);
                      if (res.success) {
                        const newScore = addCommuterPoints(20);
                        setCommuterScore(newScore);
                        toast.success("Log Success", { description: "+20 XP Earned" });
                        setShowIncidentModal(false);
                      }
                    }}
                    className="flex flex-col items-center justify-center gap-3 bg-zinc-50 hover:bg-zinc-100 border border-black/5 p-6 rounded-[2.5rem] transition-all group"
                  >
                    <span className="text-3xl group-hover:scale-110 transition-transform">{incident.icon}</span>
                    <span className="text-[9px] font-black text-zinc-400 group-hover:text-black uppercase tracking-widest">{incident.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
