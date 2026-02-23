"use client";
import { useState, useEffect, useRef } from 'react';

const TICKER_ITEMS = [
  "CAM_01 // NODE ACTIVE",
  "YOLOv8n // INFERENCE ENGINE ONLINE",
  "MJPEG STREAM // 30FPS",
  "HARARE CBD // SECTOR 7",
  "CONGESTION MODEL // v2.4.1",
  "AI PIPELINE // LATENCY <40ms",
  "TRAFFIC SYSTEM // BUILD 2026.02",
  "UPTIME // 99.9%",
];

function StatPill({ label, value, color = "cyan" }: { label: string; value: string; color?: string }) {
  const colorMap: Record<string, string> = {
    cyan: "text-cyan-400 border-cyan-900 bg-cyan-950/30",
    green: "text-emerald-400 border-emerald-900 bg-emerald-950/30",
    blue: "text-blue-400 border-blue-900 bg-blue-950/30",
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono ${colorMap[color]}`}>
      <span className="text-slate-500 uppercase tracking-widest">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState({ vehicle_count: 0, congestion_status: "BOOTING..." });
  const [frameUrl, setFrameUrl] = useState('/processed_frame.jpg');
  const [uptime, setUptime] = useState(0);
  const [frameErr, setFrameErr] = useState(false);
  const [barHeights, setBarHeights] = useState<number[]>(Array(20).fill(50));
  const startTime = useRef(Date.now());

  // Generate random bar heights client-side only to avoid SSR mismatch
  useEffect(() => {
    setBarHeights(Array.from({ length: 20 }, () => 20 + Math.random() * 80));
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/traffic', { cache: 'no-store' });
        const json = await res.json();
        if (json.vehicle_count !== undefined) setData(json);
      } catch (err) {
        console.error("fetch error:", err);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const frameInterval = setInterval(() => {
      setFrameUrl(`/processed_frame.jpg?t=${Date.now()}`);
    }, 100);
    return () => clearInterval(frameInterval);
  }, []);

  useEffect(() => {
    const uptimeInterval = setInterval(() => {
      setUptime(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(uptimeInterval);
  }, []);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  const statusConfig = {
    CONGESTED: {
      label: "CONGESTED",
      color: "text-red-400",
      border: "border-red-500/30",
      bg: "bg-red-500/5",
      glow: "glow-red",
      bar: "bg-red-500",
      barWidth: "w-full",
      dot: "bg-red-500",
    },
    MODERATE: {
      label: "MODERATE",
      color: "text-orange-400",
      border: "border-orange-500/30",
      bg: "bg-orange-500/5",
      glow: "glow-orange",
      bar: "bg-orange-500",
      barWidth: "w-2/3",
      dot: "bg-orange-500",
    },
    CLEAR: {
      label: "ALL CLEAR",
      color: "text-emerald-400",
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/5",
      glow: "glow-green",
      bar: "bg-emerald-500",
      barWidth: "w-1/4",
      dot: "bg-emerald-500",
    },
  };

  const s = statusConfig[data.congestion_status as keyof typeof statusConfig] ?? statusConfig.CLEAR;

  return (
    <main className="min-h-screen bg-grid text-slate-200 flex flex-col" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>

      {/* TOP NAV */}
      <header className="glass-card border-b border-white/5 flex items-center justify-between px-6 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 absolute inset-0 animate-ping-slow opacity-60"></div>
          </div>
          <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-[0.25em]">Traffic Command OS</span>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <StatPill label="NODE" value="CAM_01" color="cyan" />
          <StatPill label="UPTIME" value={formatUptime(uptime)} color="green" />
          <StatPill label="MODEL" value="YOLOv8n" color="blue" />
        </div>
        <div className="text-[10px] font-mono text-slate-600 tabular-nums" suppressHydrationWarning>
          {new Date().toLocaleTimeString('en-ZW', { hour12: false })} CAT
        </div>
      </header>

      {/* TICKER */}
      <div className="ticker-wrap border-b border-white/5 py-1.5 bg-black/30">
        <div className="ticker-content text-[9px] font-mono text-slate-600 uppercase tracking-[0.2em]">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="flex items-center gap-3">
              <span className="w-1 h-1 rounded-full bg-cyan-800 inline-block"></span>
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 md:p-6 max-w-[1600px] mx-auto w-full">

        {/* LIVE FEED — 2/3 width */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Camera card */}
          <div className="glass-card glow-cyan rounded-2xl overflow-hidden relative corner-bracket flex-1 min-h-[340px]">
            {/* Top status bar within feed */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-[9px] font-mono text-red-400 uppercase tracking-widest">LIVE</span>
                <span className="text-[9px] font-mono text-slate-500 tracking-wider ml-2">CAM_01 // HARARE CBD NORTH</span>
              </div>
              <span className="text-[9px] font-mono text-slate-600 tabular-nums" suppressHydrationWarning>
                {new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC
              </span>
            </div>

            {/* Feed */}
            {frameErr ? (
              <div className="w-full h-full min-h-[340px] flex flex-col items-center justify-center gap-3 bg-slate-950">
                <div className="w-8 h-8 border-2 border-cyan-900 border-t-cyan-400 rounded-full animate-spin"></div>
                <p className="text-[11px] font-mono text-slate-500 uppercase tracking-widest">Awaiting AI stream...</p>
                <div className="h-0.5 w-24 bg-slate-900 rounded overflow-hidden">
                  <div className="h-full bg-cyan-600 animate-loadbar rounded"></div>
                </div>
              </div>
            ) : (
              <img
                src={frameUrl}
                alt="AI Traffic Feed"
                className="w-full h-full object-cover min-h-[340px]"
                onError={() => setFrameErr(true)}
                onLoad={() => setFrameErr(false)}
              />
            )}

            {/* Scanlines overlay */}
            <div className="scanlines absolute inset-0 pointer-events-none"></div>

            {/* Bottom bar */}
            <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${s.dot}`}></span>
                <span className={`text-[9px] font-mono uppercase tracking-widest ${s.color}`}>{s.label}</span>
              </div>
              <span className="text-[9px] font-mono text-slate-600">http://192.168.2.178:8080/video</span>
            </div>
          </div>

          {/* Bottom stat row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "STREAM", value: "MJPEG", sub: "Active" },
              { label: "FRAME RATE", value: "~20", sub: "FPS" },
              { label: "LATENCY", value: "<40ms", sub: "API avg" },
            ].map((stat) => (
              <div key={stat.label} className="glass-card rounded-xl p-4 flex flex-col gap-1">
                <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">{stat.label}</span>
                <span className="text-xl font-bold text-slate-100 font-mono tabular-nums">{stat.value}</span>
                <span className="text-[9px] text-slate-600">{stat.sub}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT METRICS COLUMN */}
        <div className="flex flex-col gap-4">

          {/* Vehicle Count */}
          <div className="glass-card rounded-2xl p-6 relative corner-bracket overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent pointer-events-none"></div>
            <p className="text-[9px] font-mono text-slate-600 uppercase tracking-[0.25em] mb-1">Detected Vehicles</p>
            <div className="text-[6rem] font-bold leading-none tabular-nums text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {String(data.vehicle_count).padStart(2, '0')}
            </div>
            <p className="text-[9px] font-mono text-slate-600 mt-3 uppercase tracking-widest">Real-time YOLOv8 scan</p>
            <div className="mt-4 flex items-end gap-0.5 h-8">
              {barHeights.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-blue-600/30"
                  style={{ height: `${h}%` }}
                ></div>
              ))}
            </div>
          </div>

          {/* Congestion Status */}
          <div className={`glass-card rounded-2xl p-6 relative corner-bracket overflow-hidden border ${s.border} ${s.bg} ${s.glow} transition-all duration-700`}>
            <p className="text-[9px] font-mono text-slate-600 uppercase tracking-[0.25em] mb-3">Congestion Status</p>
            <div className={`text-4xl font-bold tracking-tight ${s.color}`}>
              {s.label}
            </div>
            <p className="text-[9px] font-mono text-slate-600 mt-1">AI classification result</p>
            <div className="mt-5">
              <div className="flex justify-between text-[9px] font-mono text-slate-600 mb-1">
                <span>DENSITY LEVEL</span>
                <span>{data.congestion_status === "CONGESTED" ? "HIGH" : data.congestion_status === "MODERATE" ? "MED" : "LOW"}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${s.bar} ${s.barWidth}`}></div>
              </div>
            </div>
          </div>

          {/* System Diagnostics */}
          <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
            <p className="text-[9px] font-mono text-slate-600 uppercase tracking-[0.25em]">System Diagnostics</p>
            {[
              { label: "AI Engine", status: "ONLINE", ok: true },
              { label: "IP Webcam", status: "CONNECTED", ok: true },
              { label: "Data Pipeline", status: "NOMINAL", ok: true },
              { label: "Dashboard API", status: "200 OK", ok: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{item.label}</span>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                  <span className={`text-[9px] font-mono ${item.ok ? 'text-emerald-500' : 'text-red-500'}`}>{item.status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="text-center mt-auto">
            <p className="text-[9px] font-mono text-slate-700 uppercase tracking-widest">Harare Logistics Division</p>
            <p className="text-[9px] font-mono text-slate-800">Build 2026.02 // Traffic AI Systems</p>
          </div>
        </div>
      </div>
    </main>
  );
}
