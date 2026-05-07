"use client";
import { useState, useEffect, useCallback } from "react";
import { 
  Activity, 
  Video, 
  Cpu, 
  Database, 
  Terminal as TerminalIcon, 
  Settings, 
  Maximize2, 
  ShieldCheck,
  AlertCircle,
  Zap,
  LayoutGrid,
  Radio,
  Eye,
  BarChart3
} from "lucide-react";
import Link from "next/link";
import { connectCamera, disconnectCamera, getCameraStatus } from "@/lib/api";

const DETECTIONS = [
  { id: 1, type: "car", x: 20, y: 40, w: 15, h: 10, conf: 0.94 },
  { id: 2, type: "car", x: 50, y: 55, w: 12, h: 8, conf: 0.91 },
  { id: 3, type: "bus", x: 65, y: 35, w: 20, h: 15, conf: 0.88 },
  { id: 4, type: "pedestrian", x: 15, y: 70, w: 4, h: 8, conf: 0.85 },
  { id: 5, type: "pedestrian", x: 45, y: 75, w: 4, h: 8, conf: 0.82 },
  { id: 6, type: "car", x: 80, y: 60, w: 14, h: 10, conf: 0.96 },
];

export default function AdminPage() {
  const [isLive, setIsLive] = useState(false);
  const [activeTab, setActiveTab] = useState("vision");
  const [logs, setLogs] = useState<string[]>([
    "System: Booting Traffic Director Node...",
    "System: CV Pipeline Initialized.",
    "System: Waiting for Camera connection..."
  ]);
  const [cameraIp, setCameraIp] = useState(process.env.NEXT_PUBLIC_TRAFFIC_PHONE_IP || "192.168.1.128");
  const [isConnecting, setIsConnecting] = useState(false);
  const [stats, setStats] = useState({
    fps: 30,
    latency: 12,
    detections: 0,
    cpu: 45
  });

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  const toggleLive = async () => {
    if (isLive) {
      setIsConnecting(true);
      await disconnectCamera();
      setIsLive(false);
      setIsConnecting(false);
      addLog("Camera: Disconnected manually.");
    } else {
      setIsConnecting(true);
      addLog(`Camera: Requesting connection to ${cameraIp}...`);
      try {
        const res = await connectCamera(cameraIp, "8080", "cam_main_01");
        // res.status might be missing if backend returns 500 detail
        if (res.status === "success") {
          setIsLive(true);
          addLog(`Camera: Handshake successful. Receiving stream from ${cameraIp}.`);
        } else {
          addLog(`Camera Error: ${res.detail || res.message || "Failed to initialize node"}`);
          setIsLive(false);
        }
      } catch (e) {
        addLog("Camera: Connection failed. Is the backend running?");
      } finally {
        setIsConnecting(false);
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (isLive) {
        setStats(prev => ({
          fps: Math.round(28 + Math.random() * 4),
          latency: Math.round(8 + Math.random() * 8),
          detections: DETECTIONS.length + Math.round(Math.random() * 2),
          cpu: Math.round(40 + Math.random() * 15)
        }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  return (
    <div className="min-h-screen bg-black text-zinc-300 font-mono flex flex-col selection:bg-cyan-500/30">
      
      {/* ── Top HUD Bar ── */}
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Cpu className="text-cyan-500 animate-pulse" size={20} />
            <span className="font-black text-white tracking-widest text-sm uppercase">Brain Admin UI v1.0</span>
          </div>
          <div className="h-4 w-px bg-zinc-700 mx-2" />
          <div className="flex items-center gap-3">
             <div className={`w-2 h-2 rounded-full ${isLive ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]" : "bg-red-500"}`} />
             <span className="text-[10px] font-bold uppercase tracking-widest">
               Node Status: {isLive ? "CONNECTED" : "DISCONNECTED"}
             </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex gap-6 text-[10px] font-bold">
            <div className="flex flex-col items-end">
              <span className="text-zinc-500 uppercase">GPU LOAD</span>
              <span className="text-white">RTX 4090 / 22%</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-zinc-500 uppercase">LATENCY</span>
              <span className={isLive ? "text-cyan-400" : "text-zinc-600"}>{isLive ? `${stats.latency}ms` : "--"}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-zinc-500 uppercase">FPS</span>
              <span className={isLive ? "text-cyan-400" : "text-zinc-600"}>{isLive ? stats.fps : "--"}</span>
            </div>
          </div>
          <Link href="/" className="px-4 py-1.5 border border-zinc-700 rounded text-[10px] font-bold hover:bg-white hover:text-black transition-all uppercase">Exit Console</Link>
        </div>
      </header>

      {/* ── Main Dashboard Layout ── */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Sidebar Nav */}
        <nav className="w-16 border-r border-zinc-800 flex flex-col items-center py-6 gap-8 shrink-0 bg-zinc-950">
          <button onClick={() => setActiveTab("vision")} className={`p-2 rounded transition-all ${activeTab === 'vision' ? 'text-cyan-400 bg-cyan-400/10' : 'text-zinc-600 hover:text-zinc-400'}`}>
            <Video size={24} />
          </button>
          <button onClick={() => setActiveTab("analytics")} className={`p-2 rounded transition-all ${activeTab === 'analytics' ? 'text-cyan-400 bg-cyan-400/10' : 'text-zinc-600 hover:text-zinc-400'}`}>
            <BarChart3 size={24} />
          </button>
          <button onClick={() => setActiveTab("logs")} className={`p-2 rounded transition-all ${activeTab === 'logs' ? 'text-cyan-400 bg-cyan-400/10' : 'text-zinc-600 hover:text-zinc-400'}`}>
            <TerminalIcon size={24} />
          </button>
          <div className="mt-auto mb-4">
             <Settings className="text-zinc-600 hover:text-zinc-400 cursor-pointer" size={20} />
          </div>
        </nav>

        {/* Content Area */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
           
           {/* Center Feed */}
           <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto min-w-0">
             
             {/* Feed Container */}
             <div className="relative aspect-video bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden group shadow-2xl shadow-black">
                {isLive ? (
                  <div className="relative w-full h-full">
                     <img 
                       src={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000'}/api/v1/camera/stream`} 
                       className="w-full h-full object-cover" 
                       alt="Live Vision Feed" 
                     />
                     
                     {/* SVG Detection Overlays */}
                     <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        {DETECTIONS.map(det => (
                          <g key={det.id}>
                             <rect 
                               x={`${det.x}%`} 
                               y={`${det.y}%`} 
                               width={`${det.w}%`} 
                               height={`${det.h}%`}
                               fill="none"
                               stroke={det.type === 'pedestrian' ? '#fbbf24' : '#22d3ee'}
                               strokeWidth="2"
                               className="animate-pulse"
                             />
                             <text 
                                x={`${det.x}%`} 
                                y={`${det.y - 1}%`} 
                                fill={det.type === 'pedestrian' ? '#fbbf24' : '#22d3ee'}
                                className="text-[10px] font-bold uppercase"
                             >
                               {det.type} {(det.conf * 100).toFixed(0)}%
                             </text>
                          </g>
                        ))}
                        
                        {/* Scanning Line */}
                        <line 
                          x1="0" y1="0" x2="100%" y2="0" 
                          stroke="#22d3ee" strokeWidth="1" strokeOpacity="0.4"
                          className="animate-[scan_4s_linear_infinite]"
                        />
                     </svg>

                     {/* Feed Overlays */}
                     <div className="absolute top-4 left-4 flex flex-col gap-1">
                        <div className="flex items-center gap-2 bg-black/60 px-3 py-1 rounded-sm border-l-2 border-red-500">
                           <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                           <span className="text-[10px] font-bold tracking-tighter">LIVE // NODE_CBD_01</span>
                        </div>
                        <div className="bg-black/60 px-3 py-1 rounded-sm text-[8px] font-mono text-zinc-400">
                          COORDS: -17.8292, 31.0522
                        </div>
                     </div>

                     <div className="absolute bottom-4 right-4 bg-black/60 px-4 py-2 rounded border border-zinc-700/50 backdrop-blur-md">
                        <div className="flex gap-4">
                           <div className="flex flex-col">
                              <span className="text-[8px] text-zinc-500">OBJECTS</span>
                              <span className="text-xl font-black text-cyan-400">{stats.detections}</span>
                           </div>
                           <div className="w-px bg-zinc-800" />
                           <div className="flex flex-col">
                              <span className="text-[8px] text-zinc-500">THROUGHPUT</span>
                              <span className="text-xl font-black text-white">42/m</span>
                           </div>
                        </div>
                     </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800 to-zinc-950">
                    <Video size={48} className="text-zinc-800 mb-2" />
                    <div className="text-center z-10">
                       <p className="text-sm font-bold text-zinc-500 uppercase tracking-[0.3em]">No Active Stream</p>
                       <p className="text-[10px] text-zinc-700 mt-2 mb-6 italic">Connect a camera node to begin inference</p>
                       
                       <div className="flex flex-col items-center gap-3 bg-black/40 p-6 rounded-lg border border-white/5 backdrop-blur-md">
                          <div className="flex flex-col gap-1.5 items-start w-64">
                            <label className="text-[9px] font-black text-cyan-500/70 uppercase tracking-widest ml-1">Node IP Address</label>
                            <input 
                              type="text" 
                              value={cameraIp} 
                              onChange={(e) => setCameraIp(e.target.value)}
                              className="w-full bg-zinc-900/80 border border-zinc-700 rounded px-4 py-2.5 text-sm font-mono text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                              placeholder="e.g. 192.168.1.128"
                            />
                          </div>
                          <button 
                            onClick={toggleLive}
                            disabled={isConnecting}
                            className="w-full max-w-[256px] py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-[0.2em] rounded shadow-lg shadow-cyan-500/20 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {isConnecting ? "Negotiating..." : "Initialize Node"}
                          </button>
                       </div>
                    </div>
                  </div>
                )}
                
                {/* Viewport Corners */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-zinc-700/50" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-zinc-700/50" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-zinc-700/50" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-zinc-700/50" />
             </div>

             {/* Bottom Controls */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-zinc-900 p-5 rounded-lg border border-zinc-800 flex flex-col gap-4">
                   <div className="flex items-center gap-2 mb-2">
                      <Zap size={16} className="text-cyan-400" />
                      <h3 className="text-xs font-black uppercase tracking-widest">Controls</h3>
                   </div>
                   <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Target IP Address</label>
                      <input 
                        type="text" 
                        value={cameraIp} 
                        onChange={(e) => setCameraIp(e.target.value)}
                        disabled={isLive || isConnecting}
                        className="bg-black/40 border border-zinc-700 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500 outline-none transition-all disabled:opacity-50"
                        placeholder="e.g. 192.168.1.128"
                      />
                   </div>
                   <button 
                     onClick={toggleLive}
                     disabled={isConnecting}
                     className={`w-full py-3 rounded font-bold text-xs uppercase tracking-widest transition-all ${
                       isLive ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white' : 'bg-cyan-500 text-black hover:bg-cyan-400'
                     } disabled:opacity-50 disabled:cursor-wait`}
                   >
                     {isConnecting ? "Negotiating..." : isLive ? "Disconnect Node" : "Initialize Node"}
                   </button>
                   <button className="w-full py-3 rounded border border-zinc-700 text-zinc-400 font-bold text-xs uppercase tracking-widest hover:bg-zinc-800 transition-all">
                     Calibrate Zones
                   </button>
                </div>

                <div className="bg-zinc-900 p-5 rounded-lg border border-zinc-800 flex flex-col gap-2">
                   <div className="flex items-center gap-2 mb-4">
                      <ShieldCheck size={16} className="text-cyan-400" />
                      <h3 className="text-xs font-black uppercase tracking-widest">Health Metrics</h3>
                   </div>
                   <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                           <span className="text-zinc-500">INFERENCE LATENCY</span>
                           <span className="text-white">{isLive ? stats.latency : 0}ms</span>
                        </div>
                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                           <div className="h-full bg-cyan-400 transition-all" style={{ width: isLive ? `${(stats.latency / 30) * 100}%` : '0%' }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                           <span className="text-zinc-500">CPU LOAD</span>
                           <span className="text-white">{stats.cpu}%</span>
                        </div>
                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                           <div className="h-full bg-cyan-400 transition-all" style={{ width: `${stats.cpu}%` }} />
                        </div>
                      </div>
                   </div>
                </div>

                <div className="bg-zinc-900 p-5 rounded-lg border border-zinc-800 flex flex-col gap-3">
                   <div className="flex items-center gap-2 mb-2">
                      <Database size={16} className="text-cyan-400" />
                      <h3 className="text-xs font-black uppercase tracking-widest">Active Models</h3>
                   </div>
                   <div className="flex items-center justify-between p-2 bg-black/30 rounded border border-zinc-800">
                      <span className="text-[10px] font-bold">YOLOv8-Traffic</span>
                      <span className="text-[9px] bg-cyan-400 text-black px-1.5 rounded font-black">ACTIVE</span>
                   </div>
                   <div className="flex items-center justify-between p-2 bg-black/30 rounded border border-zinc-800 opacity-40">
                      <span className="text-[10px] font-bold">Lane-Seg-v2</span>
                      <span className="text-[9px] border border-zinc-700 px-1.5 rounded">STANDBY</span>
                   </div>
                </div>
             </div>
           </div>

           {/* Console / Log Sidebar */}
           <div className="w-full md:w-80 border-l border-zinc-800 flex flex-col shrink-0 bg-zinc-950">
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">System Logs</span>
                <Radio size={14} className={isLive ? "text-cyan-400" : "text-zinc-700"} />
              </div>
              <div className="flex-1 p-4 font-mono text-[10px] space-y-2 overflow-y-auto">
                 {logs.map((log, i) => (
                   <div key={i} className={log.includes('System') ? 'text-zinc-500' : 'text-cyan-500'}>
                      {log}
                   </div>
                 ))}
              </div>
              <div className="p-4 border-t border-zinc-800">
                 <div className="bg-zinc-900 rounded border border-zinc-700 p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-yellow-500">
                       <AlertCircle size={14} />
                       <span className="text-[10px] font-black uppercase">Ingestion Note</span>
                    </div>
                    <p className="text-[9px] text-zinc-500 leading-relaxed italic">
                      Vision nodes are calibrated for 1080p @ 30FPS. Low-light enhancement is automatically toggled by sensor lux.
                    </p>
                 </div>
              </div>
           </div>

        </div>
      </main>

      <style jsx global>{`
        @keyframes scan {
          from { top: 0; }
          to { top: 100%; }
        }
      `}</style>
    </div>
  );
}
