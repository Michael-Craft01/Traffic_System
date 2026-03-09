"use client";
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the Map to avoid SSR issues
const TrafficMap = dynamic(() => import('../components/TrafficMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
    </div>
  )
});

export default function Home() {
  const [data, setData] = useState({ vehicle_count: 0, congestion_status: "CONNECTING..." });
  const [forecast, setForecast] = useState<number[]>([]);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  const [userProfile, setUserProfile] = useState({ home: "Sector 7", office: "CBD North" });
  const [ecoStats, setEcoStats] = useState({ fuelSaved: 1.2, co2Reduced: 2.8 });
  const [showProfile, setShowProfile] = useState(false);
  const [showReporter, setShowReporter] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Service Worker & Local Storage Profile
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('SW Registered', reg))
        .catch((err) => console.log('SW Registration failed', err));
    }

    const savedProfile = localStorage.getItem('traffic_user_profile');
    if (savedProfile) setUserProfile(JSON.parse(savedProfile));
  }, []);

  // Data Fetching Loop
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch live state
        const res = await fetch('/api/traffic', { cache: 'no-store' });
        const json = await res.json();
        if (json.vehicle_count !== undefined) {
          setData(json);
          setLastRefreshed(new Date());
        }

        // 2. Fetch forecast (for cam_main_01)
        const fRes = await fetch('/api/forecast/cam_main_01', { cache: 'no-store' });
        const fJson = await fRes.json();
        if (fJson.forecast_30_mins) {
          setForecast(fJson.forecast_30_mins);
        }
      } catch (err) {
        console.error("fetch error:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // 5s refresh for mobile balance
    return () => clearInterval(interval);
  }, [voiceEnabled]);

  // Voice Proactive Alerts
  useEffect(() => {
    if (voiceEnabled && data.congestion_status && data.congestion_status !== "CONNECTING...") {
      const speech = new SpeechSynthesisUtterance(`Status update: Traffic is now ${data.congestion_status.toLowerCase()}`);
      window.speechSynthesis.speak(speech);
    }
  }, [data.congestion_status]);

  // Map status to clean UI colors
  const statusColors = {
    CONGESTED: { bg: 'bg-red-500', text: 'text-red-400', label: 'Heavy Traffic', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]' },
    MODERATE: { bg: 'bg-orange-500', text: 'text-orange-400', label: 'Moderate Flow', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.3)]' },
    CLEAR: { bg: 'bg-emerald-500', text: 'text-emerald-400', label: 'Smooth Flow', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]' },
    "CONNECTING...": { bg: 'bg-slate-500', text: 'text-slate-400', label: 'Syncing...', glow: '' }
  };

  const currentStatus = statusColors[data.congestion_status as keyof typeof statusColors] || statusColors.CLEAR;

  const checkCommute = async () => {
    setIsPlanning(true);
    setShowPlanner(true);
    try {
      const res = await fetch('/api/recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: "mobile_user_01",
          route_id: "cam_main_01",
          departure_delay_mins: 0
        })
      });
      const json = await res.json();
      setRecommendation(json);
    } catch (err) {
      console.error("Commute check error:", err);
    } finally {
      setIsPlanning(false);
    }
  };

  return (
    <main className="fixed inset-0 bg-black text-slate-100 flex flex-col font-sans overflow-hidden">

      {/* PLANNER MODAL (Feature 6) */}
      {showPlanner && (
        <div className="absolute inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a0c10] border border-white/10 rounded-[2.5rem] p-8 animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Commute Planner</h3>
              <button
                onClick={() => setShowPlanner(false)}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400"
              >✕</button>
            </div>

            {isPlanning ? (
              <div className="py-12 flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
                <p className="text-sm font-mono text-cyan-500 animate-pulse">Consulting ML Brain...</p>
              </div>
            ) : recommendation ? (
              <div className="space-y-6">
                <div className={`p-6 rounded-3xl border ${recommendation.is_good_idea ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                  <p className="text-[10px] uppercase tracking-widest font-bold mb-2 opacity-60">Recommendation</p>
                  <p className="text-lg font-medium leading-tight">{recommendation.message}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-slate-500 uppercase mb-1">Optimal Window</p>
                    <p className="text-md font-bold">{recommendation.optimal_window_mins} mins</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-slate-500 uppercase mb-1">Expected Delay</p>
                    <p className="text-md font-bold text-red-400">+{recommendation.predicted_delay_index * 5}m</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowPlanner(false)}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 rounded-2xl transition-colors"
                >
                  Got it
                </button>
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">Failed to analyze route. Please try again.</p>
            )}
          </div>
        </div>
      )}

      {/* PROFILE MODAL (Feature 9) */}
      {showProfile && (
        <div className="absolute inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a0c10] border border-white/10 rounded-[2.5rem] p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">User Travel Profile</h3>
              <button
                onClick={() => setShowProfile(false)}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400"
              >✕</button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase mb-1">Set Home</p>
                <input
                  type="text"
                  value={userProfile.home}
                  onChange={(e) => setUserProfile({ ...userProfile, home: e.target.value })}
                  className="bg-transparent w-full font-bold text-white outline-none"
                />
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase mb-1">Set Office</p>
                <input
                  type="text"
                  value={userProfile.office}
                  onChange={(e) => setUserProfile({ ...userProfile, office: e.target.value })}
                  className="bg-transparent w-full font-bold text-white outline-none"
                />
              </div>
              <button
                onClick={() => {
                  localStorage.setItem('traffic_user_profile', JSON.stringify(userProfile));
                  setShowProfile(false);
                }}
                className="w-full bg-cyan-600 text-white font-bold py-4 rounded-2xl mt-4"
              >Save Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* INCIDENT REPORTER (Feature 8) */}
      {showReporter && (
        <div className="absolute inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a0c10] border border-white/10 rounded-[2.5rem] p-8">
            <div className="flex justify-between items-center mb-8 text-center w-full">
              <h3 className="text-xl font-bold w-full">Report Incident</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { label: "Accident", icon: "💥" },
                { label: "Closure", icon: "🚧" },
                { label: "Police", icon: "👮" },
                { label: "Hazard", icon: "⚠️" }
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setToast(`Reported: ${item.label}`);
                    setTimeout(() => setToast(null), 3000);
                    setShowReporter(false);
                  }}
                  className="p-6 bg-white/5 hover:bg-white/10 rounded-3xl border border-white/5 flex flex-col items-center gap-2 transition-colors"
                >
                  <span className="text-3xl">{item.icon}</span>
                  <span className="text-xs font-bold uppercase tracking-wider">{item.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowReporter(false)}
              className="w-full py-4 text-slate-500 font-bold uppercase tracking-widest text-[10px]"
            >Cancel</button>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION (Feature 7) */}
      {toast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[3000] px-6 py-3 bg-cyan-600 text-white rounded-full font-bold text-sm shadow-2xl animate-in fade-in slide-in-from-top-4">
          {toast}
        </div>
      )}

      {/* TOP BAR - Minimal & Native Style */}
      <div className="absolute top-0 left-0 right-0 z-[1000] p-4 pointer-events-none">
        <div className="flex justify-between items-start">
          <button
            onClick={() => setShowProfile(true)}
            className="glass-card px-4 py-2 rounded-2xl border border-white/10 pointer-events-auto backdrop-blur-xl bg-black/40 text-left"
          >
            <h1 className="text-sm font-bold tracking-tight">Hi, {userProfile.home}</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Commuter Profile</p>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = !voiceEnabled;
                setVoiceEnabled(next);
                if (next) {
                  const speech = new SpeechSynthesisUtterance("Voice Navigator Active. I will alert you of traffic changes.");
                  window.speechSynthesis.speak(speech);
                }
              }}
              className={`w-10 h-10 rounded-full border border-white/10 flex items-center justify-center transition-colors ${voiceEnabled ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-black/40 text-slate-400'}`}
            >
              {voiceEnabled ? '🔊' : '🔇'}
            </button>
            <div className="glass-card p-2 rounded-full border border-white/10 pointer-events-auto flex items-center gap-2 px-3">
              <div className={`w-2 h-2 rounded-full animate-pulse ${currentStatus.bg}`}></div>
              <span className="text-[10px] font-mono text-slate-300 tabular-nums">LIVE</span>
            </div>
          </div>
        </div>
      </div>

      {/* FULL SCREEN MAP */}
      <div className="flex-1 w-full h-full relative z-0">
        <TrafficMap sensorData={data} />
      </div>

      {/* BOTTOM SHEET - Commuter Action Card */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] p-4">
        <div className={`glass-card rounded-[2.5rem] border border-white/10 backdrop-blur-3xl bg-black/60 p-6 ${currentStatus.glow} transition-all duration-1000`}>

          {/* Action Row */}
          <div className="flex justify-between items-center mb-6">
            <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold">Live Analysis</p>
            <button
              onClick={() => setShowReporter(true)}
              className="px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider active:scale-95 transition-transform"
            >
              Report Jam
            </button>
          </div>
          {/* Eco-Stats Bar (Feature 10) */}
          <div className="flex gap-4 mb-6 pb-6 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-xs text-bold">🍃</div>
              <div>
                <p className="text-[8px] text-slate-500 uppercase font-bold leading-none">CO2 Reduced</p>
                <p className="text-sm font-bold font-mono">{ecoStats.co2Reduced} <span className="text-[9px] font-normal">KG</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2 border-l border-white/5 pl-4">
              <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500 text-sm">⛽</div>
              <div>
                <p className="text-[8px] text-slate-500 uppercase font-bold leading-none">Fuel Saved</p>
                <p className="text-sm font-bold font-mono">{ecoStats.fuelSaved} <span className="text-[9px] font-normal">L</span></p>
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold mb-1 opacity-50">Congestion</p>
              <h2 className={`text-3xl font-bold tracking-tight ${currentStatus.text}`}>
                {currentStatus.label}
              </h2>
            </div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10`}>
              <span className="text-2xl font-bold font-mono">{data.vehicle_count}</span>
            </div>
          </div>

          {/* Forecast Chart (Feature 4) */}
          {forecast.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">30-Min Outlook</p>
              <div className="flex items-end gap-1 h-12">
                {forecast.map((val, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-cyan-500/20 rounded-t-sm transition-all duration-500"
                    style={{ height: `${(val / 1000) * 100}%` }}
                  ></div>
                ))}
              </div>
              <div className="flex justify-between text-[8px] text-slate-600 mt-1 uppercase font-mono">
                <span>Now</span>
                <span>+15m</span>
                <span>+30m</span>
              </div>
            </div>
          )}

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Avg. Speed</p>
              <p className="text-lg font-bold font-mono text-cyan-400">42 <span className="text-[10px] text-slate-600 font-normal">KM/H</span></p>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Trend</p>
              <p className="text-lg font-bold font-mono text-cyan-400">STABLE</p>
            </div>
          </div>

          {/* Primary Action Button (Planned for later) */}
          <button
            className="w-full bg-white text-black font-bold py-4 rounded-2xl active:scale-95 transition-transform"
            onClick={checkCommute}
          >
            Check Commute Window
          </button>

          <p className="text-center text-[9px] text-slate-600 mt-4 uppercase tracking-[0.2em]">
            Last Sync: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Background Grid Overlay */}
      <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none z-[1]"></div>
    </main>
  );
}
