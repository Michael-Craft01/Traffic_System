"use client";
import React, { useState, useEffect, useCallback } from "react";
import { fetchIncidents, reportIncident, Incident } from "@/lib/api";
import { 
  AlertTriangle, 
  MapPin, 
  CarFront, 
  Waves,
  ShieldAlert,
  Construction,
  CheckCircle2,
  Clock,
  RadioTower,
  Loader2
} from "lucide-react";

interface IncidentTypeDef {
  key: string;
  label: string;
  Icon: React.ElementType;
  className: string;
  severity: "high" | "medium" | "low";
}

const TYPES: IncidentTypeDef[] = [
  { key: "accident",  label: "Accident",  severity: "high",   Icon: CarFront,     className: "text-black bg-zinc-100 border border-black/10" },
  { key: "closure",   label: "Closure",   severity: "high",   Icon: Construction, className: "text-zinc-700 bg-zinc-100 border border-black/5"  },
  { key: "police",    label: "Police",    severity: "medium", Icon: ShieldAlert,  className: "text-zinc-600 bg-white shadow-sm border border-black/5"      },
  { key: "hazard",    label: "Hazard",    severity: "medium", Icon: AlertTriangle,className: "text-zinc-800 bg-zinc-100 border border-black/5"  },
  { key: "flooding",  label: "Flooding",  severity: "high",   Icon: Waves,        className: "text-black bg-zinc-200 border border-black/10"          },
  { key: "breakdown", label: "Breakdown", severity: "low",    Icon: CarFront,     className: "text-zinc-400 bg-white border border-black/5" },
];

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function IncidentsPage() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [location, setLocation]  = useState("");
  const [note, setNote]          = useState("");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [tab, setTab] = useState<"report" | "active">("report");
  const [loading, setLoading]   = useState(true);

  const loadIncidents = useCallback(async () => {
    const data = await fetchIncidents();
    setIncidents(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadIncidents();
    const id = setInterval(loadIncidents, 10000);
    return () => clearInterval(id);
  }, [loadIncidents]);

  const handleSubmit = async () => {
    if (!selectedType || !location.trim()) return;
    setSubmitting(true);
    
    const t = TYPES.find((t) => t.key === selectedType)!;
    
    await reportIncident({
      type: t.label,
      location: location.trim(),
      note: note.trim(),
      severity: t.severity
    });
    
    setSubmitted(true);
    setSelectedType(null);
    setLocation("");
    setNote("");
    loadIncidents();
    
    setTimeout(() => { 
      setSubmitted(false); 
      setTab("active"); 
    }, 2000);
    
    setSubmitting(false);
  };

  return (
    <div className="h-full overflow-y-auto bg-zinc-100 pb-20 relative">
      
      {/* Background Mesh */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-300 via-zinc-100 to-zinc-50" />
      
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/70 backdrop-blur-xl px-5 pt-8 pb-4 border-b border-white/60 shadow-sm shadow-black/5 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-black tracking-tight flex items-center gap-2">
            <AlertTriangle className="text-black" size={24} strokeWidth={3} />
            Incidents
          </h1>
          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
            Crowd-sourced Traffic Alerts
          </p>
        </div>
        <div className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
          incidents.length > 0 ? "bg-black text-white border-black shadow-md shadow-black/10" : "bg-white/50 text-zinc-400 border-white/60"
        }`}>
          {incidents.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
          {incidents.length} Active
        </div>
      </div>

      {/* Tabs */}
      <div className="p-5 pb-2 relative z-10">
        <div className="flex bg-white/50 backdrop-blur-md border border-white/60 shadow-inner p-1 rounded-2xl">
          {(["report", "active"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 text-[11px] font-bold uppercase tracking-wide py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                tab === t 
                  ? "bg-black text-white shadow-md" 
                  : "text-zinc-500 hover:text-black hover:bg-black/5"
              }`}
            >
              {t === "report" ? <AlertTriangle size={14} /> : <RadioTower size={14} />}
              {t === "report" ? "Report" : "Live Feed"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 relative z-10">
        
        {/* ─── REPORT TAB ─── */}
        {tab === "report" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {submitted ? (
              <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-8 text-center animate-in zoom-in duration-300 shadow-xl shadow-black/5">
                <CheckCircle2 size={48} className="text-black mx-auto mb-4" strokeWidth={2}/>
                <h3 className="text-xl font-black text-black mb-1">Report Broadcasted</h3>
                <p className="text-sm font-semibold text-zinc-500">
                  Thank you. Your report is now live.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 pl-1">
                    Incident Type
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {TYPES.map((t) => {
                      const sel = selectedType === t.key;
                      return (
                        <button
                          key={t.key}
                          onClick={() => setSelectedType(t.key)}
                          className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${
                            sel 
                              ? "bg-black text-white shadow-xl shadow-black/20 transform scale-105" 
                              : "bg-white/70 backdrop-blur-md border border-white/60 text-zinc-600 hover:bg-white shadow-sm"
                          } active:scale-95`}
                        >
                          <div className={`p-2 rounded-xl transition-colors ${sel ? "bg-white/10" : t.className}`}>
                            <t.Icon size={24} strokeWidth={2} />
                          </div>
                          <span className={`text-[10px] uppercase tracking-wide font-bold ${sel ? "text-white" : "text-zinc-500"}`}>
                            {t.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 pl-1">
                    Location *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-4 text-zinc-400" size={18} />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Samora Machel Ave junction"
                      className="w-full bg-white/80 backdrop-blur-md border border-black/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-black placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 pl-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Provide additional details..."
                    rows={3}
                    className="w-full bg-white/80 backdrop-blur-md border border-black/10 rounded-2xl py-4 px-4 text-sm font-bold text-black placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all resize-none shadow-sm"
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!selectedType || !location.trim() || submitting}
                  className="w-full py-5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-black/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none bg-black text-white hover:bg-zinc-800 active:scale-[0.98]"
                >
                  {submitting ? (
                    <><Loader2 size={18} className="animate-spin text-white" /> Broadcasting...</>
                  ) : (
                    <><RadioTower size={18} /> Broadcast Alert</>
                  )}
                </button>
                <p className="text-center text-[10px] font-bold text-zinc-400 uppercase mt-5">
                  Alerts are anonymous.
                </p>
              </>
            )}
          </div>
        )}

        {/* ─── ACTIVE TAB ─── */}
        {tab === "active" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-28 bg-white/50 rounded-3xl" />)}
              </div>
            ) : incidents.length === 0 ? (
              <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl p-8 text-center shadow-lg shadow-black/5">
                <CheckCircle2 size={48} className="text-zinc-300 mx-auto mb-4" strokeWidth={2}/>
                <h3 className="text-xl font-black text-black mb-1">All Clear</h3>
                <p className="text-sm font-semibold text-zinc-500">
                  No active incidents reported by nearby users.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {incidents.map((inc) => {
                  const tDef = TYPES.find(t => t.label === inc.type) || TYPES[5];
                  const Icon = tDef.Icon;
                  return (
                    <div key={inc.id} className="bg-white/80 backdrop-blur-xl border border-white/60 p-5 rounded-3xl shadow-lg shadow-black/5 flex items-start gap-4 transition-all hover:bg-white">
                      <div className={`p-4 rounded-2xl shrink-0 ${tDef.className}`}>
                        <Icon size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-black text-sm text-black">{inc.type}</h4>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase bg-black/5 px-2 py-1 rounded-md">
                            <Clock size={10} /> {timeAgo(inc.reported_at)}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-zinc-600 mb-2 truncate">
                          {inc.location}
                        </p>
                        {inc.note && (
                          <p className="text-xs font-semibold text-zinc-500 bg-zinc-100/80 p-3 rounded-xl border border-black/5">
                            "{inc.note}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
