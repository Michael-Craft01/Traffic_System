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
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Service Worker Registration for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('SW Registered', reg))
        .catch((err) => console.log('SW Registration failed', err));
    }
  }, []);

  // Data Fetching Loop
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/traffic', { cache: 'no-store' });
        const json = await res.json();
        if (json.vehicle_count !== undefined) {
          setData(json);
          setLastRefreshed(new Date());
        }
      } catch (err) {
        console.error("fetch error:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // 5s refresh for mobile balance
    return () => clearInterval(interval);
  }, []);

  // Map status to clean UI colors
  const statusColors = {
    CONGESTED: { bg: 'bg-red-500', text: 'text-red-400', label: 'Heavy Traffic', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]' },
    MODERATE: { bg: 'bg-orange-500', text: 'text-orange-400', label: 'Moderate Flow', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.3)]' },
    CLEAR: { bg: 'bg-emerald-500', text: 'text-emerald-400', label: 'Smooth Flow', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]' },
    "CONNECTING...": { bg: 'bg-slate-500', text: 'text-slate-400', label: 'Syncing...', glow: '' }
  };

  const currentStatus = statusColors[data.congestion_status as keyof typeof statusColors] || statusColors.CLEAR;

  return (
    <main className="fixed inset-0 bg-black text-slate-100 flex flex-col font-sans overflow-hidden">

      {/* TOP BAR - Minimal & Native Style */}
      <div className="absolute top-0 left-0 right-0 z-[1000] p-4 pointer-events-none">
        <div className="flex justify-between items-start">
          <div className="glass-card px-4 py-2 rounded-2xl border border-white/10 pointer-events-auto backdrop-blur-xl bg-black/40">
            <h1 className="text-sm font-bold tracking-tight">Traffic Brain</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Harare North Sector</p>
          </div>

          <div className="glass-card p-2 rounded-full border border-white/10 pointer-events-auto flex items-center gap-2 px-3">
            <div className={`w-2 h-2 rounded-full animate-pulse ${currentStatus.bg}`}></div>
            <span className="text-[10px] font-mono text-slate-300 tabular-nums">LIVE</span>
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

          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Current Status</p>
              <h2 className={`text-3xl font-bold tracking-tight ${currentStatus.text}`}>
                {currentStatus.label}
              </h2>
            </div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10`}>
              <span className="text-2xl font-bold font-mono">{data.vehicle_count}</span>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Avg. Speed</p>
              <p className="text-lg font-bold font-mono">42 <span className="text-[10px] text-slate-600 font-normal">KM/H</span></p>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Reliability</p>
              <p className="text-lg font-bold font-mono">98.2<span className="text-[10px] text-slate-600 font-normal">%</span></p>
            </div>
          </div>

          {/* Primary Action Button (Planned for later) */}
          <button className="w-full bg-white text-black font-bold py-4 rounded-2xl active:scale-95 transition-transform">
            Plan Route
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
